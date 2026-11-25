@echo off
setlocal
title Bangla Caption - uninstall
echo This removes the panel from After Effects and deletes %APPDATA%\BanglaCaption
echo (Python environment, downloaded models, settings files).
choice /M "Continue"
if errorlevel 2 exit /b 0
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0tools\remove_panel.bat' -Verb RunAs -Wait"
if exist "%APPDATA%\BanglaCaption" rmdir /S /Q "%APPDATA%\BanglaCaption"
if exist "%TEMP%\BanglaCaption" rmdir /S /Q "%TEMP%\BanglaCaption"
echo Done.
pause
