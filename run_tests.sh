#!/usr/bin/env bash
set -uo pipefail
REPO_ROOT="/Users/iamsundeep/sundeep_/trendstarz"
BACKEND_DIR="$REPO_ROOT/trendstarz-backend"
FRONTEND_DIR="$REPO_ROOT/trendstarz-frontend"
BACKEND_LOG="/tmp/trendstarz-backend.log"
FRONTEND_LOG="/tmp/trendstarz-frontend.log"
PLAY_OUTPUT="/tmp/trendstarz-playwright.log"

echo "Killing processes on ports 3000 and 4200 (if any)."
kill_on_port() {
  port=$1
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Port $port PIDs: $pids"
    kill -9 $pids 2>/dev/null || true
    echo "Killed: $pids"
  else
    echo "No process listening on port $port"
  fi
}
kill_on_port 3000
kill_on_port 4200

echo
echo "Starting backend (logs -> $BACKEND_LOG)"
cd "$BACKEND_DIR" || { echo "Failed to cd to $BACKEND_DIR"; exit 1; }
npm start > "$BACKEND_LOG" 2>&1 & backend_pid=$!
backend_start_status=$?
echo "BackendPID:$backend_pid"

echo
echo "Starting frontend (logs -> $FRONTEND_LOG)"
cd "$FRONTEND_DIR" || { echo "Failed to cd to $FRONTEND_DIR"; exit 1; }
npm start > "$FRONTEND_LOG" 2>&1 & frontend_pid=$!
frontend_start_status=$?
echo "FrontendPID:$frontend_pid"

echo
echo "Waiting 30 seconds for Angular to compile and start..."
sleep 30

echo
echo "Running Playwright test (output -> $PLAY_OUTPUT)"
cd "$FRONTEND_DIR" || { echo "Failed to cd to $FRONTEND_DIR"; exit 1; }
npx playwright test e2e/campaigns.spec.ts --project=chromium --reporter=list --workers=1 > "$PLAY_OUTPUT" 2>&1
playwright_status=$?
echo "Playwright exit status: $playwright_status"

echo
echo "==== SUMMARY ===="
echo "Backend PID: $backend_pid"
echo "Frontend PID: $frontend_pid"
echo "Playwright exit status: $playwright_status"

echo "=== Last 20 lines of $BACKEND_LOG ==="
tail -n 20 "$BACKEND_LOG" || echo "(tail failed)"

echo
echo "=== Last 20 lines of $FRONTEND_LOG ==="
tail -n 20 "$FRONTEND_LOG" || echo "(tail failed)"

echo
echo "=== Playwright output ($PLAY_OUTPUT) ==="
cat "$PLAY_OUTPUT" || echo "(cat failed)"
