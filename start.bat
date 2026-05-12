@echo off
cd /d "%~dp0"

echo [1/3] Starting backend (FastAPI :8000)...
start "Backend" cmd /c "cd /d "%~dp0backend" && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/3] Starting frontend (Vite :5173)...
start "Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Close all windows to stop.
echo.
pause
