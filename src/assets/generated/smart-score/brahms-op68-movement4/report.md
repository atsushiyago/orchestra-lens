## Before / after technical summary

| Area | V1 | V2 |
| --- | --- | --- |
| Cue/staff consistency | No validation | Deterministic family validation; neutral labels when unsupported |
| Clefs | None | MusicXML clefs, including G/F/C contexts |
| Key and meter | None | Written key/time signatures and in-window changes |
| Rhythm | Stems only | MusicXML beam groups (including secondary beams) |
| Connections | None | Explicit MusicXML ties across rendered measures |
| Expression | None | Basic p/pp/mp/mf/f/ff, staccato, accent |
| Limitations | Implicit | Multiple voices and tuplets detected and reported |

Pitch policy: source MusicXML written pitches are rendered unchanged; transposition metadata is reported only.

## Per-cue validation

### m.1

Consistency: PASS — STRINGS provides 4/4 displayed staves.

Unsupported notation: None detected.

### m.30

Consistency: PASS — BRASS provides 4/4 displayed staves.

Unsupported notation: None detected.

### m.38

Consistency: PASS — WOODWINDS provides 4/4 displayed staves.

Unsupported notation: None detected.

### m.97

Consistency: PASS — STRINGS provides 4/4 displayed staves.

Unsupported notation: None detected.

### m.280

Consistency: PASS — WOODWINDS provides 4/4 displayed staves.

Unsupported notation: None detected.

### m.404

Consistency: PASS — WOODWINDS provides 4/4 displayed staves.

Unsupported notation: None detected.
