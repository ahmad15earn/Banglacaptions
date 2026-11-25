#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bangla Caption worker (MVP)

Audio file -> list of words with start/end times -> JSON file that the
After Effects panel reads.  Runs fully offline.

Engines
  whisper           openai-whisper, real word-level timestamps
  banglaspeech2text BanglaSpeech2Text (Bangla fine-tuned Whisper), segment-level
                    timestamps; word times are estimated inside each segment

Usage (the panel does this for you):
  python bangla_caption_worker.py --job job.json
  python bangla_caption_worker.py --audio a.wav --engine whisper --model small \
         --out result.json --progress progress.json
"""
import argparse
import json
import os
import shutil
import sys
import time
import traceback
import unicodedata

# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------


def jdump(path, obj):
    """Write JSON as pure ASCII (\\uXXXX escapes) and replace the file atomically."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=True)
    os.replace(tmp, path)


class Progress(object):
    def __init__(self, path):
        self.path = path

    def update(self, pct, msg, done=False, error=False):
        if not self.path:
            print("[%3d%%] %s" % (pct, msg), flush=True)
            return
        try:
            jdump(self.path, {"pct": pct, "msg": msg, "done": done, "error": error,
                              "pid": os.getpid(), "ts": time.time()})
        except Exception:
            pass


# --------------------------------------------------------------------------
# Bengali -> Banglish (simple rule-based romanization, no dependencies)
# --------------------------------------------------------------------------

VOWELS = {
    "\u0985": "o", "\u0986": "a", "\u0987": "i", "\u0988": "i", "\u0989": "u",
    "\u098A": "u", "\u098B": "ri", "\u098F": "e", "\u0990": "oi", "\u0993": "o",
    "\u0994": "ou",
}
SIGNS = {  # vowel signs (kar)
    "\u09BE": "a", "\u09BF": "i", "\u09C0": "i", "\u09C1": "u", "\u09C2": "u",
    "\u09C3": "ri", "\u09C7": "e", "\u09C8": "oi", "\u09CB": "o", "\u09CC": "ou",
}
CONS = {
    "\u0995": "k", "\u0996": "kh", "\u0997": "g", "\u0998": "gh", "\u0999": "ng",
    "\u099A": "ch", "\u099B": "chh", "\u099C": "j", "\u099D": "jh", "\u099E": "n",
    "\u099F": "t", "\u09A0": "th", "\u09A1": "d", "\u09A2": "dh", "\u09A3": "n",
    "\u09A4": "t", "\u09A5": "th", "\u09A6": "d", "\u09A7": "dh", "\u09A8": "n",
    "\u09AA": "p", "\u09AB": "f", "\u09AC": "b", "\u09AD": "bh", "\u09AE": "m",
    "\u09AF": "j", "\u09B0": "r", "\u09B2": "l", "\u09B6": "sh", "\u09B7": "sh",
    "\u09B8": "s", "\u09B9": "h", "\u09DC": "r", "\u09DD": "rh", "\u09DF": "y",
    "\u09CE": "t",
}
NUKTA = {"\u09A1": "r", "\u09A2": "rh", "\u09AF": "y"}  # ড় ঢ় য়
HASANTA = "\u09CD"
NUKTA_CH = "\u09BC"
ANUSVARA = {"\u0982": "ng", "\u0983": "h", "\u0981": "n"}
DIGITS = dict(zip("\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF", "0123456789"))
PUNCT = {"\u0964": ".", "\u0965": "."}


def banglish(word):
    """Romanize one Bengali word. Approximate (no schwa-deletion model)."""
    w = unicodedata.normalize("NFC", word)
    n = len(w)
    out = []
    i = 0
    after_hasanta = False
    while i < n:
        ch = w[i]
        if ch in CONS:
            base = CONS[ch]
            if i + 1 < n and w[i + 1] == NUKTA_CH:
                base = NUKTA.get(ch, base)
                i += 1
            if after_hasanta and ch == "\u09AF":  # ya-phala
                base = "y"
            after_hasanta = False
            nxt = w[i + 1] if i + 1 < n else ""
            if nxt == HASANTA:
                out.append(base)
                i += 2
                after_hasanta = True
                continue
            if nxt in SIGNS:
                out.append(base + SIGNS[nxt])
                i += 2
                continue
            # inherent vowel: skip it at the end of a word
            out.append(base if i + 1 >= n else base + "o")
            i += 1
            continue
        after_hasanta = False
        if ch in VOWELS:
            out.append(VOWELS[ch])
        elif ch in ANUSVARA:
            out.append(ANUSVARA[ch])
        elif ch in DIGITS:
            out.append(DIGITS[ch])
        elif ch in PUNCT:
            out.append(PUNCT[ch])
        elif ch in SIGNS:  # stray vowel sign
            out.append(SIGNS[ch])
        elif ch in (HASANTA, NUKTA_CH, "\u200c", "\u200d"):
            pass
        else:
            out.append(ch)
        i += 1
    return "".join(out)


# --------------------------------------------------------------------------
# Engines
# --------------------------------------------------------------------------


def ensure_ffmpeg():
    """Use the ffmpeg.exe that INSTALL.bat placed in %APPDATA%\\BanglaCaption\\bin (no PATH needed)."""
    bindir = os.path.join(os.environ.get("APPDATA", ""), "BanglaCaption", "bin")
    if os.path.isdir(bindir):
        os.environ["PATH"] = bindir + os.pathsep + os.environ.get("PATH", "")
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found. Run INSTALL.bat again (it installs a private ffmpeg).")


def need_ffmpeg():
    ensure_ffmpeg()


def selftest():
    ok = True
    try:
        ensure_ffmpeg()
        print("ffmpeg ........ OK")
    except Exception as e:
        ok = False
        print("ffmpeg ........ FAIL: %s" % e)
    for mod in ("whisper", "banglaspeech2text"):
        try:
            __import__(mod)
            print("%-14s OK" % (mod + " ......"))
        except Exception as e:
            ok = False
            print("%-14s FAIL: %s" % (mod + " ......", e))
    print("banglish test . %s" % ascii(banglish("\u0986\u09ae\u09bf \u09ac\u09be\u0982\u09b2\u09be")))
    return ok


def run_whisper(audio, model_name, prog):
    need_ffmpeg()
    prog.update(5, "Loading Whisper model '%s' (first run downloads it)..." % model_name)
    import whisper  # openai-whisper
    import torch
    model = whisper.load_model(model_name)
    prog.update(20, "Transcribing with Whisper... (no live progress, please wait)")
    result = model.transcribe(
        audio,
        language="bn",
        task="transcribe",
        word_timestamps=True,
        condition_on_previous_text=False,
        fp16=bool(torch.cuda.is_available()),
        verbose=None,
    )
    words = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []) or []:
            t = (w.get("word") or "").strip()
            if t:
                words.append({"t": t, "s": round(float(w["start"]), 3), "e": round(float(w["end"]), 3)})
    return words, "word"


def run_bs2t(audio, model_name, prog):
    need_ffmpeg()
    prog.update(5, "Loading BanglaSpeech2Text model '%s' (first run downloads it)..." % model_name)
    from banglaspeech2text import Speech2Text
    stt = Speech2Text(model=model_name)
    prog.update(20, "Transcribing with BanglaSpeech2Text... (no live progress, please wait)")
    segments = stt.recognize(audio, return_segments=True)
    words = []
    for sg in segments:
        text = (sg.text or "").strip()
        parts = text.split()
        if not parts:
            continue
        start, end = float(sg.start), float(sg.end)
        weights = [len(p) + 1 for p in parts]
        total = float(sum(weights))
        cur = start
        for p, wt in zip(parts, weights):
            nxt = cur + (end - start) * wt / total
            words.append({"t": p, "s": round(cur, 3), "e": round(nxt, 3)})
            cur = nxt
    return words, "approx"


# --------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job")
    ap.add_argument("--audio")
    ap.add_argument("--engine", default="banglaspeech2text")
    ap.add_argument("--model", default="small")
    ap.add_argument("--out")
    ap.add_argument("--progress")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest() else 1)

    job = {}
    if a.job:
        with open(a.job, "r", encoding="utf-8") as f:
            job = json.load(f)
    audio = job.get("audio") or a.audio
    engine = job.get("engine") or a.engine
    model = job.get("model") or a.model
    out = job.get("out") or a.out
    prog = Progress(job.get("progress") or a.progress)

    try:
        prog.update(1, "Starting Python worker...")
        if not audio or not os.path.isfile(audio):
            raise RuntimeError("Audio file not found: %s" % audio)
        if not out:
            raise RuntimeError("No output path given.")
        if engine == "whisper":
            words, timing = run_whisper(audio, model, prog)
        elif engine == "banglaspeech2text":
            words, timing = run_bs2t(audio, model, prog)
        else:
            raise RuntimeError("Unknown engine: %s" % engine)
        if not words:
            raise RuntimeError("No speech was recognised in this audio.")
        for w in words:
            w["r"] = banglish(w["t"])
        jdump(out, {"engine": engine, "model": model, "timing": timing, "words": words})
        prog.update(100, "Done: %d words (%s timing)." % (len(words), timing), done=True)
    except Exception as exc:  # report to the panel
        traceback.print_exc()
        prog.update(0, "ERROR: %s" % exc, done=True, error=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
