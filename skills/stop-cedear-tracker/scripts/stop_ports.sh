#!/bin/bash
# Script to stop the CEDEAR Tracker processes by killing anything on ports 3001 and 5173

PORTS=("3001" "5173")

for PORT in "${PORTS[@]}"; do
  echo "Checking port $PORT..."
  PID=$(lsof -t -i :$PORT)
  if [ -n "$PID" ]; then
    echo "Found process $PID on port $PORT. Killing..."
    kill -9 $PID
    if [ $? -eq 0 ]; then
      echo "✅ Successfully stopped process on port $PORT."
    else
      echo "❌ Failed to stop process on port $PORT."
    fi
  else
    echo "ℹ️ No process found on port $PORT."
  fi
done
