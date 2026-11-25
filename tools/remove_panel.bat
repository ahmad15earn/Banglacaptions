@echo off
for /d %%D in ("%ProgramFiles%\Adobe\Adobe After Effects*") do (
  if exist "%%D\Support Files\Scripts\ScriptUI Panels\BanglaCaption.jsx" (
    del /F /Q "%%D\Support Files\Scripts\ScriptUI Panels\BanglaCaption.jsx" && echo Removed from: %%D
  )
)
pause
