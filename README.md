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
- `src/data/brahms1Movement4.ts` contains the demo cue timeline.
- `src/assets/` contains the cropped public-domain notation excerpts.
- `test/synchronization.test.ts` covers cue selection, player-control behavior,
  and resolution of Smart Score and Theme Lens data.

## References

- [IMSLP: Brahms Symphony No. 1, Op. 68](https://imslp.org/wiki/Symphony_No.1%2C_Op.68_(Brahms%2C_Johannes))
- [Amazon Vega video sample](https://github.com/AmazonAppDev/vega-video-sample)
