<p align="center"><img src="assets/icon_128.png" width="96" alt="Bangla Caption"></p>

# Bangla Caption  v0.3.0

Free, offline Bengali / Banglish caption panel for **Adobe After Effects** (Windows).
Audio -> transcript -> caption blocks with your own word limit -> editable text layers. No cloud, no subscription.

## Install (বাংলায়)
1. Zip এক্সট্র্যাক্ট করুন, **INSTALL.bat** ডাবল-ক্লিক করুন। প্রথমবার বড় ডাউনলোড হবে (Python থাকলে ভালো, না থাকলে winget দিয়ে বসাবে)।
2. শেষে সেলফ-টেস্টের প্রতিটি লাইনে **OK** দেখতে হবে।
3. After Effects রিস্টার্ট করুন, **Window > BanglaCaption.jsx**।
4. প্যানেলের `?` বাটনে সেটআপ চেকলিস্ট আছে: AE-তে "Allow Scripts to Write Files and Access Network" টিক এবং Text Engine = **South Asian and Middle Eastern**। Hind Siliguri / Noto Sans Bengali ফন্ট ইন্সটল রাখুন।

## Use
1. Select a footage layer with audio -> **Selected layer** (or **Browse file**).
2. Choose engine and model -> **Generate Transcript** (first run downloads the model).
3. Change **Max words** / Regroup any time; speech recognition is not re-run.
4. Edit the text (one line = one caption), pick font/size/colour -> **Create Captions in Comp**.
5. **Output: Banglish** switches the same transcript to romanized text. **Cancel** stops a run.

## Engines
| Engine | Bengali accuracy | Timing |
|---|---|---|
| BanglaSpeech2Text | Bangla-tuned, usually better | segment-level, word times estimated |
| Whisper | generic, weaker Bengali | real word-level timestamps |

## Folder
`INSTALL.bat` / `UNINSTALL.bat` - one-click setup and removal. `panel/` - the AE panel. `worker/` - local speech worker. `assets/` - icons. `tools/` - helpers.

## Honest status
- Not yet tested inside After Effects 2024-2027 by the author. Unit-tested only: caption splitting and Banglish conversion.
- Unverified until first run: progress polling (use "Check progress" if the bar does not move), the font check, the automatic scripting-permission patch (falls back to the manual setting), Bengali shaping in AE.
- Audio must come from a footage file layer (no pre-comp audio). Time-remapped layers are not handled.
- Banglish is rule-based and approximate.
- Editor: keep the line count; Regroup discards edits.
- A ScriptUI panel cannot show a custom tab icon in AE; the icon appears in the panel header and installer assets.
- Check model licenses before redistributing models. Log of last run: `%TEMP%\BanglaCaption\log.txt`.
