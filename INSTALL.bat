@echo off
REM Portable install (no .exe): engine for the current user + panel for every installed After Effects.
cd /d "%~dp0"
call "%~dp0tools\setup_engine.bat" "%~dp0"
echo Installing the After Effects panel - asks for administrator rights ...
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0tools\install_panel.bat' -Verb RunAs -Wait"
echo Done.
pause
