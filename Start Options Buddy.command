#!/bin/bash

# Options Buddy Launcher
# Double-click this file to start the app

cd "$(dirname "$0")"

echo "========================================="
echo "       Starting Options Buddy..."
echo "========================================="
echo ""

# Kill any existing processes on our ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Start backend
echo "Starting backend server..."
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

# Wait a moment then open browser
sleep 3
echo ""
echo "========================================="
echo "  Options Buddy is running!"
echo "  Opening http://localhost:3000"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop the app"
echo ""

open http://localhost:3000

# Wait for user to stop
wait
