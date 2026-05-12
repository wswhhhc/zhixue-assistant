@echo off
cd /d "%~dp0"

echo Stopping backend (Python)...
taskkill /FI "WINDOWTITLE eq Backend" /F 2>nul
taskkill /FI "IMAGENAME eq python.exe" /F 2>nul

echo Stopping frontend (Node/Vite)...
taskkill /FI "WINDOWTITLE eq Frontend" /F 2>nul
taskkill /FI "IMAGENAME eq node.exe" /F 2>nul

echo.
echo All services stopped.
echo.
pause
