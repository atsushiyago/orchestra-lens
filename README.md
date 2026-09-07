# Orchestra Lens — non-AI prototype

Orchestra Lens is a React Native TV prototype for Amazon Vega OS. It uses the
media clock to select Brahms score cues. Score Peek presents real public-domain
excerpts from the IMSLP score alongside manually authored musical context.

## Implemented milestones

- **Playback and synchronization:** `KeplerVideoView` and the Vega W3C
  `VideoPlayer` play the HTTPS MP4. `currentTime` selects the active score cue;
  seeking, pausing, and buffering do not advance a separate wall-clock timer.
- **m.30 Smart Score / Orchestra X-Ray:** Horn, Flute, and Strings excerpts,
  with the roles Main Theme, Upcoming Theme Handoff, and Harmonic Support.
- **m.62 Smart Score:** Violins, Lower Strings, and Horn excerpts show the start
  of the main Allegro theme.
- **m.290 Theme Lens:** a horn excerpt relates the transformed return to the
  m.30 Alphorn Theme. COMPARE shows both real excerpts in an in-place view.
- **m.407 Theme Lens:** a climactic chorale excerpt relates back to m.47.
  COMPARE shows the m.47 and m.407 excerpts in the same in-place view.
- **Ask the Score:** an explicit m.62 action sends compact structured context to
  the protected Bedrock backend and displays a short, grounded response.
- **Highlights Tour:** the entry screen offers normal full-movement listening
  and a nine-moment tour drawn directly from the deterministic, ranked score
  analysis. The tour seeks the existing player, confirms audible playback, and
  measures each 20-second excerpt by advancing media time. SCORE opens the
  usual curated view when available, or a generated Score Insight panel for an
  automatically selected moment without a notation asset.

All musical roles and relationships are static data. The source excerpts are
cropped from the existing IMSLP public-domain Brahms Symphony No. 1 score.

## Requirements

- Node 22+ and npm
- Amazon Vega Developer Tools with React Native Kepler runtime 4 support
- Java 21
- A running Vega Virtual Device

The project currently resolves:

- `@amazon-devices/react-native-kepler` `~4.0.0+rn0.83.0`
- `@amazon-devices/react-native-w3cmedia` `2.3.2`

## Validate and build

```sh
npm run typecheck
npm test

export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
npm run build:app
```

The Apple Silicon package is produced at:

```text
build/private/kepler/orchestra-lens/0.1/vega/aarch64/Release/orchestra-lens_aarch64.vpkg
```

With the VVD running, install and launch it:

```sh
vega device install-app --device VirtualDevice \
  --packagePath build/private/kepler/orchestra-lens/0.1/vega/aarch64/Release/orchestra-lens_aarch64.vpkg
vega device launch-app --device VirtualDevice \
  --appName com.orchestralens.prototype.main
```

## Manual demo flow

1. Launch the app and choose **PLAY FULL MOVEMENT** for the existing normal
   playback screen, or **HIGHLIGHTS TOUR** for nine recommended moments.
2. In a Highlights Tour, use **Previous**, **Next**, **SCORE**, and **EXIT
   TOUR**. Exiting stops the tour cleanly and returns to the entry screen.
3. Use **SCORE** during the
   recording-specific cue windows below.
4. Use **BACK** or the VVD remote Back button to return to playback. The player
   remains mounted, preserving time, pause state, and the active cue.
5. At m.290 and m.407, select **COMPARE**. It replaces the Theme Lens body in
   place; **BACK** returns to that cue's Theme Lens without resetting playback.

| Recording seconds | Cue | Score Peek content |
| --- | --- | --- |
| 126.36–141.36 | m.30 | Smart Score and Orchestra X-Ray |
| 271.00–286.00 | m.62 | Smart Score and Ask the Score |
| 712.239–727.239 | m.290 | Theme Lens: m.30 → m.290 |
| 965.28–980.28 | m.407 | Theme Lens: m.47 → m.407 |

### Performance-specific media and synchronization

The target demo performance is [Brahms, *Symphony No. 1*, Op. 68, movement IV
(Musopen Symphony Orchestra)](https://commons.wikimedia.org/wiki/File:Brahms,_Symphony_No._1_in_C_Minor,_Op._68_-_IV._Adagio_-_Pi%C3%B9_andante_-_Allegro_non_troppo,_ma_con_brio.ogg).
Its Commons Summary identifies the source/author as **Musopen Symphony
Orchestra** and explicitly dedicates the file under **CC0 1.0 Universal**. Its
embedded file metadata also names **Czech National Symphony Orchestra**; both
attributions are preserved without inference. The source is 1,016.928 seconds
of Ogg/Vorbis stereo audio at 48 kHz (23,396,499 bytes). Attribution and local
preparation details are kept in
[`scores/media/README.md`](scores/media/README.md).

The local deployment input is an AAC-LC 48 kHz M4A/MP4 derivative at 192 kbps
(24,801,149 bytes). Re-encoding changes neither trim nor playback speed, so its
duration remains 1,016.928 seconds. It is prepared because Vega compatibility
with Ogg/Vorbis is unverified while the app's working playback path is AAC/MP4.
The application deliberately does **not** hotlink Commons. The prepared object
is private in S3 and is delivered only by its dedicated CloudFront HTTPS URL.

`src/data/performanceAlignment.ts` stores only the selected recording identity
and timing anchors. The alignment was produced by matching score-position
pitch-class frames to the actual recording's audio chroma, then retaining the
reviewed anchors: m.30 126.36s, m.47 168.36s, m.62 271.00s, the validated
m.290 712.239s automatic prediction, and m.407 965.28s. This is a
performance-specific score/audio mapping, not a
calculation from tempo markings. Score facts, curated roles, Hauptstimme
evidence, assets, and Theme Lens relationships remain measure-based and do not
contain playback timestamps.

### Offline score-to-audio alignment

`tools/alignScoreToPerformance.py` is a preprocessing pipeline for a specific
recording, separate from the Fire TV app. It converts MusicXML score positions
into a pitch-class timeline, extracts CQT chroma from locally decoded audio at
22,050 Hz (5 Hz alignment frames), and applies monotonic dynamic time warping.
The generated map is written to
`src/data/generated/brahms-op68-movement4-performance-alignment.json` with a
CSV counterpart. A different performance can therefore share the score facts,
Hauptstimme evidence, and curated interpretation while receiving its own map.

The current Brahms run explicitly constrains only the manually verified
landmarks m.30 = 126.36s and m.62 = 271.00s. The m.290 prediction is the
validated user-facing Horn cue; the prior m.285 cue is not user-facing. Run it
locally after installing the Python tool
dependencies in an ignored workspace directory:

```bash
python3 -m pip install --target work/score-alignment-python scipy librosa pandas music21 synctoolbox
MPLCONFIGDIR=work/mpl PYTHONPATH=work/score-alignment-python python3 tools/alignScoreToPerformance.py \
  --musicxml scores/real/Brahms_Op68_Movement4.musicxml \
  --positions scores/real/Brahms_Op68_Movement4_positions.csv \
  --audio scores/media/brahms-op68-movement4-musopen-cc0.m4a \
  --output src/data/generated/brahms-op68-movement4-performance-alignment.json \
  --csv src/data/generated/brahms-op68-movement4-performance-alignment.csv \
  --report work/brahms-op68-movement4-alignment-report.json
```

Generated alignment remains review material until approved for a cue.
`performanceAlignment.ts` uses the approved generated m.290 prediction.

## Offline MusicXML preprocessing

`generate:score-manifest` is a development-time Node/TypeScript tool. It never
runs in the Fire TV app and only extracts objective score facts: part activity,
note counts, pitch ranges, written dynamics, simple articulations, and the
measure's total sounding-note count (`textureDensity`). It does not infer themes,
roles, transformations, or any other musical meaning.

```sh
npm run generate:score-manifest -- ./scores/example.musicxml
```

The command writes `src/data/generated/scoreManifest.json` by default. Pass an
optional second path to write elsewhere. The included `scores/example.musicxml`
fixture is original test data with three instrumental parts and no copyrighted
score content.

The data flow deliberately keeps automatic facts apart from editorial choices:

```text
MusicXML → automatic objective analysis → full generated score manifest
                                        → compact runtime score facts ─┐
                                                                         │
Hauptstimme annotations → human-authored main-voice evidence ───────────┼→ eventual Smart Score selection
                                                                         │
curated Orchestra Lens interpretation → presentation semantics ─────────┘
```

### Offline Highlight Detector

`generate:highlights` is a separate, deterministic preprocessing step for
human review. It reads the complete objective score manifest and the published
Hauptstimme evidence, then ranks measurable transitions across all 458
measures. It has no dependency on Orchestra Lens's curated cue points, roles,
or Theme Lens relationships.

```sh
npm run generate:highlights -- \
  ./src/data/generated/brahms-op68-movement4-manifest.json \
  ./src/data/generated/hauptstimmeEvidence.json \
  ./src/data/generated/brahms-op68-movement4-performance-alignment.json
```

It writes a machine-readable ranked list to
`src/data/generated/brahms-op68-movement4-highlights.json` and the top 15
review candidates to `reports/brahms-op68-movement4-highlights.md`. Candidate
reasons are derived from active-instrument changes, entries and dropouts,
note-density and written-marking changes, pitch-range expansion, sparse/full
texture contrast, and Hauptstimme span, instrument, and label events. The
generated performance map supplies timestamps only.

The weights and 12-measure event-deduplication window are recorded in each
output. They intentionally form an explainable heuristic, not an automatic
claim that a passage is a climax, theme, or definitive musical highlight.
Human review decides whether a ranked candidate becomes an Orchestra Lens cue.

The product tour deliberately preserves the detector's tested ordering instead
of treating only loud or dense passages as worthwhile. Its listener-facing
“Why this moment?” text comes from the generated evidence; it does not expose
raw heuristic scores or debug timestamps. Highlight Review, alignment clocks,
and fine seek controls remain development-only.

### Offline Tour Selector

`generate:tour-selection` is a second offline step that is intentionally
separate from the Highlight Detector. The **Highlight Detector** asks, “Is this
a musically interesting moment?” The **Tour Selector** asks, “Does this moment
add something distinct to the listening tour?” It treats the detector's Top 15
as valid candidate moments and selects **up to** nine that cover more of a
performance while avoiding nearby candidates with similar objective score
fingerprints. It does not alter detector scores or detector artifacts.

The selector uses only generated candidate fields: occurrence-aware playback
timestamp, active/entering/dropping instrument sets, texture density, written
dynamics, and Hauptstimme instrument/label profiles. Its deterministic greedy
formula combines normalized detector quality, distance from the nearest
selected timestamp, and novelty relative to the most similar selected profile.
Within a 38-second window, a candidate is retained only when its generated
profile is objectively distinct. This is a transparent diversity policy, not a
claim about themes, form, or musical value.

```sh
npm run generate:tour-selection -- \
  ./src/data/generated/brahms-op68-movement4-highlights.json \
  ./src/data/generated/brahms-op68-movement4-tour-selection.json \
  ./reports/brahms-op68-movement4-tour-selection.md
```

Run the same command for Beethoven by replacing the work prefix. The generated
JSON records selected moments in performance order plus every rejected Top-15
candidate and its comparison evidence. The reports at
`reports/brahms-op68-movement4-tour-selection.md` and
`reports/beethoven-op67-movement1-tour-selection.md` are the first listening
review outputs.

The validated Brahms selector artifact now drives the Release **HIGHLIGHTS
TOUR**. Its nine generated moments are m.30, m.62, m.169, m.212, m.260, m.292,
m.353, m.370, and m.404, in performance-time order. The player coordinator is
unchanged; this promotion replaces only its candidate-data source. The product
UI shows concise selector-derived listening reasons rather than raw detector or
selector scores. Those scores remain in the generated artifact for traceability
and in DEV review tools.

Beethoven’s Symphony No. 5, movement I was the second-work validation. Its
repeat-aware performance timeline has 626 occurrences and used zero manual
alignment anchors. The unchanged detector supplied the same Top-15 input; the
generic selector produced six diverse moments. USER listening found that this
substantially reduced the redundancy heard in the Top 15. Beethoven remains
available only in development review; it is not part of the Release catalog.

```text
MusicXML + performance → objective score analysis ──────┐
                                                         ├→ Highlight Detector → Tour Selector → Release Highlights Tour
Hauptstimme → human main-voice evidence ────────────────┤           ↑
occurrence-aware score/audio alignment → timestamps ────┘      human listening review
```

`generate:runtime-score-facts` selects only m.30, m.47, m.62, m.290, and
m.407 from a full generated manifest. This produces the 31 KiB
`src/data/generated/runtimeScoreFacts.json` bundled by the app instead of the
2.63 MiB full-score manifest.

```sh
npm run generate:runtime-score-facts -- \
  ./src/data/generated/brahms-op68-movement4-manifest.json
```

Generated facts live in `src/data/generated/`: part activity/rests, note
counts, pitch ranges, written dynamics, articulations, and texture density.
`src/data/runtimeCue.ts` merges them with selected score assets and curated
interpretation. Curated Orchestra X-Ray roles and Theme Lens relationships
remain in `src/data/orchestraXRay.ts` and `src/data/themeLens.ts`; the
generator never writes or overwrites them. Labels such as “Main Theme,”
“Alphorn Theme,” and “Climactic Return” are human-authored, and active source
parts never automatically add rows to Score Peek.

### Hauptstimme main-voice evidence

Hauptstimme annotations are a third, distinct layer: published human
judgements of the prominent melodic part. They are **CC BY-SA**, whereas the
OpenScore Orchestra score and position data are **CC0**. Their source files,
attribution, license separation, and the inspected-but-unused melody MXL are
documented in [`scores/real/hauptstimme/README.md`](scores/real/hauptstimme/README.md).

```sh
npm run generate:hauptstimme-evidence -- \
  ./scores/real/hauptstimme/Brahms_Op68_Movement4_annotations.csv \
  ./scores/real/Brahms_Op68_Movement4_positions.csv
```

The command generates `src/data/generated/hauptstimmeEvidence.json`. It
validates every annotation qstamp against the score-position table and treats
each annotation as a half-open span ending at the next distinct annotation
qstamp. `src/data/hauptstimmeEvidence.ts` can then answer which annotated part
is active at a measure's first score qstamp. It is intentionally not imported
by the Fire TV UI: annotation evidence neither changes Smart Score rows nor
replaces curated roles or Theme Lens relationships in this milestone.

## Ask the Score (Bedrock prototype)

Ask the Score is an explicit, fixed-question feature for m.62 only. It never
calls Bedrock at launch, during playback or `currentTime` updates, when a cue
changes, or when Score Peek, Theme Lens, or COMPARE opens. The Fire TV user
must select **ASK THE SCORE** before the app sends one request.

```text
Fire TV — explicit ASK THE SCORE press → HTTPS POST /ask-the-score
       → API Gateway HTTP API → Lambda → Amazon Bedrock on-demand inference
       → short grounded answer → Fire TV
```

The request contains the m.62 work/movement/measure, compact generated
objective facts, Hauptstimme evidence, and curated role labels. It never sends
MusicXML or the full-score manifest. The Lambda accepts only the fixed question
“What am I hearing here?” for m.62 and instructs Bedrock to use only this
context. It requests at most 160 output tokens and returns at most four
sentences.

The three score layers remain separate:

- **Generated MusicXML facts:** activity/rests, note counts, pitch ranges,
  dynamics, articulations, and texture density.
- **Hauptstimme evidence:** published, CC BY-SA human annotations of a main
  voice. This evidence does not automatically select Smart Score rows.
- **Curated Orchestra Lens interpretation:** roles, selected score excerpts,
  and Theme Lens relationships.

The endpoint and demo token are set only in the ignored local file
`src/config/askTheScore.demo.ts`; copy the committed
`askTheScore.demo.example.ts` after deployment. The token is sent as
`X-Orchestra-Lens-Token`; Lambda returns `401` before Bedrock for a missing or
incorrect token. This is a demo safeguard, not production authentication. AWS
credentials must remain outside the app; Lambda uses its execution role.

### Backend and deployment preparation

The deployable Lambda code and SAM template are in `backend/ask-the-score/`.
Required backend environment variables are:

```text
AWS_REGION=us-east-1          # supplied automatically by Lambda
BEDROCK_REGION=us-east-1      # optional explicit override
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
```

`BEDROCK_MODEL_ID` is configurable; the default is Amazon Nova Micro using
on-demand inference. No Provisioned Throughput resource is defined. After
explicit deployment approval, install backend dependencies, then use the
following approximate flow:

```sh
cd backend/ask-the-score
npm install
sam build
sam deploy --guided
```

Set the resulting HTTPS route in `src/config/askTheScore.demo.ts`, rebuild the TV
app, and install it in VVD. The SAM template creates an HTTP API, one Lambda
function, its least-privilege execution role (`bedrock:InvokeModel` for the
configured Nova Micro model), and a CloudWatch log group retained for seven
days. It does not create a Bedrock provisioned-throughput resource.

Client safeguards are one explicit button press, a loading state while a
request is in flight, a fixed m.62 request, and a visible error state. The
backend independently rejects other questions and measures, caps generation,
and returns a safe error response. The undeployed template caps the endpoint at
one request per second with a burst of two; it makes no automatic retries. Use
stronger authentication and abuse controls before any wider distribution.

### Real-score validation

The generator has also been run, without hand-editing the output, against the
full 24-part, 458-measure MusicXML score for Brahms's *Symphony No. 1*,
movement IV. The source is the CC0 score data in the OpenScore Orchestra
collection maintained by [Hauptstimme](https://github.com/MarkGotham/Hauptstimme);
the exact upstream path, license, retrieval date, and extraction details are in
[`scores/real/README.md`](scores/real/README.md).

```sh
npm run generate:score-manifest -- \
  ./scores/real/Brahms_Op68_Movement4.musicxml \
  ./src/data/generated/brahms-op68-movement4-manifest.json
```

The resulting `brahms-op68-movement4-manifest.json` is approximately 2.63 MiB
and includes measures 30, 62, 290, and 407. It remains objective source data;
it has not been connected to the Fire TV app or used to alter curated roles.

## Architecture

- `src/hooks/usePlayback.ts` owns Vega player initialization, media events,
  error state, and playback sampling.
- `src/hooks/scoreSynchronization.ts` and `src/hooks/useScoreSynchronization.ts`
  validate and select timeline annotations from video time.
- `src/components/VideoPlayer.tsx` renders the managed `KeplerVideoView`.
- `src/components/ScorePeek.tsx` renders reusable Smart Score and Theme Lens
  views, including the in-place comparison view.
- `src/data/smartScore.ts` maps measures to score-asset identifiers.
- `src/data/orchestraXRay.ts` stores hand-authored musical roles independently
  of the UI.
- `src/data/themeLens.ts` stores hand-authored relationships independently of
  score assets and presentation.
- `src/data/runtimeCue.ts` merges compact generated score facts with curated
  score selection, Orchestra X-Ray roles, and Theme Lens relationships.
- `src/data/hauptstimmeEvidence.ts` queries generated CC BY-SA main-voice
  evidence without changing presentation or curated interpretation.
- `src/askTheScore.ts` builds the compact m.62 request only after an explicit
  user action; `src/hooks/useAskTheScore.ts` owns its loading, success, and
  error state.
- `src/data/brahms1Movement4.ts` contains the demo cue timeline.
- `tools/generateScoreManifest.ts` parses MusicXML into objective offline score
  facts; `tools/generateRuntimeScoreFacts.ts` extracts the compact data used at
  runtime.
- `tools/generateHauptstimmeEvidence.ts` validates Hauptstimme qstamps against
  score positions and produces human-authored main-voice evidence.
- `backend/ask-the-score/` contains the independently deployable Lambda,
  mocked backend tests, and an undeployed SAM template for Ask the Score.
- `src/assets/` contains the cropped public-domain notation excerpts.
- `test/synchronization.test.ts` covers cue selection, player-control behavior,
  and resolution of Smart Score and Theme Lens data.

## References

- [IMSLP: Brahms Symphony No. 1, Op. 68](https://imslp.org/wiki/Symphony_No.1%2C_Op.68_(Brahms%2C_Johannes))
- [Hauptstimme / OpenScore Orchestra data](https://github.com/MarkGotham/Hauptstimme)
- [Amazon Vega video sample](https://github.com/AmazonAppDev/vega-video-sample)
