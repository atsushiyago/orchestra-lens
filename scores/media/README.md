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

## Beethoven validation recording (offline only)

- **Work:** Ludwig van Beethoven, *Symphony No. 5 in C minor, Op. 67*, I.
  *Allegro con brio*
- **Source / performer information:** Musopen; the Commons file page states
  that Skidmore College Orchestra released the recording worldwide as public
  domain.
- **Source page:** https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor,_op._67_-_i._allegro_con_brio.ogg
- **Status:** public domain, as stated on that Commons file page
- **Original local analysis input:** `beethoven-op67-movement1-musopen-pd.ogg`,
  Ogg/Vorbis stereo 48 kHz, 500.088 seconds, 8,824,613 bytes.

This file is used only for the offline second-work validation. It is neither
added to the Fire TV app nor deployed to AWS.
