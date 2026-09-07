# Hauptstimme source: Brahms, Symphony No. 1, movement IV

This directory contains human-authored annotation data from the
[Hauptstimme](https://github.com/MarkGotham/Hauptstimme) / OpenScore Orchestra
repository. The upstream README licenses **annotations under CC BY-SA**. This
license is separate from the CC0 score data documented in the parent
directory; downstream reuse of these annotation files and derived evidence
must preserve the applicable CC BY-SA attribution and share-alike terms.

Retrieved on 2026-09-07 from:

```text
data/Brahms,_Johannes/Symphony_No.1,_Op.68/4/
```

Included source data:

- `Brahms_Op68_Movement4_annotations.csv`: authoritative annotation starts,
  with qstamp, score measure/beat, label, part, part number, and instrument.
- `Brahms_Op68_Movement4_part_relations.csv`: upstream derived relations for
  each annotation span, including its `Main Part` marker and relationships to
  other score parts.

Inspected but not needed by the current parser: the upstream
`Brahms_Op.68_4_melody.mxl`, a derived single-stave score that stitches
annotated melody segments together. The CSV annotations are the canonical
machine-readable input for this repository's evidence generator.

`src/data/generated/hauptstimmeEvidence.json` is generated without manual
editing by `tools/generateHauptstimmeEvidence.ts`. Its qstamp-to-measure mapping
is checked against the CC0 `../Brahms_Op68_Movement4_positions.csv` table.

## Beethoven validation annotations

`beethoven-op67-movement1/` contains the upstream `Beethoven_Op.67_1_annotations.csv`
and `Beethoven_Op.67_1_part_relations.csv` from:

```text
data/Beethoven,_Ludwig_van/Symphony_No.5,_Op.67/1/
```

They remain human-authored Hauptstimme material under the upstream **CC BY-SA**
terms, separate from the CC0 Beethoven score and position data. The MXL and
the upstream compressed measure map are retained for source traceability.
The generated `beethoven-op67-movement1-hauptstimme-evidence.json` preserves
the annotation CSV's continuous measure field because a repeat-expanded
position stream can reuse displayed measure labels and omit silent barlines.
