#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Original H.264 Baseline + AAC-LC calibration footage, not Brahms media.
ffmpeg -hide_banner -loglevel error -f lavfi \
  -i 'testsrc2=size=1280x720:rate=24:duration=90' \
  -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=90' \
  -c:v libx264 -profile:v baseline -level:v 3.1 -preset ultrafast -crf 28 -pix_fmt yuv420p \
  -c:a aac -profile:a aac_low -b:a 128k -movflags +faststart -shortest \
  -y assets/demo-h264-aac.mp4
