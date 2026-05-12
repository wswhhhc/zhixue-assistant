@echo off
cd /d "%~dp0"
echo [start] rebuilding and starting services...
docker compose up -d --build
echo [start] app is running at http://localhost:8000
