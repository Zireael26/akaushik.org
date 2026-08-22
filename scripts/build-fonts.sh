#!/usr/bin/env bash
# Rebuild the self-hosted woff2 faces in public/fonts/.
#
# Cabinet Grotesk and General Sans came from Fontshare and are checked in as
# woff2 already — this script only rebuilds the mono face, which is subset from
# the JetBrains Mono Nerd Font TTFs installed in ~/Library/Fonts.
#
# Why subset: the shipped Nerd Font is ~190 KB per weight, and roughly 900 of
# its glyphs are Font Awesome and devicon outlines this site never draws. The
# range below is latin + punctuation + arrows + two powerline glyphs — 238
# glyphs, 13.5 KB. Widen UNICODES if a stack tag ever wants a devicon
# (devicons live at U+E700-E8EF, seti at U+E5FA-E6B5); don't ship the unsubset
# file.
#
# Usage: scripts/build-fonts.sh [path-to-fonts-dir]
set -euo pipefail

SRC="${1:-$HOME/Library/Fonts}"
OUT="public/fonts"

UNICODES="U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201D,U+2022,U+2026,U+2030,U+2039-203A,U+2044,U+20AC,U+2122,U+2190-2193,U+2212,U+25A0,U+25AA,U+E0A0,U+E0B0,U+FEFF,U+FFFD"

if ! command -v pyftsubset >/dev/null 2>&1; then
  echo "pyftsubset not found. Install with: pip install 'fonttools[woff]' brotli" >&2
  exit 1
fi

for pair in "Regular:400" "Medium:500"; do
  style="${pair%%:*}"
  weight="${pair##*:}"
  in="$SRC/JetBrainsMonoNerdFont-$style.ttf"
  [ -f "$in" ] || { echo "missing: $in" >&2; exit 1; }
  pyftsubset "$in" \
    --output-file="$OUT/jetbrains-mono-nerd-$weight.woff2" \
    --flavor=woff2 \
    --layout-features='kern' \
    --unicodes="$UNICODES" \
    --desubroutinize
  printf '%s -> %s\n' "$(basename "$in")" "$OUT/jetbrains-mono-nerd-$weight.woff2"
done
