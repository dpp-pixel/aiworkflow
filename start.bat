@echo off
echo Starting My Project...
echo.

REM 기존에 실행 중인 서버 종료 (포트 충돌 방지)
echo [0/2] Stopping existing servers...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING" 2^>nul') do (
    echo   Killing PID %%p on port 8001...
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do (
    echo   Killing PID %%p on port 5173...
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

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
echo Frontend: http://localhost:5173
echo ========================================

REM 브라우저 자동 열기 (프론트엔드가 뜰 때까지 잠깐 대기)
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo Press any key to exit this window (servers will keep running)
pause > nul
