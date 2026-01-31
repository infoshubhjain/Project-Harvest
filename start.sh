#!/bin/bash

# start.sh
# Starts the Backend and Frontend servers concurrently

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "================================================================================"
echo "🚀 Starting Project-Harvest"
echo "================================================================================"

# Check if setup has been run (look for node_modules)
# We also check if requirements are met roughly.
if [ ! -d "Backend/node_modules" ] || [ ! -d "webapp/node_modules" ]; then
    echo "⚠️  Dependencies not found. Running setup first..."
    ./setup_dev.sh
else
    echo "✅ Dependencies look present. "
fi

echo "🟢 Starting Backend on port 3000..."
cd Backend
npm start &
BACKEND_PID=$!
cd ..

echo "🟢 Starting Webapp..."
cd webapp
# Use --host to ensure it binds accessible
npm run dev -- --host &
WEBAPP_PID=$!
cd ..

echo "⏳ Waiting for servers to initialize..."
sleep 3

echo "================================================================================"
echo "🌐 App should be running at: http://localhost:5173"
echo "🌐 Backend is running at:    http://localhost:3000"
echo "================================================================================"
echo "Use Ctrl+C to stop both servers."

# 5173 is the default Vite port. Adjust if different.
open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 in your browser."

wait
