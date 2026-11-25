@echo off
setlocal
title Bangla Caption - installer
set "DEST=%APPDATA%\BanglaCaption"
set "VPY=%DEST%\venv\Scripts\python.exe"
cd /d "%~dp0"
echo ============================================================
echo   Bangla Caption - installer
echo ============================================================

echo.
echo [1/6] Looking for Python 3.10 - 3.12 ...
set "PY="
for %%V in (3.11 3.10 3.12) do if not defined PY ( py -%%V --version >nul 2>&1 && set "PY=py -%%V" )
if not defined PY ( python --version >nul 2>&1 && set "PY=python" )
if not defined PY (
  echo Python not found. Installing Python 3.11 with winget ...
  winget install -e --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
  if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set PY="%LocalAppData%\Programs\Python\Python311\python.exe"
)
if not defined PY (
  echo.
  echo Could not find or install Python automatically.
  echo Install Python 3.11 from python.org, tick "Add python.exe to PATH", then run INSTALL.bat again.
  pause
  exit /b 1
)
%PY% --version

echo.
echo [2/6] Creating private environment in %DEST% ...
if not exist "%DEST%\worker" mkdir "%DEST%\worker"
if not exist "%DEST%\bin" mkdir "%DEST%\bin"
if not exist "%DEST%\assets" mkdir "%DEST%\assets"
copy /Y "%~dp0worker\bangla_caption_worker.py" "%DEST%\worker\" >nul
copy /Y "%~dp0assets\*.png" "%DEST%\assets\" >nul
if not exist "%VPY%" %PY% -m venv "%DEST%\venv"
if not exist "%VPY%" (
  echo Could not create the virtual environment.
  pause
  exit /b 1
)

echo.
echo [3/6] Installing speech engines - large download, please wait ...
"%VPY%" -m pip install --upgrade pip
"%VPY%" -m pip install imageio-ffmpeg
"%VPY%" -m pip install openai-whisper
"%VPY%" -m pip install BanglaSpeech2Text

echo.
echo [4/6] Installing private ffmpeg ...
"%VPY%" -c "import imageio_ffmpeg,shutil;shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), r'%DEST%\bin\ffmpeg.exe')"

echo.
echo [5/6] After Effects scripting permission ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ae_prefs.ps1"

echo.
echo [6/6] Installing the After Effects panel - asks for administrator rights ...
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0tools\install_panel.bat' -Verb RunAs -Wait"

echo.
echo ===== Self test =====
"%VPY%" "%DEST%\worker\bangla_caption_worker.py" --selftest
echo.
echo Every line above must say OK. If one says FAIL, send that line to the developer.
echo.
echo NEXT: restart After Effects, then Window ^> BanglaCaption.jsx
echo If the panel says it cannot write files: Preferences ^> Scripting ^& Expressions ^> Allow Scripts to Write Files and Access Network.
echo For correct Bengali: Preferences ^> Type ^> Text Engine = South Asian and Middle Eastern.
pause
