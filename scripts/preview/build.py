#!/usr/bin/env python3
"""Baut eine klickbare Vorschau der App als statische Seite.

Die App läuft normalerweise mit Server (TanStack Start). Für die Vorschau
wird eine Kopie des Projekts als Single-Page-App gebaut, mit Hash-Routen
(#/torten statt /torten) und relativen Pfaden. So funktioniert sie auch
unter einer fremden Adresse, etwa als Artifact auf claude.ai.

Aufruf:  python3 scripts/preview/build.py [Zielordner]
Ergebnis: Zielordner/index.html plus Bilder, Schriften und Skripte.
Anmelden, Bezahlen und alles mit Server funktioniert in der Vorschau nicht.
"""
import glob, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview-dist"))

work = tempfile.mkdtemp(prefix="showly-preview-")
files = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT,
                       capture_output=True, text=True, check=True).stdout.split()
for f in files:
    src = os.path.join(ROOT, f)
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(os.path.join(work, f)), exist_ok=True)
        shutil.copy2(src, os.path.join(work, f))
os.symlink(os.path.join(ROOT, "node_modules"), os.path.join(work, "node_modules"))

def patch(path, pairs):
    p = os.path.join(work, path); s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        if a not in s: sys.exit(f"{path}: '{a}' nicht gefunden, Skript anpassen")
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf-8").write(s)

patch("vite.config.ts", [
    ('server: { entry: "server" },', 'server: { entry: "server" },\n    spa: { enabled: true },'),
    ("export default defineConfig({", 'export default defineConfig({\n  vite: { base: "./" },'),
])
patch("src/router.tsx", [
    ('import { createRouter } from "@tanstack/react-router";',
     'import { createRouter, createHashHistory } from "@tanstack/react-router";'),
    ("context: { queryClient },",
     'context: { queryClient },\n    history: typeof window !== "undefined" ? createHashHistory() : undefined,'),
])
subprocess.run(["npx", "vite", "build"], cwd=work, check=True, stdout=subprocess.DEVNULL)

shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(os.path.join(work, ".output", "public"), OUT)
shutil.rmtree(work, ignore_errors=True)
os.chdir(OUT)
os.rename("_shell.html", "index.html")
for f in ("robots.txt", "manifest.webmanifest"):
    if os.path.exists(f): os.remove(f)

# Absolute Pfade (/acts/1.svg, /./assets/x.js) relativ machen
top = sorted(os.listdir("."), key=len, reverse=True)
alt = "|".join(re.escape(e) for e in top if e != "index.html")
for p in glob.glob("index.html") + glob.glob("assets/*.js") + glob.glob("assets/*.css"):
    s = open(p, encoding="utf-8").read()
    s = s.replace("/./assets/", "./assets/")
    pre = "../" if p.endswith(".css") else "./"
    s = re.sub(r'(["\'`(,\s])/(' + alt + r')(?=[/"\'`)\s,?#]|$)', lambda m: m.group(1) + pre + m.group(2), s)
    # Steuer- und Ersatzzeichen als Escape schreiben, sonst lehnt der Upload ab
    s = s.replace("\ufffd", "\\uFFFD").replace("\x00", "\\u0000")
    if p == "index.html":
        s = s.replace("<head>", '<head><title>Showly Handy-Vorschau</title><script>try{if(!localStorage.getItem("showly.lang"))localStorage.setItem("showly.lang","de")}catch(e){}</script>', 1)
        s = re.sub(r'<link rel="manifest"[^>]*/>', "", s)
    open(p, "w", encoding="utf-8").write(s)
print(OUT)
