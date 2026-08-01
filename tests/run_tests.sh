#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
VENV="$SCRIPT_DIR/.venv"
REPORTS="$SCRIPT_DIR/reports"
mkdir -p "$REPORTS"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERR]${NC}  $*"; }

# ── wait for a server ─────────────────────────────────────────────────────────
wait_for() {
  local url=$1 name=$2 tries=0
  info "Waiting for $name at $url..."
  until curl -sf "$url" > /dev/null 2>&1; do
    tries=$((tries+1))
    if [ $tries -ge 30 ]; then error "$name not reachable after 30s"; exit 1; fi
    sleep 1
  done
  info "$name is up"
}

# ── check servers ─────────────────────────────────────────────────────────────
wait_for "http://localhost:3001/api/v1/settings/restaurant/pandas-kitchen/public" "API"
wait_for "http://localhost:3003" "Customer Web"
wait_for "http://localhost:3000" "Admin"

SUITE="${1:-all}"   # all | api | e2e | regression

RF_ARGS="--outputdir $REPORTS/robot --loglevel INFO"

run_api_tests() {
  info "Running Robot Framework API tests..."
  "$VENV/bin/robot" $RF_ARGS \
    --name "Pandas Kitchen API" \
    --report robot_report.html \
    --log robot_log.html \
    --output robot_output.xml \
    "$SCRIPT_DIR/api/" && info "API tests PASSED" || warn "API tests had failures"
}

run_e2e_tests() {
  info "Running Playwright E2E tests..."
  cd "$ROOT"
  npx playwright test --reporter=list,html 2>&1 | tee "$REPORTS/playwright_stdout.txt"
  info "E2E tests complete. Report: tests/reports/playwright-html/index.html"
}

case $SUITE in
  api)        run_api_tests ;;
  e2e)        run_e2e_tests ;;
  regression) "$VENV/bin/robot" $RF_ARGS --include regression "$SCRIPT_DIR/api/" ;;
  all)        run_api_tests; run_e2e_tests ;;
esac

info "Done. Reports in $REPORTS/"
