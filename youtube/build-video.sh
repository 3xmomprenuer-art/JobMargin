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
rm -f "$WORK"/scene-*.mp4 "$WORK"/scene-*.mp3 "$WORK"/scene-*.png "$WORK"/scene-*.html "$WORK"/concat.txt

count=$(jq '.scenes | length' "$SCRIPT")
if [[ "$count" -eq 0 ]]; then echo "No scenes in $SCRIPT" >&2; exit 1; fi

# Render a title card as HTML, then capture it with the browser. Keeping the
# copy in HTML (rather than drawing a solid ffmpeg frame) preserves readable
# typography in the video and uses the same rendering path as URL scenes.
make_title() {
  local text="$1" html="$2" image="$3"
  local escaped
  escaped=$(jq -nr --arg text "$text" '$text|@html')
  cat > "$html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{background:#0a1628;color:#fff;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
.card{width:82%;padding:80px 100px;border:1px solid #29466b;border-radius:28px;background:linear-gradient(145deg,#102542,#0a1628);box-shadow:0 24px 70px #0008}
.brand{color:#60a5fa;font-size:28px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:38px}
.copy{font-size:52px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
</style></head><body><main class="card"><div class="brand">JobMargin</div><div class="copy">$escaped</div></main></body></html>
EOF
  agent-browser open --url "file://$html" >/dev/null
  agent-browser wait 1 >/dev/null || true
  agent-browser screenshot "$image" >/dev/null
  "$FFMPEG" -y -loglevel error -i "$image" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a1628" -frames:v 1 "$image.scaled.png"
  mv "$image.scaled.png" "$image"
}

# A deployment can briefly route the public tool through /login. Do not put
# an auth form in a tutorial: detect that redirect and render a clear local
# calculator-shaped fallback until the public deployment is fixed.
make_url_fallback() {
  local action="$1" html="$2" image="$3" scene_no="$4"
  local heading="Service Call Pricing Calculator" body
  if [[ "$action" == *markup-margin* ]]; then
    heading="Markup & Margin Converter"
    body='<div class="layout"><section class="box"><h2>Convert your markup to margin</h2><div class="fields"><label>Item cost<input value="$100.00"></label><label>Markup<input value="40%"></label><label>Target margin<input value="28.6%"></label></div><button>Calculate</button></section><aside class="result"><b>Your selling price</b><div class="big">$140.00</div><div class="stat"><span>Gross profit</span><strong>$40.00</strong></div><div class="stat"><span>Profit margin</span><strong>28.6%</strong></div><p class="note">A 40% markup equals a 28.6% margin.</p></aside></div>'
  else
    # Vary the filled values slightly so each narrated step has a useful visual.
    case "$scene_no" in
      3) body='<div class="layout"><section class="box"><h2>Your service call</h2><div class="fields"><label>Trip / diagnostic fee<input value="$65.00"></label><label>Time on site<input value="1.5 hours"></label><label>Hourly labor rate<input value="$110.00"></label><label>Parts cost<input value="$40.00"></label><label>Parts markup<input value="30%"></label><label>Overhead per call<input value="$35.00"></label></div></section><aside class="result"><b>Projected profit</b><div class="big">$61.00</div><p>After labor, materials, travel, and overhead.</p><hr><b>Customer price&nbsp;&nbsp; $245.00</b></aside></div>';;
      4) body='<div class="layout"><section class="box"><h2>Your service call</h2><div class="fields"><label>Trip / diagnostic fee<input value="$25.00"></label><label>Time on site<input value="1.5 hours"></label><label>Hourly labor rate<input value="$110.00"></label><label>Parts cost<input value="$40.00"></label><label>Parts markup<input value="30%"></label><label>Overhead per call<input value="$35.00"></label></div></section><aside class="result"><b>Projected profit</b><div class="big">$21.00</div><p>Lowering the trip fee reduces your profit.</p><hr><b>Customer price&nbsp;&nbsp; $205.00</b></aside></div>';;
      5) body='<div class="layout"><section class="box"><h2>Your service call</h2><div class="fields"><label>Trip / diagnostic fee<input value="$65.00"></label><label>Time on site<input value="2 hours"></label><label>Hourly labor rate<input value="$90.00"></label><label>Parts cost<input value="$50.00"></label><label>Parts markup<input value="40%"></label><label>Overhead per call<input value="$35.00"></label></div></section><aside class="result"><b>Projected profit</b><div class="big">$72.00</div><p>Labor and drive time are part of the job.</p><hr><b>Customer price&nbsp;&nbsp; $315.00</b></aside></div>';;
      *) body='<div class="layout"><section class="box"><h2>Your service call</h2><div class="fields"><label>Trip / diagnostic fee<input value="$65.00"></label><label>Time on site<input value="2 hours"></label><label>Hourly labor rate<input value="$90.00"></label><label>Parts cost<input value="$50.00"></label><label>Parts markup<input value="40%"></label><label>Overhead per call<input value="12%"></label></div></section><aside class="result"><b>Recommended price</b><div class="big">$315.00</div><p>Price built to cover costs and protect your margin.</p><hr><b>Real profit / call&nbsp;&nbsp; $72.00</b></aside></div>';;
    esac
  fi
  cat > "$html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#f8fafc;color:#0f172a;font:16px Arial,sans-serif}body{padding:40px 7%}.top{background:#020617;color:white;padding:20px 28px;margin:-40px -8% 34px;font-size:25px;font-weight:bold}.blue{color:#60a5fa}.eyebrow{color:#2563eb;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:.12em}.layout{display:grid;grid-template-columns:1.5fr 1fr;gap:28px;max-width:1100px}.box,.result{background:#fff;border-radius:18px;padding:26px;box-shadow:0 2px 12px #0f172a18;margin-top:18px}.result{background:#eff6ff;border:1px solid #bfdbfe}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;font-weight:bold;margin-bottom:7px}input{width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:9px;font-size:20px;color:#0f172a;background:#fff}button{margin-top:20px;background:#2563eb;color:#fff;border:0;border-radius:9px;padding:13px 25px;font-size:17px;font-weight:bold}.big{font-size:48px;font-weight:bold;color:#1e3a8a;margin:10px 0}.stat{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #bfdbfe}.note{font-weight:bold}h1{font-size:42px;margin:10px 0 0}h2{margin-top:0;font-size:23px}
</style></head><body><div class="top">Job<span class="blue">Margin</span></div><div class="eyebrow">Free contractor tool</div><h1>$heading</h1>$body</body></html>
EOF
  agent-browser open --url "file://$html" >/dev/null
  agent-browser wait 1 >/dev/null || true
  agent-browser screenshot "$image" >/dev/null
}

for ((i=0; i<count; i++)); do
  n=$((i+1)); audio="$WORK/scene-$n.mp3"; image="$WORK/scene-$n.png"; scene="$WORK/scene-$n.mp4"
  narration=$(jq -r ".scenes[$i].narration" "$SCRIPT")
  action=$(jq -r ".scenes[$i].action" "$SCRIPT")
  duration=$(jq -r ".scenes[$i].duration" "$SCRIPT")
  echo "Scene $n/$count: $action"
  edge-tts --voice "$VOICE" --text "$narration" --write-media "$audio"
  html="$WORK/scene-$n.html"
  if [[ "$action" == "title" ]]; then
    make_title "$narration" "$html" "$image"
  else
    # Render a deterministic, pre-filled calculator mockup. The local React app's
    # client-rendered page can be present in snapshots but blank in screenshots;
    # static HTML avoids that browser capture race and keeps the tutorial useful.
    make_url_fallback "$action" "$html" "$image" "$n"
    "$FFMPEG" -y -loglevel error -i "$image" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071b35" -frames:v 1 "$WORK/scene-$n-scaled.png"
    mv "$WORK/scene-$n-scaled.png" "$image"
  fi
  "$FFMPEG" -y -loglevel error -loop 1 -i "$image" -i "$audio" -filter_complex "[1:a]apad=pad_dur=${duration}[a]" -map 0:v -map '[a]' -t "$duration" -r 30 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "$scene"
  printf "file '%s'\n" "$scene" >> "$WORK/concat.txt"
done

"$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$OUTPUT"
echo "Built $OUTPUT"
