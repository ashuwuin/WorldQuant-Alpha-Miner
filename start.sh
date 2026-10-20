#!/usr/bin/env bash
# ==============================================================================
# Quantum Alpha Portal - Launch Script
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"

# Detect or auto-create Python virtualenv
if [ ! -d "$DIR/venv" ] && [ ! -d "$DIR/.venv" ]; then
    echo "[*] No virtualenv found. Bootstrapping isolated 'venv'..."
    python3 -m venv "$DIR/venv"
    source "$DIR/venv/bin/activate"
    echo "[*] Installing dependencies from requirements.txt..."
    pip install --upgrade pip
    pip install -r "$DIR/requirements.txt"
elif [ -d "$DIR/venv" ]; then
    source "$DIR/venv/bin/activate"
elif [ -d "$DIR/.venv" ]; then
    source "$DIR/.venv/bin/activate"
fi

if [ ! -f "$DIR/web/static/ui/app.js" ] || [ ! -f "$DIR/web/static/ui/app.css" ]; then
    if ! command -v npm >/dev/null 2>&1; then
        echo "[!] Frontend bundle missing and npm is unavailable. Install Node.js, then run: cd frontend && npm ci && npm run build" >&2
        exit 1
    fi
    echo "[*] Building the local interface..."
    (cd "$DIR/frontend" && npm ci && npm run build)
fi

echo "=========================================================="
echo "⚡ Starting Quantum Alpha Portal"
echo "🌐 URL: http://$HOST:$PORT"
echo "📂 Directory: $DIR"
echo "=========================================================="

if [ "$DEV_MODE" = "1" ]; then
    echo "[*] Dev mode active: watching 'web' directory only (excluding DB)..."
    python3 -m uvicorn web.server:app --host "$HOST" --port "$PORT" --reload --reload-dir "$DIR/web" --reload-exclude "*.db*"
else
    python3 -m uvicorn web.server:app --host "$HOST" --port "$PORT"
fi
