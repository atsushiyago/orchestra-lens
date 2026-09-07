#!/usr/bin/env python3
"""Offline MusicXML-score to performance-audio alignment for Orchestra Lens.

Uses a score-position chroma representation, CQT chroma from local audio, and
optionally constrained monotonic dynamic time warping. Constraints are an
explicit input; without --anchors-json the alignment is fully automatic.
"""
import argparse, csv, hashlib, json, subprocess, sys
from pathlib import Path

import librosa
import numpy as np


FRAME_RATE = 5
SAMPLE_RATE = 22050
HOP_LENGTH = 512
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


def performed_measure_occurrences(musicxml_file: Path) -> list[dict[str, int | float]]:
    """Expand MusicXML forward/backward repeats into performed bar occurrences.

    music21 handles the ordinary MusicXML repeat and ending navigation needed
    here. The resulting list retains each written measure identifier plus an
    occurrence count, so repeated bars never need to share one timestamp.
    """
    from music21 import converter
    score = converter.parse(musicxml_file)
    measures = list(score.parts[0].expandRepeats().getElementsByClass('Measure'))
    occurrences: list[dict[str, int | float]] = []
    seen: dict[int, int] = {}
    for index, measure in enumerate(measures, start=1):
        try:
            number = int(measure.number)
        except (TypeError, ValueError):
            continue
        occurrence = seen.get(number, 0) + 1
        seen[number] = occurrence
        occurrences.append({
            'performanceIndex': index,
            'measure': number,
            'occurrence': occurrence,
            'scoreQstamp': float(measure.offset),
        })
    if not occurrences:
        raise ValueError('No numbered measures found in MusicXML first part')
    return occurrences


def position_occurrence_qstamps(rows: list[dict[str, str]], occurrences: list[dict[str, int | float]]) -> list[float]:
    """Project sparse position rows onto the repeat-expanded measure traversal."""
    expected: list[float] = []
    observed: list[float] = []
    cursor = 0
    for row in rows:
        try:
            measure = int(row['measure'])
            qstamp = float(row['qstamp'])
            beat_offset = float(row['beat']) - 1
        except (KeyError, TypeError, ValueError):
            continue
        while cursor < len(occurrences) and occurrences[cursor]['measure'] != measure:
            cursor += 1
        if cursor == len(occurrences):
            raise ValueError(f'Position row measure {measure} does not occur in the performed MusicXML traversal')
        expected.append(float(occurrences[cursor]['scoreQstamp']) + beat_offset)
        observed.append(qstamp)
    if not expected:
        raise ValueError('No score-position rows could be matched to the performed traversal')
    return list(np.interp(
        [float(item['scoreQstamp']) for item in occurrences], expected, observed,
    ))


def score_chroma(position_file: Path, musicxml_file: Path) -> tuple[np.ndarray, list[dict[str, int | float]]]:
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

    occurrences = performed_measure_occurrences(musicxml_file)
    qstamps = position_occurrence_qstamps(rows, occurrences)
    for item, qstamp in zip(occurrences, qstamps):
        item['positionQstamp'] = qstamp
        item['scoreTime'] = float(np.interp(qstamp, q, t))
    return chroma, occurrences


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


def align(audio: np.ndarray, score: np.ndarray, occurrence_score_times: list[dict[str, int | float]], anchors: dict[int, float]) -> np.ndarray:
    measure_score_times = {int(item['measure']): float(item['scoreTime']) for item in occurrence_score_times if int(item['occurrence']) == 1}
    score_anchor_indices = [round(measure_score_times[m] * FRAME_RATE) for m in anchors]
    audio_anchor_indices = [round(anchors[m] * FRAME_RATE) for m in anchors]
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
    parser.add_argument('--anchors-json', type=Path, help='Optional JSON object mapping score measures to fixed audio seconds.')
    parser.add_argument('--recording-id', default=None)
    args = parser.parse_args()
    anchors = {int(measure): float(seconds) for measure, seconds in json.loads(args.anchors_json.read_text()).items()} if args.anchors_json else {}
    score, occurrences = score_chroma(args.positions, args.musicxml)
    measure_score_times = {int(item['measure']): float(item['scoreTime']) for item in occurrences if int(item['occurrence']) == 1}
    missing = sorted(set(anchors).difference(measure_score_times))
    if missing:
        raise ValueError(f'Anchor measures are not present in score positions: {missing}')
    audio, duration = audio_chroma(args.audio)
    mapping = align(audio, score, occurrences, anchors)
    for item in occurrences:
        item['timeSeconds'] = round(float(np.interp(float(item['scoreTime']) * FRAME_RATE, np.arange(len(mapping)), mapping)), 3)
    # DTW at finite resolution can repeat a time at very short bars. Preserve
    # a strict measure map with a 1 ms deterministic tie-breaker.
    last = -1.0
    for item in occurrences:
        item['timeSeconds'] = round(max(float(item['timeSeconds']), last + 0.001), 3)
        last = float(item['timeSeconds'])
    # The two accepted landmarks are hard constraints on the final map. Their
    # values are retained exactly rather than shifted by feature-frame rounding.
    for measure, time_seconds in anchors.items():
        next(item for item in occurrences if int(item['measure']) == measure and int(item['occurrence']) == 1)['timeSeconds'] = time_seconds
    if last > duration:
        raise ValueError('Alignment exceeds decoded audio duration')
    payload = {
        'recording': args.recording_id or args.audio.stem,
        'method': 'CQT chroma dynamic time warping' + (' with explicit anchor constraints' if anchors else ' without manual constraints'),
        'anchorPolicy': {'usedAsConstraints': anchors},
        'durationSeconds': round(duration, 3),
        'audioFeatures': {'sampleRate': SAMPLE_RATE, 'hopLength': HOP_LENGTH, 'featureType': 'CQT chroma', 'frameRate': FRAME_RATE},
        'inputSha256': {'musicxml': sha256(args.musicxml), 'positions': sha256(args.positions), 'audio': sha256(args.audio)},
        'occurrences': occurrences,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + '\n')
    args.csv.parent.mkdir(parents=True, exist_ok=True)
    args.csv.write_text('performanceIndex,measure,occurrence,timeSeconds\n' + ''.join(f'{item["performanceIndex"]},{item["measure"]},{item["occurrence"]},{item["timeSeconds"]:.3f}\n' for item in occurrences))
    mapped_times = [float(item['timeSeconds']) for item in occurrences]
    increments = [right - left for left, right in zip(mapped_times[:-1], mapped_times[1:])]
    median_increment = float(np.median(increments))
    long_jump_limit = max(20.0, median_increment * 25)
    long_jumps = [
        {'fromPerformanceIndex': occurrences[index]['performanceIndex'], 'toPerformanceIndex': occurrences[index + 1]['performanceIndex'], 'seconds': round(increment, 3)}
        for index, increment in enumerate(increments) if increment > long_jump_limit
    ]
    health_reasons = []
    if long_jumps:
        health_reasons.append(f'{len(long_jumps)} measure-to-measure jump(s) exceed {round(long_jump_limit, 3)} seconds')
    if any(increment <= .001 for increment in increments):
        health_reasons.append('one or more measure pairs collapsed at the 1 ms monotonic tie-breaker')
    report = {
        'mappedOccurrences': len(occurrences), 'firstPerformanceIndex': occurrences[0]['performanceIndex'], 'lastPerformanceIndex': occurrences[-1]['performanceIndex'],
        'durationSeconds': round(duration, 3), 'strictlyMonotonic': all(left < right for left, right in zip(mapped_times[:-1], mapped_times[1:])),
        'anchorsUsedAsConstraints': anchors,
        'firstTimeSeconds': mapped_times[0], 'lastTimeSeconds': mapped_times[-1],
        'minimumMeasureIncrementSeconds': round(min(increments), 3), 'medianMeasureIncrementSeconds': round(median_increment, 3), 'maximumMeasureIncrementSeconds': round(max(increments), 3),
        'collapsedMeasurePairs': sum(1 for increment in increments if increment <= .001),
        'numericallyHealthy': not health_reasons,
        'instabilityReasons': health_reasons,
        'longJumps': long_jumps,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
