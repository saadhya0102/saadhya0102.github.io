@echo off
setlocal
cd /d "%~dp0"
title Book editor

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required to run the book editor.
    echo Install it from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

echo Starting the book editor...
node tools\book-editor\server.js

if errorlevel 1 (
    echo.
    echo The book editor stopped because of an error.
    pause
)
