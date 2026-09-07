#!/usr/bin/env python3
"""Offline MusicXML-score to performance-audio alignment for Orchestra Lens.

Uses a score-position chroma representation, CQT chroma from local audio, and
anchor-constrained dynamic time warping. The two accepted anchors are explicit
inputs, never inferred from the old runtime cue timestamps.
"""
import argparse, csv, hashlib, json, subprocess, sys
from pathlib import Path

import librosa
import numpy as np
from music21 import converter


FRAME_RATE = 5
SAMPLE_RATE = 22050
HOP_LENGTH = 512
ANCHORS = {30: 126.36, 62: 271.0}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def parse_pitch_class(value: str) -> int | None:
    if not value or value == 'r':
        return None
    steps = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    pitch = steps.get(value[0])
    if pitch is None:
        return None
    rest = value[1:]
    if rest.startswith('#'):
        pitch += 1
    elif rest.startswith('-'):
        pitch -= 1
    return pitch % 12


def score_chroma(position_file: Path, score_file: Path) -> tuple[np.ndarray, dict[int, float]]:
    with position_file.open() as handle:
        rows = list(csv.DictReader(handle))
    q = np.array([float(row['qstamp']) for row in rows])
    t = np.array([float(row['tstamp']) for row in rows])
    fieldnames = [key for key in rows[0] if key not in {'qstamp', 'tstamp', 'measure', 'beat'}]
    grid = np.arange(0, t[-1], 1 / FRAME_RATE)
    q_grid = np.interp(grid, t, q)
    row_index = np.searchsorted(q, q_grid, side='right') - 1
    row_index = np.clip(row_index, 0, len(rows) - 1)
    chroma = np.zeros((12, len(grid)), dtype=np.float32)
    for index, source_row in enumerate(row_index):
        for field in fieldnames:
            pitch_class = parse_pitch_class(rows[int(source_row)][field])
            if pitch_class is not None:
                chroma[pitch_class, index] += 1
    norms = np.linalg.norm(chroma, axis=0)
    chroma[:, norms > 0] /= norms[norms > 0]

    score = converter.parse(score_file)
    first_part = score.parts[0]
    measure_times: dict[int, float] = {}
    for number in range(1, 459):
        measure = first_part.measure(number)
        if measure is None:
            raise ValueError(f'MusicXML does not contain measure {number}')
        measure_times[number] = float(np.interp(float(measure.offset), q, t))
    return chroma, measure_times


def audio_chroma(audio_file: Path) -> tuple[np.ndarray, float]:
    audio, sample_rate = librosa.load(audio_file, sr=SAMPLE_RATE, mono=True)
    raw = librosa.feature.chroma_cqt(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)
    # Deterministic local aggregation from ~43 Hz CQT chroma to 5 Hz DTW frames.
    frames_per_bin = sample_rate / HOP_LENGTH / FRAME_RATE
    boundaries = np.round(np.arange(0, len(audio) / sample_rate * FRAME_RATE + 1) * frames_per_bin).astype(int)
    boundaries = np.clip(boundaries, 0, raw.shape[1])
    result = np.zeros((12, len(boundaries) - 1), dtype=np.float32)
    for index, (start, end) in enumerate(zip(boundaries[:-1], boundaries[1:])):
        if end > start:
            result[:, index] = raw[:, start:end].mean(axis=1)
    norms = np.linalg.norm(result, axis=0)
    result[:, norms > 0] /= norms[norms > 0]
    return result, len(audio) / sample_rate


def dtw_segment(audio: np.ndarray, score: np.ndarray) -> np.ndarray:
    # Cosine distance, endpoint-constrained global DTW. A full matrix is
    # feasible at 5 Hz and preserves local tempo variation.
    from librosa.sequence import dtw
    _, path = dtw(X=audio, Y=score, metric='cosine')
    return path[::-1]


def align(audio: np.ndarray, score: np.ndarray, measure_score_times: dict[int, float]) -> np.ndarray:
    score_anchor_indices = [round(measure_score_times[m] * FRAME_RATE) for m in ANCHORS]
    audio_anchor_indices = [round(ANCHORS[m] * FRAME_RATE) for m in ANCHORS]
    boundaries = [(0, 0), *zip(audio_anchor_indices, score_anchor_indices), (audio.shape[1] - 1, score.shape[1] - 1)]
    pairs: list[tuple[int, int]] = []
    for (audio_start, score_start), (audio_end, score_end) in zip(boundaries[:-1], boundaries[1:]):
        path = dtw_segment(audio[:, audio_start:audio_end + 1], score[:, score_start:score_end + 1])
        pairs.extend((int(a + audio_start), int(s + score_start)) for a, s in path)
    # Median resolves the many-to-one portions of the DTW path.
    by_score: dict[int, list[int]] = {}
    for audio_index, score_index in pairs:
        by_score.setdefault(score_index, []).append(audio_index)
    indices = np.array(sorted(by_score))
    mapped = np.array([np.median(by_score[index]) for index in indices])
    return np.interp(np.arange(score.shape[1]), indices, mapped) / FRAME_RATE


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--musicxml', required=True, type=Path)
    parser.add_argument('--positions', required=True, type=Path)
    parser.add_argument('--audio', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--csv', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    score, measure_score_times = score_chroma(args.positions, args.musicxml)
    audio, duration = audio_chroma(args.audio)
    mapping = align(audio, score, measure_score_times)
    measures = {str(number): {'timeSeconds': round(float(np.interp(score_time * FRAME_RATE, np.arange(len(mapping)), mapping)), 3)}
                for number, score_time in measure_score_times.items()}
    # DTW at finite resolution can repeat a time at very short bars. Preserve
    # a strict measure map with a 1 ms deterministic tie-breaker.
    last = -1.0
    for item in measures.values():
        item['timeSeconds'] = round(max(item['timeSeconds'], last + 0.001), 3)
        last = item['timeSeconds']
    # The two accepted landmarks are hard constraints on the final map. Their
    # values are retained exactly rather than shifted by feature-frame rounding.
    for measure, time_seconds in ANCHORS.items():
        measures[str(measure)]['timeSeconds'] = time_seconds
    if last > duration:
        raise ValueError('Alignment exceeds decoded audio duration')
    payload = {
        'recording': 'musopen-symphony-orchestra-brahms-op68-iv-cc0',
        'method': 'anchor-constrained CQT chroma dynamic time warping',
        'anchorPolicy': {'usedAsConstraints': ANCHORS},
        'durationSeconds': round(duration, 3),
        'audioFeatures': {'sampleRate': SAMPLE_RATE, 'hopLength': HOP_LENGTH, 'featureType': 'CQT chroma', 'frameRate': FRAME_RATE},
        'inputSha256': {'musicxml': sha256(args.musicxml), 'positions': sha256(args.positions), 'audio': sha256(args.audio)},
        'measures': measures,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + '\n')
    args.csv.write_text('measure,timeSeconds\n' + ''.join(f'{number},{item["timeSeconds"]:.3f}\n' for number, item in measures.items()))
    targets = [30, 62, 290, 407]
    report = {
        'mappedMeasures': len(measures), 'firstMeasure': 1, 'lastMeasure': 458,
        'durationSeconds': round(duration, 3), 'strictlyMonotonic': all(a['timeSeconds'] < b['timeSeconds'] for a, b in zip(list(measures.values())[:-1], list(measures.values())[1:])),
        'anchorsUsedAsConstraints': ANCHORS,
        'targets': {str(m): measures[str(m)]['timeSeconds'] for m in targets},
        'neighborhoods': {f'{start}-{start + 4}': {str(m): measures[str(m)]['timeSeconds'] for m in range(start, start + 5)} for start in [28, 60, 283, 405]},
    }
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
