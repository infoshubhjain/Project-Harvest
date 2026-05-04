#!/bin/bash
# start.sh — start backend (:3000) and webapp dev server (:5173) concurrently

cleanup() {
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

if [ ! -d "Backend/node_modules" ] || [ ! -d "webapp/node_modules" ]; then
    echo "Dependencies missing — running setup first..."
    ./setup_dev.sh
fi

echo "Starting backend on http://localhost:3000 ..."
cd Backend && npm start &
cd ..

echo "Starting webapp on http://localhost:5173 ..."
cd webapp && npm run dev -- --host &
cd ..

sleep 2
open http://localhost:5173 2>/dev/null || true

echo "Press Ctrl+C to stop both servers."
wait
