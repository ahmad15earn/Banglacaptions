<p align="center"><img src="assets/icon_128.png" width="96" alt="Bangla Caption"></p>

# Bangla Caption  v0.4.0

Free, offline Bengali / Banglish caption panel for **Adobe After Effects** (Windows).
Audio -> transcript -> caption blocks with your own word limit -> editable text layers. No cloud, no subscription.

## Install (বাংলায়)
**GitHub থেকে (সহজ):** repository-তে push করুন -> **Actions** ট্যাবে Build শেষ হলে artifact **BanglaCaption** ডাউনলোড করুন -> ভেতরের `BanglaCaption-Setup-x.y.z.exe` চালান (Windows SmartScreen সতর্ক করলে "More info > Run anyway", কারণ ফাইল সাইন করা নেই)। ইনস্টলার প্যানেল বসায়, Python/ইঞ্জিন সেটআপ করে ও সেলফ-টেস্ট দেখায়।
**ট্যাগ দিলে** (`git tag v0.4.0 && git push --tags`) Releases পেজে ডাউনলোড লিংক তৈরি হয়।
**পোর্টেবল:** `BanglaCaption-portable-x.y.z.zip` extract করে `INSTALL.bat` চালান।

তারপর After Effects রিস্টার্ট করে **Window > BanglaCaption.jsx**। প্যানেলের `?` বাটনে চেকলিস্ট আছে: "Allow Scripts to Write Files and Access Network" টিক, Text Engine = **South Asian and Middle Eastern**, Hind Siliguri / Noto Sans Bengali ফন্ট, তারপর **Test Bengali** বাটনে যুক্তাক্ষর যাচাই।

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
- Automated tests cover caption splitting, editor mapping, Banglish and versions. The AE panel itself, the installer build and the speech engines have not been run by the author inside After Effects 2024-2027; report problems as GitHub issues with the self-test output and `%TEMP%\BanglaCaption\log.txt`.
- Unverified until first run: progress polling (use "Check progress" if the bar does not move), the `app.fonts` font check, the automatic scripting-permission patch (falls back to the manual setting).
- Pre-comp support uses the first audio footage layer found; mixed audio from several layers is not captured. Time-remapped layers are not applied (a warning is shown).
- Banglish is rule-based and approximate. BanglaSpeech2Text word times are estimated inside each segment; choose Whisper for exact word timing.
- A ScriptUI panel cannot show a custom tab icon in AE; the icon is in the panel header and installer.
- The installer is unsigned. Check model licenses before redistributing models.
