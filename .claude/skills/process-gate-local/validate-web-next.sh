#!/usr/bin/env bash
# Project-local web-next validator for akaushik.org.

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
failures=0

fail() {
  failures=$((failures + 1))
  printf 'web-next: FAIL %s\n' "$*"
}

ok() {
  printf 'web-next: ok %s\n' "$*"
}

require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    fail "missing required file: $1"
  fi
}

reject_grep() {
  local pattern="$1"; shift
  local label="$1"; shift
  local hit
  hit="$(grep -RInE "$pattern" "$@" 2>/dev/null || true)"
  if [ -n "$hit" ]; then
    fail "$label"$'\n'"$hit"
  fi
}

require_file "proxy.ts"
if [ -f "$ROOT/middleware.ts" ]; then
  fail "middleware.ts exists; Next 16 convention is proxy.ts"
fi
if ! grep -q "export function proxy" "$ROOT/proxy.ts" 2>/dev/null; then
  fail "proxy.ts must export function proxy"
fi

if [ -d "$ROOT/.github/workflows" ]; then
  while IFS= read -r line; do
    ref="${line##*@}"
    if ! printf '%s' "$ref" | grep -Eq '^[0-9a-f]{40}$'; then
      fail "mutable GitHub Action ref: $line"
    fi
  done < <(grep -RInE 'uses:[[:space:]]+[^[:space:]]+@' "$ROOT/.github/workflows" 2>/dev/null || true)
fi

if ! grep -q '^_reference/' "$ROOT/.semgrepignore" 2>/dev/null; then
  fail ".semgrepignore must exclude read-only _reference/"
fi
if ! grep -q 'minimum-release-age=10080' "$ROOT/.npmrc" 2>/dev/null; then
  fail ".npmrc must declare minimum-release-age=10080"
fi
if ! grep -q 'min-release-age=7' "$ROOT/.npmrc" 2>/dev/null; then
  fail ".npmrc must declare npm min-release-age=7"
fi
if ! grep -q 'minimumReleaseAge: 10080' "$ROOT/pnpm-workspace.yaml" 2>/dev/null; then
  fail "pnpm-workspace.yaml must declare minimumReleaseAge: 10080"
fi
if ! grep -q "'coverage/\\*\\*'" "$ROOT/eslint.config.js" 2>/dev/null; then
  fail "eslint.config.js must ignore coverage/**"
fi

reject_grep "postMessage\\(.*['\"]\\*['\"]" "wildcard postMessage in active source" "$ROOT/components" "$ROOT/app"
reject_grep 'THREE\.Clock' "deprecated THREE.Clock in active components" "$ROOT/components"
reject_grep 'href="#"' "placeholder href in active UI" "$ROOT/components" "$ROOT/app"
reject_grep 'chromium-mobile' "Playwright mobile project mislabeled as chromium-mobile" "$ROOT/playwright.config.ts" "$ROOT/.github/workflows"

for doc in README.md CLAUDE.md docs/PRD.md docs/DESIGN_DIRECTION.md docs/BUNDLE_BUDGET.md docs/ROADMAP.md; do
  if [ -f "$ROOT/$doc" ] && grep -Eiq 'react-three-fiber|@react-three/fiber|@react-three/drei|(^|[^a-z])drei([^a-z]|$)|(^|[^a-z])r3f([^a-z]|$)' "$ROOT/$doc"; then
    fail "current-facing doc still references the removed R3F/drei stack: $doc"
  fi
done

if grep -Eq 'app/robots\.ts|middleware\.ts' "$ROOT/docs/AGENT_READINESS.md" 2>/dev/null; then
  fail "AGENT_READINESS must point at app/robots.txt/route.ts and proxy.ts"
fi
if grep -q 'co-serves 200' "$ROOT/docs/seo/STATUS.md" 2>/dev/null; then
  fail "SEO STATUS still claims akaushik.dev co-serves 200"
fi
if grep -q 'Cloudflare: disable "Manage robots.txt"' "$ROOT/docs/seo/STATUS.md" 2>/dev/null; then
  fail "SEO STATUS still lists resolved Cloudflare robots handoff as pending"
fi

if ! cmp -s "$ROOT/.claude/primers/INDEX.md" "$ROOT/.agents/primers/INDEX.md"; then
  fail "Codex and Claude primer indexes differ"
fi
while IFS= read -r slug; do
  [ -z "$slug" ] && continue
  if [ ! -f "$ROOT/.claude/primers/$slug.md" ]; then
    fail "missing Claude primer file for $slug"
  fi
  if [ ! -f "$ROOT/.agents/primers/$slug.md" ]; then
    fail "missing Codex primer file for $slug"
  fi
done < <(grep -Eo '^\- \[[^]]+\]' "$ROOT/.claude/primers/INDEX.md" 2>/dev/null | grep -v '<slug>' | sed -E 's/^- \[([^]]+)\]/\1/')

if [ "$failures" -eq 0 ]; then
  ok "project-specific web-next checks passed"
  exit 0
fi

exit 1
