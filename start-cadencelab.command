#!/bin/bash
# CadenceLab Desktop Launcher for macOS
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=================================================="
echo "    CadenceLab Desktop (Local Offline Runner)    "
echo "=================================================="
echo ""

# Check python / uv
if command -v uv &> /dev/null; then
    echo "[1/3] Khởi động FastAPI Backend trên cổng 8000..."
    uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
else
    echo "[1/3] Khởi động FastAPI Backend bằng python3..."
    python3 -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
fi

# Wait 2 seconds for backend to start
sleep 2

echo "[2/3] Khởi động Giao diện Next.js trên cổng 3000..."
cd apps/web
npm run dev &
FRONTEND_PID=$!

sleep 3
echo "[3/3] Đang mở trình duyệt tại http://localhost:3000 ..."
open "http://localhost:3000"

echo ""
echo "CadenceLab đang chạy cục bộ tại http://localhost:3000"
echo "Nhấn Ctrl+C để dừng tất cả dịch vụ."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
