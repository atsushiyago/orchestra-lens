# Beethoven, Op. 67/I — repeat-aware unconstrained alignment

**Status: numerically healthy.**

The first run used one timestamp for every authored measure. It exposed a
102.656-second jump from written m.124 to m.125 because the score repeats its
opening section. The revised performance timeline expands the MusicXML repeat
into **626 performed measure occurrences** while retaining the 502 written
measures and occurrence indices.

The source has a backward repeat at m.124, an implicit forward boundary at the
movement start, no `times` attribute, and no first/second endings. The
expanded sequence performs m.1–124 twice, then continues m.125–502. The audio
alignment uses that occurrence sequence and no manual anchors.

- first occurrence: 0.986s
- last occurrence: 500.000s within the 500.088s recording
- strict monotonicity: true
- collapsed occurrence pairs: 0
- maximum adjacent occurrence increment: 6.928s
- deterministic repeat run: byte-identical JSON

The recording therefore has timing consistent with the score's written repeat.
The prior m.124→m.125 discontinuity is absent; the transition is now m.124
occurrence 1 → m.1 occurrence 2 → … → m.124 occurrence 2 → m.125 occurrence
1.

See `beethoven-op67-movement1-performance-alignment-report.json` for the
machine-readable diagnostics and
`beethoven-op67-movement1-highlights.md` for the unchanged detector output.
