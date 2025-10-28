@echo off
echo Starting My Project...
echo.

REM Backend (FastAPI)
echo [1/2] Starting Backend (FastAPI)...
start "Backend - FastAPI" cmd /k "cd /d %~dp0 && py app.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Frontend (Vite)
echo [2/2] Starting Frontend (Vite)...
start "Frontend - Vite" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting...
echo Backend: http://localhost:8001
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window (servers will keep running)
pause > nul
