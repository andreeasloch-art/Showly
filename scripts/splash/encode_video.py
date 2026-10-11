#!/usr/bin/env python3
"""Kodiert das Startvideo (public/splash.mp4).

    python3 scripts/splash/encode_video.py teaser.mp4 public/splash.mp4

H.264, 720 px, 24 Bilder/s, ohne Ton. Ohne B-Frames (-bf 0), damit der eigene
Abspieler (src/showly/splashPlayer.ts) die Bilder in Dateireihenfolge
entschlüsseln kann, wenn <video> nicht von selbst starten darf.
crf 30 mit preset veryslow: gut 1,3 MB statt 3 MB bei crf 25, auf dem Handy
kein sichtbarer Unterschied (SSIM 0,96). Jeder Besucher lädt das Video beim
Öffnen, deshalb zählt hier jedes Megabyte. moov steht vorne (+faststart),
damit das Video sofort startet.
"""
import subprocess
import sys

import imageio_ffmpeg

src, out = sys.argv[1:3]
subprocess.run(
    [imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y", "-i", src, "-an",
     "-c:v", "libx264", "-preset", "veryslow", "-profile:v", "high", "-level", "4.0",
     "-pix_fmt", "yuv420p", "-crf", "30", "-bf", "0", "-g", "48", "-tune", "film",
     "-movflags", "+faststart", out],
    check=True,
)
