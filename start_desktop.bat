@echo off
echo Starting Desktop App...

REM 기존 서버 종료
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

REM 서버 최소화 상태로 실행 (터미널 창 뒤에 숨김)
start /min "Backend" cmd /c "cd /d %~dp0 && py app.py"
start /min "Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

REM 서버 뜰 때까지 대기
timeout /t 4 /nobreak > nul

REM 앱 모드로 열기 (주소창 없는 독립 창 - Chrome 우선, 없으면 Edge)
set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
set EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

if exist "%CHROME%" (
    start "" "%CHROME%" --app=http://localhost:5173 --window-size=1440,900 --window-position=80,50
) else if exist "%EDGE%" (
    start "" "%EDGE%" --app=http://localhost:5173 --window-size=1440,900 --window-position=80,50
) else (
    start http://localhost:5173
)
