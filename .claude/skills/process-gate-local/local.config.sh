# Project-local process-gate overrides for akaushik.org
# Loaded by canonical scripts via:
#   source "$CLAUDE_PROJECT_DIR/.claude/skills/process-gate-local/local.config.sh"
# (Symlink at .claude/skills/process-gate points at canonical and is read-only.
#  Local config lives alongside in process-gate-local/.)

PROCESS_GATE_STACK_PROFILE="web-next"
PROCESS_GATE_CHANGELOG_FILE="docs/CHANGELOG.md"

# Test commands — adjust to match your project. Auto-detected if blank.
PROCESS_GATE_TYPECHECK_CMD=""
PROCESS_GATE_LINT_CMD=""
PROCESS_GATE_TEST_CMD=""

# PR-size thresholds (defaults: 400 / 800)
# PROCESS_GATE_PR_SIZE_LIMIT=400
# PROCESS_GATE_PR_SIZE_HARD=800

# Project EPM doc — gate warns if process-trigger paths change without it updated
# PROCESS_GATE_PROJECT_EPM="docs/EPM.md"

# Stack-profile validators (project-local scripts)
PROCESS_GATE_STACK_VALIDATORS=("validate-web-next.sh")

# After review, commit with: chore: rollout SE Core process-gate skill
