@echo off
rem Starts the trainer's local auto-save server in the background (no console
rem window) and opens it in your browser. Safe to double-click again: if the
rem server is already running it only opens the page.
cd /d "%~dp0"
where pythonw >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw server.py
) else (
  start "" /min python server.py
)
