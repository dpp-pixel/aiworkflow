@echo off
echo Starting Desktop App...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

start /min "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

cd /d %~dp0
echo Running: py desktop.py
py desktop.py
if errorlevel 1 (
    echo.
    echo Error! exitcode=%errorlevel%
    pause
)
