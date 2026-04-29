@echo off
echo ========================================
echo  Internet Deploy (Public Access)
echo ========================================
echo.

REM 기존 서버 종료
echo [0/3] Stopping existing servers...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

REM 프론트엔드 빌드
echo [1/3] Building frontend...
cd /d %~dp0frontend
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Frontend build failed! Check npm errors above.
    pause
    exit /b 1
)
cd /d %~dp0
echo  Done.
echo.

REM 백엔드 실행 (빌드된 프론트엔드 포함해서 8001 하나만)
echo [2/3] Starting backend (serves frontend + API on :8001)...
start "Backend" cmd /k "cd /d %~dp0 && py app.py"
timeout /t 3 /nobreak > nul

REM 외부 터널 열기
echo [3/3] Opening public tunnel...
echo.
echo ========================================
echo  Tunnel URL이 아래 창에 표시됩니다.
echo  표시된 URL에 /ui 붙여서 접속하세요.
echo  예) https://abc-123.loca.lt/ui
echo ========================================
echo.
start "Public Tunnel" cmd /k "npx localtunnel --port 8001"

pause > nul
