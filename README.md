# Orchestra Lens — non-AI prototype

Orchestra Lens is a React Native TV prototype for Amazon Vega OS. It plays a
known-working HTTPS MP4 and uses the video clock to select hand-authored Brahms
score cues. Score Peek presents real public-domain excerpts from the IMSLP score
alongside manually authored musical context. No Bedrock, generative AI, automatic
theme detection, or automatic score analysis is implemented.

## Implemented milestones

- **Playback and synchronization:** `KeplerVideoView` and the Vega W3C
  `VideoPlayer` play the HTTPS MP4. `currentTime` selects the active score cue;
  seeking, pausing, and buffering do not advance a separate wall-clock timer.
- **m.30 Smart Score / Orchestra X-Ray:** Horn, Flute, and Strings excerpts,
  with the roles Main Theme, Upcoming Theme Handoff, and Harmonic Support.
- **m.62 Smart Score:** Violins, Lower Strings, and Horn excerpts show the start
  of the main Allegro theme.
- **m.285 Theme Lens:** a horn excerpt relates the transformed return to the
  m.30 Alphorn Theme. COMPARE shows both real excerpts in an in-place view.
- **m.407 Theme Lens:** a climactic chorale excerpt relates back to m.47.
  COMPARE shows the m.47 and m.407 excerpts in the same in-place view.

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

1. Launch the app and confirm the main playback screen shows Orchestra Lens,
   Brahms Symphony No. 1, transport controls, current cue, and playback time.
2. Use **SCORE** during the placeholder cue windows below.
3. Use **BACK** or the VVD remote Back button to return to playback. The player
   remains mounted, preserving time, pause state, and the active cue.
4. At m.285 and m.407, select **COMPARE**. It replaces the Theme Lens body in
   place; **BACK** returns to that cue's Theme Lens without resetting playback.

| Demo seconds | Cue | Score Peek content |
| --- | --- | --- |
| 5–20 | m.30 | Smart Score and Orchestra X-Ray |
| 20–40 | m.62 | Smart Score |
| 40–60 | m.285 | Theme Lens: m.30 → m.285 |
| 60–80 | m.407 | Theme Lens: m.47 → m.407 |

The cue times are intentionally placeholder annotations for the demo video, not
timestamps for a specific Brahms recording.

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

`generate:runtime-score-facts` selects only m.30, m.47, m.62, m.285, and
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
and includes measures 30, 62, 285, and 407. It remains objective source data;
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
