#!/bin/sh

set -eu

SHARED_INFRA_ROOT=${SHARED_INFRA_ROOT:-"$HOME/projects/shared-infra"}

if [ ! -d "$SHARED_INFRA_ROOT" ]; then
  printf '%s\n' "error: shared infrastructure directory not found: $SHARED_INFRA_ROOT" >&2
  exit 1
fi

exec make -C "$SHARED_INFRA_ROOT" preflight PROJECT=akaushik.org
