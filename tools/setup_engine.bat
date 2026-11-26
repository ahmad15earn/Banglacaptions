@echo off
setlocal
REM Usage: setup_engine.bat "<folder containing worker\ assets\ tools\>"
set "SRC=%~1"
if "%SRC%"=="" set "SRC=%~dp0.."
set "DEST=%APPDATA%\BanglaCaption"
set "VPY=%DEST%\venv\Scripts\python.exe"
echo ============================================================
echo   Bangla Caption - speech engine setup
echo ============================================================

echo.
echo [1/5] Looking for Python 3.10 - 3.12 ...
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
  echo Install Python 3.11 from python.org, tick "Add python.exe to PATH", then run this setup again.
  pause
  exit /b 1
)
%PY% --version

echo.
echo [2/5] Creating private environment in %DEST% ...
if not exist "%DEST%\worker" mkdir "%DEST%\worker"
if not exist "%DEST%\bin" mkdir "%DEST%\bin"
if not exist "%DEST%\assets" mkdir "%DEST%\assets"
copy /Y "%SRC%\worker\bangla_caption_worker.py" "%DEST%\worker\" >nul
copy /Y "%SRC%\assets\*.png" "%DEST%\assets\" >nul
if not exist "%VPY%" %PY% -m venv "%DEST%\venv"
if not exist "%VPY%" (
  echo Could not create the virtual environment.
  pause
  exit /b 1
)

echo.
echo [3/5] Installing speech engines - large download, please wait ...
"%VPY%" -m pip install --upgrade pip
"%VPY%" -m pip install imageio-ffmpeg
"%VPY%" -m pip install openai-whisper
"%VPY%" -m pip install BanglaSpeech2Text

echo.
echo [4/5] Installing private ffmpeg and scripting permission ...
"%VPY%" -c "import imageio_ffmpeg,shutil;shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), r'%DEST%\bin\ffmpeg.exe')"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\tools\ae_prefs.ps1"

echo.
echo [5/5] Self test
"%VPY%" "%DEST%\worker\bangla_caption_worker.py" --selftest
echo.
echo Every line above must say OK. If one says FAIL, copy that line into a GitHub issue.
echo.
echo NEXT: restart After Effects, then Window ^> BanglaCaption.jsx
echo If the panel cannot write files: Preferences ^> Scripting ^& Expressions ^> Allow Scripts to Write Files and Access Network.
echo For correct Bengali: Preferences ^> Type ^> Text Engine = South Asian and Middle Eastern, then use the Test Bengali button.
pause
