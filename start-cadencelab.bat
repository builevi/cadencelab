@echo off
title CadenceLab Desktop (Local Offline Runner)
cd /d "%~dp0"

echo ==================================================
echo     CadenceLab Desktop (Local Offline Runner)     
echo ==================================================
echo.

echo [1/3] Khoi dong FastAPI Backend tren cong 8000...
start /b cmd /c "uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

echo [2/3] Khoi dong Giao dien Next.js tren cong 3000...
cd apps\web
start /b cmd /c "npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Dang mo trinh duyet tai http://localhost:3000 ...
start http://localhost:3000

echo.
echo CadenceLab dang chay tai http://localhost:3000
echo Nhan Ctrl+C hoac dong cua so de thoat.
pause
