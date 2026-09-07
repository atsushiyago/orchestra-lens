# Verovio Smart Score production prototype

Renderer: Verovio 6.3.0-425dd7b (LGPL-3.0-or-later), invoked locally through the official npm WASM toolkit.

## Generic TV layout

`{"pageWidth":1200,"pageHeight":500,"pageMarginLeft":14,"pageMarginRight":14,"pageMarginTop":12,"pageMarginBottom":12,"scale":55,"breaks":"none","adjustPageHeight":true,"footer":"none","header":"none","svgViewBox":true}`

Tradeoff: `breaks: none` favors one compact system per cue and uses the full 1200px page width. Dense passages remain structurally within the overlay target, but final distance-readability is a human visual decision.

## Cue results

### m.1 — STRINGS TAKE THE LEAD

Timestamp: 0.600s

Staves: Violin 1, Violin 2, Viola, Violoncello

Window: m.1–3

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 770 460.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim. Excerpt boundary intersects one or more MusicXML slurs; Verovio retains the in-window notation and may warn about the open boundary.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

### m.30 — BRASS TAKE THE LEAD

Timestamp: 126.360s

Staves: C Horn 1, Trombone 1, Trombone 2, Trombone 3

Window: m.29–32

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 825 434.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim. Excerpt boundary intersects one or more MusicXML ties; Verovio retains the in-window notation and may warn about the open boundary.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

### m.38 — WOODWINDS TAKE THE LEAD

Timestamp: 165.800s

Staves: Flute 1, Bassoon 1, Bb Clarinet 1, Bb Clarinet 2

Window: m.37–40

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 830 439.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim. Excerpt boundary intersects one or more MusicXML ties; Verovio retains the in-window notation and may warn about the open boundary. Excerpt boundary intersects one or more MusicXML slurs; Verovio retains the in-window notation and may warn about the open boundary.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

### m.97 — STRINGS TAKE THE LEAD

Timestamp: 343.639s

Staves: Violin 1, Viola, Contrabass, Violin 2

Window: m.96–99

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 995 498.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

### m.280 — WOODWINDS TAKE THE LEAD

Timestamp: 676.493s

Staves: Flute 1, Flute 2, Bassoon 1, Bassoon 2

Window: m.279–282

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 1038 495.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

### m.404 — WOODWINDS TAKE THE LEAD

Timestamp: 942.830s

Staves: Flute 1, Flute 2, Oboe 1, Oboe 2

Window: m.403–406

Layout: STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED; 1 system(s), viewBox 0 0 812 474.

Extraction: Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim.

Complexity: No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.

