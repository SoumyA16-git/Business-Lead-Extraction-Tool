@echo off
title Clipboard Typer
color 0B
echo.
echo ==========================================
echo   Clipboard Typer - SMART MODE TOGGLE
echo ==========================================
echo.
echo   1. Copy text
echo   2. Click where you want to type
echo   3. Tap CTRL 3 times to switch IDE/Terminal mode
echo   4. Tap CTRL 2 times to start typing
echo.
echo   (Press ESC to abort typing)
echo ==========================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0typer_core.ps1"
pause
