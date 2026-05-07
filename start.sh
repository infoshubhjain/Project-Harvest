#!/bin/bash
# start.sh — start backend (:3000) and webapp dev server (:5173) concurrently.
# Press Ctrl+C to stop both processes cleanly.

# Kill all background jobs spawned by this script on exit.
cleanup() {
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

# Auto-run setup if either node_modules directory is missing.
if [ ! -d "Backend/node_modules" ] || [ ! -d "webapp/node_modules" ]; then
    echo "Dependencies missing — running setup first..."
    ./setup_dev.sh
fi

echo "Starting backend on http://localhost:3000 ..."
cd Backend && npm start &
cd ..

echo "Starting webapp on http://localhost:5173 ..."
# --host makes the dev server reachable from other devices on the local network.
cd webapp && npm run dev -- --host &
cd ..

sleep 2
# Open the browser automatically on macOS; silently skip on Linux (open not available).
open http://localhost:5173 2>/dev/null || true

echo "Press Ctrl+C to stop both servers."
wait
