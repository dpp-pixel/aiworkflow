@echo off
echo ========================================
echo Starting My Project (Desktop Mode)
echo ========================================
echo.

REM Frontend (Vite) - 백그라운드에서 실행
echo [1/2] Starting Frontend (Vite)...
start "Frontend - Vite" cmd /k "cd /d %~dp0\frontend && npm run dev"

REM Wait for frontend to initialize
echo Waiting for Vite to start...
timeout /t 5 /nobreak > nul

REM Desktop App (PyWebView + FastAPI)
echo.
echo [2/2] Starting Desktop App...
echo.
echo ========================================
echo Desktop App is starting...
echo Frontend: http://localhost:5173
echo Backend: http://127.0.0.1:8001
echo ========================================
echo.
echo Desktop app will wait for servers to be ready...
echo If the window doesn't open, check the Vite terminal.
echo.

cd /d %~dp0
py desktop.py
