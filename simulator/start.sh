#!/bin/sh
set -eu
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
mkdir -p /tmp/runtime-simulator
chmod 700 /tmp/runtime-simulator
export XDG_RUNTIME_DIR=/tmp/runtime-simulator
Xvfb :99 -screen 0 480x480x24 -nolisten tcp &
XVFB_PID=$!
sleep 1
x11vnc -display :99 -forever -shared -localhost -nopw -rfbport 5900 -quiet &
VNC_PID=$!
websockify 127.0.0.1:6081 localhost:5900 &
PROXY_PID=$!
python -u server.py &
SERVER_PID=$!
trap 'kill "$SERVER_PID" "$PROXY_PID" "$VNC_PID" "$XVFB_PID" 2>/dev/null || true' TERM INT EXIT
wait "$SERVER_PID"
