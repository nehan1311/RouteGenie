@echo off
cd /d "%~dp0"
echo Starting RouteGenie backend from: %CD%
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
