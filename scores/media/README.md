# Prepared Brahms demo media (local deployment input)

This directory holds local media prepared for deployment and is intentionally
ignored by Git. The checked-in application source never hotlinks the Wikimedia
Commons audio file.

## Source recording

- **Work:** Johannes Brahms, *Symphony No. 1 in C minor, Op. 68*, movement IV
  (*Adagio — Più andante — Allegro non troppo, ma con brio*)
- **Commons Summary source/author attribution:** Musopen Symphony Orchestra
  (source: Musopen, piece 1564). The file's embedded metadata separately lists
  `Author: Czech National Symphony Orchestra`; both are preserved here rather
  than resolving that attribution discrepancy by assumption.
- **Source page:** https://commons.wikimedia.org/wiki/File:Brahms,_Symphony_No._1_in_C_Minor,_Op._68_-_IV._Adagio_-_Pi%C3%B9_andante_-_Allegro_non_troppo,_ma_con_brio.ogg
- **License:** CC0 1.0 Universal Public Domain Dedication
- **Original:** `brahms-op68-movement4-musopen-cc0.ogg`, Ogg/Vorbis, stereo
  48 kHz, 1,016.928 seconds, 23,396,499 bytes.
- **Prepared deployment derivative:** `brahms-op68-movement4-musopen-cc0.m4a`,
  AAC-LC stereo 48 kHz at 192 kbps, 1,016.928 seconds, 24,801,149 bytes.

The derivative was made with stream-copy timing semantics for the source
timeline: audio was re-encoded only; no trim, resample, speed change, or edit
was applied. It exists because the previously validated Vega path is AAC/MP4,
while this Commons source is Vorbis/Ogg.
