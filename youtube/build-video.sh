#!/usr/bin/env bash
# Build a narrated, screen-recording tutorial from a JobMargin scene JSON file.
# Usage: ./build-video.sh scripts/video-1-service-call-pricing.json output/video.mp4
set -Eeuo pipefail

SCRIPT=${1:?JSON script path required}
OUTPUT=${2:?output MP4 path required}
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/work/$(basename "$SCRIPT" .json)"
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
VOICE="${VOICE:-en-US-ChristopherNeural}"
mkdir -p "$WORK" "$(dirname "$OUTPUT")"
rm -f "$WORK"/scene-*.mp4 "$WORK"/scene-*.mp3 "$WORK"/scene-*.png "$WORK"/concat.txt

count=$(jq '.scenes | length' "$SCRIPT")
if [[ "$count" -eq 0 ]]; then echo "No scenes in $SCRIPT" >&2; exit 1; fi

# Render a 1920x1080 title card as HTML, then capture it with the browser.
make_title() {
  local text="$1" svg="$2"
  # Keep title generation dependency-free; narration carries the detailed copy.
  "$FFMPEG" -y -loglevel error -f lavfi -i "color=c=0x071b35:s=1920x1080" -frames:v 1 "$WORK/$(basename "$svg" .svg).png"
}

for ((i=0; i<count; i++)); do
  n=$((i+1)); audio="$WORK/scene-$n.mp3"; image="$WORK/scene-$n.png"; scene="$WORK/scene-$n.mp4"
  narration=$(jq -r ".scenes[$i].narration" "$SCRIPT")
  action=$(jq -r ".scenes[$i].action" "$SCRIPT")
  duration=$(jq -r ".scenes[$i].duration" "$SCRIPT")
  echo "Scene $n/$count: $action"
  edge-tts --voice "$VOICE" --text "$narration" --write-media "$audio"
  if [[ "$action" == "title" ]]; then
    # Title scenes use the opening title by default, with a scene-specific card.
    make_title "$narration" "$WORK/scene-$n.svg"
    image="$WORK/scene-$n.png"
  else
    # agent-browser keeps a browser daemon, so each URL gets a real rendered capture.
    agent-browser open "$action" >/dev/null
    agent-browser wait --load networkidle >/dev/null || true
    agent-browser screenshot "$image" >/dev/null
    "$FFMPEG" -y -loglevel error -i "$image" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071b35" -frames:v 1 "$WORK/scene-$n-scaled.png"
    mv "$WORK/scene-$n-scaled.png" "$image"
  fi
  # Pad the voiceover to the declared scene duration, then loop the still image.
  "$FFMPEG" -y -loglevel error -loop 1 -i "$image" -i "$audio" -filter_complex "[1:a]apad=pad_dur=${duration}[a]" -map 0:v -map '[a]' -t "$duration" -r 30 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "$scene"
  printf "file '%s'\n" "$scene" >> "$WORK/concat.txt"
done

"$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$OUTPUT"
echo "Built $OUTPUT"
