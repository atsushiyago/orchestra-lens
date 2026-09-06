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
curated musical interpretation ────────────────────────────────────────┼→ merged runtime cue → Fire TV presentation
                                                                         ┘
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
- `src/data/brahms1Movement4.ts` contains the demo cue timeline.
- `tools/generateScoreManifest.ts` parses MusicXML into objective offline score
  facts; `tools/generateRuntimeScoreFacts.ts` extracts the compact data used at
  runtime.
- `src/assets/` contains the cropped public-domain notation excerpts.
- `test/synchronization.test.ts` covers cue selection, player-control behavior,
  and resolution of Smart Score and Theme Lens data.

## References

- [IMSLP: Brahms Symphony No. 1, Op. 68](https://imslp.org/wiki/Symphony_No.1%2C_Op.68_(Brahms%2C_Johannes))
- [Hauptstimme / OpenScore Orchestra data](https://github.com/MarkGotham/Hauptstimme)
- [Amazon Vega video sample](https://github.com/AmazonAppDev/vega-video-sample)
