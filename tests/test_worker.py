"""Run: python tests/test_worker.py"""
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "worker"))
import bangla_caption_worker as w

cases = {
    "\u0986\u09ae\u09bf": "ami",
    "\u09ac\u09be\u0982\u09b2\u09be": "bangla",
    "\u09a4\u09cb\u09ae\u09be\u0995\u09c7": "tomake",
    "\u0995\u09b0\u09cb\u0964": "koro.",
    "\u09e7\u09e8\u09e9": "123",
}
for bn, rom in cases.items():
    got = w.banglish(bn)
    assert got == rom, (ascii(bn), got, rom)

ver = open(os.path.join(ROOT, "VERSION")).read().strip()
jsx = open(os.path.join(ROOT, "panel", "BanglaCaption.jsx"), encoding="ascii").read()
iss = open(os.path.join(ROOT, "installer", "BanglaCaption.iss"), encoding="utf-8").read()
assert 'BC_VERSION = "%s"' % ver in jsx, "VERSION mismatch in panel"
assert re.search(r'#define AppVersion "%s"' % re.escape(ver), iss), "VERSION mismatch in installer"
assert all(ord(c) < 128 for c in jsx), "panel must be ASCII-only"
print("worker/version tests passed")
