@echo off
REM Needs administrator rights (INSTALL.bat requests them automatically).
setlocal enabledelayedexpansion
set FOUND=0
for /d %%D in ("%ProgramFiles%\Adobe\Adobe After Effects*") do (
  if exist "%%D\Support Files\Scripts\ScriptUI Panels" (
    copy /Y "%~dp0..\panel\BanglaCaption.jsx" "%%D\Support Files\Scripts\ScriptUI Panels\" >nul && (echo Installed in: %%D & set FOUND=1)
  )
)
if "!FOUND!"=="0" echo No After Effects installation found under %ProgramFiles%\Adobe.
pause
