@echo off
setlocal
cd /d "%~dp0"
title Project editor

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required to run the project editor.
    echo Install it from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

echo Starting the project editor...
node tools\project-editor\server.js

if errorlevel 1 (
    echo.
    echo The project editor stopped because of an error.
    pause
)
