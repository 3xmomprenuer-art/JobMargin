#!/usr/bin/env bash
# Build a narrated title-card video from a JobMargin scene JSON file.
# Usage: ./build-video.sh scripts/video-2-markup-vs-margin.json output/video.mp4
set -Eeuo pipefail

SCRIPT=${1:?JSON script path required}
OUTPUT=${2:?output MP4 path required}
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/work/$(basename "$SCRIPT" .json)"
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
VOICE="${VOICE:-en-US-ChristopherNeural}"
mkdir -p "$WORK" "$(dirname "$OUTPUT")"
rm -f "$WORK"/scene-*.mp4 "$WORK"/scene-*.mp3 "$WORK"/scene-*.png "$WORK"/scene-*.html "$WORK"/concat.txt

count=$(jq '.scenes | length' "$SCRIPT")
if [[ "$count" -eq 0 ]]; then echo "No scenes in $SCRIPT" >&2; exit 1; fi

# Accent color palette — rotates per scene for visual variety
accents=("#60a5fa" "#f59e0b" "#34d399" "#f472b6" "#a78bfa" "#fb923c" "#38bdf8" "#4ade80")

make_title() {
  local lines_file="$1" html="$2" image="$3" accent="$4"
  local line_count
  line_count=$(wc -l < "$lines_file")
  local html_lines=""
  local i=0
  while IFS= read -r line; do
    local escaped
    escaped=$(echo "$line" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
    # Wrap dollar amounts and percentages in accent span
    escaped=$(printf '%s' "$escaped" | sed -E 's@(\$[0-9,]+(\.[0-9]+)?)@<span class="num">\1</span>@g')
    escaped=$(printf '%s' "$escaped" | sed -E 's@([0-9]+(\.[0-9]+)?%)@<span class="num">\1</span>@g')
    if [[ $i -eq 0 ]]; then
      html_lines+="<div class=\"hl\">$escaped</div>"
    else
      html_lines+="<div class=\"sub\">$escaped</div>"
    fi
    i=$((i + 1))
  done < "$lines_file"

  cat > "$html" <<HTMLEOF
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:#060e1a;color:#fff;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
.card{width:86%;padding:60px 80px;border:1px solid ${accent}44;border-radius:24px;background:linear-gradient(155deg,#0f1d32 0%,#08101e 100%);box-shadow:0 20px 60px #0006,inset 0 1px 0 ${accent}22}
.brand{color:${accent};font-size:26px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:32px;opacity:.9}
.hl{font-size:56px;line-height:1.15;font-weight:800;letter-spacing:-.03em;margin-bottom:14px;color:#fff}
.sub{font-size:32px;line-height:1.35;font-weight:500;color:#94a3b8;margin-top:8px}
.num{color:${accent};font-weight:800}
.sep{width:60px;height:3px;background:${accent};margin:20px auto;border-radius:2px}
</style></head><body><main class="card"><div class="brand">JobMargin</div><div class="sep"></div>
${html_lines}
</main></body></html>
HTMLEOF
  agent-browser open --url "file://$(realpath "$html")" || true
  agent-browser wait 1 || true
  agent-browser screenshot "$image" || true
  "$FFMPEG" -y -loglevel error -i "$image" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060e1a" -frames:v 1 "$image.scaled.png"
  mv "$image.scaled.png" "$image"
}

for ((i=0; i<count; i++)); do
  n=$((i+1)); audio="$WORK/scene-$n.mp3"; image="$WORK/scene-$n.png"; scene="$WORK/scene-$n.mp4"
  narration=$(jq -r ".scenes[$i].narration" "$SCRIPT")
  action=$(jq -r ".scenes[$i].action" "$SCRIPT")
  duration=$(jq -r ".scenes[$i].duration" "$SCRIPT")
  accent="${accents[$(( (i) % ${#accents[@]} ))]}"

  echo "Scene $n/$count: $action"

  # Generate TTS audio (with timeout in case of network issues)
  timeout 60 edge-tts --voice "$VOICE" --text "$narration" --write-media "$audio" || {
    echo "edge-tts failed for scene $n, retrying..."
    sleep 2
    timeout 60 edge-tts --voice "$VOICE" --text "$narration" --write-media "$audio"
  }

  html="$WORK/scene-$n.html"
  lines_file="$WORK/scene-$n-lines.txt"

  # Check for visual "lines" array in JSON; if present, use those for the card.
  # Otherwise fall back to narration text.
  has_lines=$(jq -r ".scenes[$i].lines // empty" "$SCRIPT")
  if [[ -n "$has_lines" ]]; then
    jq -r ".scenes[$i].lines[]" "$SCRIPT" > "$lines_file"
  else
    echo "$narration" > "$lines_file"
  fi

  if [[ "$action" == "title" ]]; then
    make_title "$lines_file" "$html" "$image" "$accent"
  else
    # For URL-type scenes, fallback to the old behavior
    make_url_fallback "$action" "$html" "$image" "$n"
    "$FFMPEG" -y -loglevel error -i "$image" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071b35" -frames:v 1 "$WORK/scene-$n-scaled.png"
    mv "$WORK/scene-$n-scaled.png" "$image"
  fi

  "$FFMPEG" -y -loglevel error -loop 1 -i "$image" -i "$audio" -filter_complex "[1:a]apad=pad_dur=${duration}[a]" -map 0:v -map '[a]' -t "$duration" -r 30 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "$scene"
  printf "file '%s'\n" "$scene" >> "$WORK/concat.txt"
done

"$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$OUTPUT"
echo "Built $OUTPUT"
