"""Schreibt die Rechtstexte aus scripts/legal/*.html in src/showly/legal.ts.

Deutsch (auch für Englisch genutzt) kommt aus den *-de.html-Dateien, Spanisch
aus den *-es.html-Dateien. Aufruf: python3 scripts/legal/inject.py"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
TS = os.path.join(HERE, "..", "..", "src", "showly", "legal.ts")
DE = {"imprint": "impressum-de.html", "privacy": "datenschutz-de.html", "cookies": "cookies-de.html",
      "terms": "agb-de.html", "security": "sicherheit-de.html", "withdrawal": "widerruf-de.html",
      "accessibility": "barrierefreiheit-de.html"}
ES = {"privacy": "datenschutz-es.html", "cookies": "cookies-es.html", "security": "sicherheit-es.html",
      "withdrawal": "widerruf-es.html", "accessibility": "barrierefreiheit-es.html"}

def load(name):
    p = os.path.join(HERE, name)
    return open(p, encoding="utf-8").read().rstrip("\n") if os.path.exists(p) else None

s = open(TS, encoding="utf-8").read()
blocks = [m for m in re.finditer(r"export const (\w+)[^=]*= \{", s)]
out, last = [], 0
for i, m in enumerate(blocks):
    start = m.end()
    end = s.index("\n};", start)
    body = s[start:end]
    table = DE if i == 0 else ES
    entries = dict(re.findall(r'\n "(\w+)": ("(?:[^"\\]|\\.)*")', body))
    for k, f in table.items():
        html = load(f)
        if html is not None:
            entries[k] = json.dumps(html, ensure_ascii=False)
    new = "".join(f'\n "{k}": {v},' for k, v in entries.items()).rstrip(",")
    out.append(s[last:start] + new)
    last = end
out.append(s[last:])
open(TS, "w", encoding="utf-8").write("".join(out))
print("legal.ts aktualisiert")
