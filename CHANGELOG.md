# Changelog

## 0.4.0
- GitHub Actions: tests + Windows installer (BanglaCaption-Setup-x.y.z.exe) + portable zip, releases on `v*` tags.
- Free-form caption editor: merge, split, add or remove lines. Same word count keeps exact word timing; otherwise timing is estimated.
- Pre-comp audio: nested pre-comps are searched for the first audio footage layer; "no selection" uses the first audio layer of the comp.
- Live transcription progress (Whisper bar, BanglaSpeech2Text by audio position).
- "Test Bengali" button to check conjunct rendering and font/Text Engine setup. Time-remap warning.
- Unit tests for segmentation, editor mapping, Banglish and version consistency.

## 0.3.0
- Plugin packaging: icon, header, engine status line, tooltips, settings remembered between sessions.
- INSTALL.bat: installs Python (winget) if missing, private ffmpeg, panel, self test. UNINSTALL.bat added.
- Optional automatic enabling of the AE scripting-file-access preference (only if the key exists).

## 0.2.0
- Cancel button, elapsed time, bundled ffmpeg, worker self test.

## 0.1.0
- First MVP: transcript, Banglish, caption grouping, editable text layers.
