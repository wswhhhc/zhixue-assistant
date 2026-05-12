@echo off
cd /d "%~dp0"
echo [stop] stopping services...
docker compose down
echo [stop] done
