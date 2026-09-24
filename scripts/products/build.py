# -*- coding: utf-8 -*-
"""Produktbilder für Deko (public/shop/<id>.svg) und Torten (public/sweets/<id>.svg).

Gleicher Aufbau wie die Kostümbilder: zarter Verlauf, weißer Lichthof,
Schatten am Boden, darauf das Produkt in flachen Formen.

Aufruf: python3 scripts/products/build.py"""
import math, os

W, H = 400, 300
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..", "public")


def frame(key, c0, c1, body, shadow=True, glow="#FFFFFF", glow_op=".85"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
        f'<defs><linearGradient id="p{key}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>'
        f'<radialGradient id="pv{key}" cx=".5" cy=".42" r=".62">'
        f'<stop offset="0" stop-color="{glow}" stop-opacity="{glow_op}"/>'
        f'<stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient></defs>'
        f'<rect width="{W}" height="{H}" fill="url(#p{key})"/>'
        f'<ellipse cx="200" cy="126" rx="150" ry="112" fill="url(#pv{key})"/>'
        + (f'<ellipse cx="200" cy="264" rx="118" ry="16" fill="rgba(23,18,38,.13)"/>' if shadow else "")
        + body + "</svg>"
    )


def balloon(x, y, r, col, hi="#FFFFFF", string=True, slen=60):
    s = (
        f'<path d="M{x} {y+r*1.18} q-6 {slen*.35} 4 {slen*.6} t-2 {slen*.4}" stroke="#8C8698" stroke-width="1.6" fill="none"/>'
        if string else ""
    )
    return (
        s
        + f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*1.15}" fill="{col}"/>'
        + f'<path d="M{x-4} {y+r*1.12}h8l-2 7h-4Z" fill="{col}"/>'
        + f'<ellipse cx="{x-r*.38}" cy="{y-r*.45}" rx="{r*.22}" ry="{r*.34}" fill="{hi}" opacity=".45" transform="rotate(-25 {x-r*.38} {y-r*.45})"/>'
    )


def candle(x, y, h, col):
    return (
        f'<rect x="{x-4}" y="{y-h}" width="8" height="{h}" rx="2" fill="{col}"/>'
        f'<path d="M{x} {y-h-16}c5 6 5 11 0 13c-5-2-5-7 0-13Z" fill="#FFB43C"/>'
        f'<path d="M{x} {y-h-10}c2 3 2 5 0 6c-2-1-2-3 0-6Z" fill="#FFF3C4"/>'
    )


# ---------------------------------------------------------------- Deko
def d16():  # Ballongirlande
    cols = ["#F4C9C0", "#E8B04B", "#FFFFFF", "#E7A6A0", "#D9A441", "#F7DCD5"]
    out = ""
    for k in range(15):
        t = k / 14
        ang = math.pi * (1 - t)
        x = 200 + 150 * math.cos(ang)
        y = 214 - 130 * math.sin(ang)
        out += balloon(round(x), round(y), 17 + (k % 3) * 4, cols[k % 6], string=False)
    return frame(16, "#FBF1EE", "#F1DDD7", out)


def d17():  # Zahlenballons 30
    three = '<path d="M112 70c50-26 104-4 92 40c-5 18-20 24-30 26c16 4 34 18 30 44c-8 50-72 60-100 28l20-22c18 20 50 12 50-6c0-18-20-24-44-22v-30c24 2 42-6 42-22c0-18-30-22-48-6Z" fill="#E1AE45"/>'
    zero = '<path d="M290 64c44 0 60 46 60 90s-16 90-60 90s-60-46-60-90s16-90 60-90Zm0 36c-14 0-22 22-22 54s8 54 22 54s22-22 22-54s-8-54-22-54Z" fill="#E1AE45"/>'
    shine = '<path d="M122 78c16-8 32-10 44-8" stroke="#FFF1C9" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M262 92c4-12 12-18 22-20" stroke="#FFF1C9" stroke-width="6" stroke-linecap="round" fill="none"/>'
    strings = '<path d="M150 208q-4 20 10 40M290 246q6 8 -4 18" stroke="#8C8698" stroke-width="1.6" fill="none"/>'
    return frame(17, "#FFF7E6", "#F4E3BE", strings + three + zero + shine)


def d18():  # Ballonstrauß
    cols = ["#7C5CE8", "#E8559B", "#F7B840", "#3BB7B0", "#F07C5E", "#9C7CF0", "#FFFFFF"]
    pts = [(160, 90, 30), (230, 78, 32), (196, 60, 28), (130, 130, 26), (270, 122, 28), (205, 112, 30), (168, 44, 22)]
    out = ""
    for (x, y, r), c in zip(pts, cols):
        out += f'<path d="M{x} {y+r*1.15} Q{(x+200)/2} 200 200 232" stroke="#8C8698" stroke-width="1.4" fill="none"/>'
    for (x, y, r), c in zip(pts, cols):
        out += balloon(x, y, r, c, string=False)
    out += '<path d="M188 226h24l-4 30h-16Z" fill="#E8559B"/><circle cx="200" cy="232" r="5" fill="#C23E83"/>'
    return frame(18, "#F3F0FD", "#E2DBF7", out)


def d19():  # Wimpelkette
    cols = ["#E8559B", "#F7B840", "#3BB7B0", "#7C5CE8", "#F07C5E"]
    out = ""
    for row, (y0, sag) in enumerate([(70, 40), (150, 36)]):
        pts = [(40 + k * 40, y0 + sag * math.sin(math.pi * k / 8)) for k in range(9)]
        out += '<path d="M' + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts) + '" stroke="#8C8698" stroke-width="2" fill="none"/>'
        for k in range(8):
            (x1, y1), (x2, y2) = pts[k], pts[k + 1]
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            out += f'<path d="M{x1+3:.0f} {y1:.0f}L{x2-3:.0f} {y2:.0f}L{mx:.0f} {my+42:.0f}Z" fill="{cols[(k+row)%5]}"/>'
    return frame(19, "#FDF6EC", "#F2E6D3", out)


def d20():  # Lichterkette
    out = ""
    pts = [(30 + k * 34, 80 + 50 * math.sin(k * .6) + k * 6) for k in range(11)]
    out += '<path d="M' + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts) + '" stroke="#3E3850" stroke-width="2.4" fill="none"/>'
    for x, y in pts:
        out += f'<circle cx="{x:.0f}" cy="{y+16:.0f}" r="18" fill="#FFE29A" opacity=".35"/>'
        out += f'<rect x="{x-3:.0f}" y="{y:.0f}" width="6" height="7" fill="#3E3850"/>'
        out += f'<ellipse cx="{x:.0f}" cy="{y+16:.0f}" rx="7" ry="10" fill="#FFD266"/>'
    out += '<circle cx="330" cy="210" r="34" fill="none" stroke="#3E3850" stroke-width="2.4"/><circle cx="330" cy="210" r="24" fill="none" stroke="#3E3850" stroke-width="2.4"/>'
    return frame(20, "#2A2442", "#1B1730", out, shadow=False, glow="#6B4FD8", glow_op=".35")


def d21():  # Pailletten-Fotowand
    out = '<rect x="96" y="36" width="208" height="206" rx="6" fill="#D6C7A4"/>'
    for yy in range(0, 20):
        for xx in range(0, 21):
            x = 102 + xx * 10 + (5 if yy % 2 else 0)
            y = 42 + yy * 10
            if x > 300:
                continue
            shade = ["#F3E7C6", "#E6D3A5", "#C9B27E", "#FFF6DC"][(xx * 3 + yy * 5) % 4]
            out += f'<circle cx="{x}" cy="{y}" r="5" fill="{shade}"/>'
    out += '<rect x="92" y="240" width="8" height="26" fill="#6E6A7A"/><rect x="300" y="240" width="8" height="26" fill="#6E6A7A"/><rect x="70" y="262" width="60" height="6" rx="3" fill="#6E6A7A"/><rect x="270" y="262" width="60" height="6" rx="3" fill="#6E6A7A"/>'
    return frame(21, "#F7F3EB", "#E9E1D1", out)


def d22():  # Neon-Schild "Let's Party"
    def neon(txt, y, size, col):
        base = f'font-family="Brush Script MT, Snell Roundhand, cursive" font-size="{size}" text-anchor="middle"'
        return (
            f'<text x="200" y="{y}" {base} fill="none" stroke="{col}" stroke-width="10" opacity=".25">{txt}</text>'
            f'<text x="200" y="{y}" {base} fill="none" stroke="{col}" stroke-width="3.5">{txt}</text>'
            f'<text x="200" y="{y}" {base} fill="none" stroke="#FFFFFF" stroke-width="1" opacity=".8">{txt}</text>'
        )
    out = '<rect x="56" y="64" width="288" height="170" rx="18" fill="#221B3A" opacity=".6" stroke="#3B3160" stroke-width="2"/>'
    out += neon("Let\u2019s", 138, 64, "#FF5FB1")
    party = 'font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="54" text-anchor="middle" letter-spacing="6"'
    out += f'<text x="200" y="208" {party} fill="none" stroke="#6CE8FF" stroke-width="10" opacity=".25">PARTY</text>'
    out += f'<text x="200" y="208" {party} fill="none" stroke="#6CE8FF" stroke-width="3">PARTY</text>'
    out += '<path d="M300 92l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="#FFD266"/>'
    return frame(22, "#2D2448", "#18132B", out, shadow=False, glow="#FF5FB1", glow_op=".18")


def d23():  # Tischdeko Gold
    out = '<rect x="70" y="214" width="260" height="10" rx="5" fill="#E7DCC6"/>'
    out += '<path d="M150 214c0-40 16-60 50-60s50 20 50 60Z" fill="#F4EEE3"/>'
    out += '<rect x="186" y="134" width="28" height="30" rx="4" fill="#D9A441"/>'
    for x, c in [(172, "#F6B3B8"), (200, "#FFFFFF"), (228, "#F9D2C5"), (186, "#E7A6A0"), (214, "#F6B3B8")]:
        out += f'<circle cx="{x}" cy="{118 if x in (186,214) else 128}" r="16" fill="{c}"/><circle cx="{x}" cy="{118 if x in (186,214) else 128}" r="6" fill="#E28F95" opacity=".5"/>'
    out += '<path d="M150 136c-12-6-24 0-28 10M250 136c12-6 24 0 28 10" stroke="#8FB48A" stroke-width="5" fill="none" stroke-linecap="round"/>'
    for x, h in [(96, 50), (116, 70), (284, 70), (304, 50)]:
        out += f'<rect x="{x-9}" y="{214-10}" width="18" height="10" rx="2" fill="#D9A441"/>' + candle(x, 204, h, "#FBF7EF")
    return frame(23, "#FBF6EC", "#EFE4CF", out)


def d24():  # Party-Geschirr
    out = '<ellipse cx="160" cy="214" rx="86" ry="26" fill="#FFFFFF"/><ellipse cx="160" cy="210" rx="62" ry="17" fill="#FDE3EF"/>'
    out += '<ellipse cx="160" cy="200" rx="86" ry="26" fill="#FFFFFF"/><ellipse cx="160" cy="196" rx="62" ry="17" fill="#FDE3EF"/>'
    for k in range(10):
        a = k * math.pi / 5
        out += f'<circle cx="{160+74*math.cos(a):.0f}" cy="{200+22*math.sin(a):.0f}" r="4" fill="#E8559B"/>'
    out += '<path d="M252 110h56l-8 124h-40Z" fill="#E8559B"/><path d="M252 110h56l-2 20h-52Z" fill="#FFFFFF"/>'
    for yy in (150, 176, 202):
        out += f'<path d="M256 {yy}h48" stroke="#FFFFFF" stroke-width="6" opacity=".7"/>'
    out += '<path d="M290 110l18-54" stroke="#3BB7B0" stroke-width="7" stroke-linecap="round"/><path d="M296 92l6-18" stroke="#FFFFFF" stroke-width="7" stroke-dasharray="4 5"/>'
    out += '<path d="M318 138h40l-6 90h-28Z" fill="#F7B840"/><path d="M318 138h40l-1 14h-38Z" fill="#FFFFFF"/>'
    return frame(24, "#FDF1F6", "#F3DCE7", out)


def d25():  # Fotobox-Requisiten
    out = ""
    # Brille
    out += '<path d="M80 100h140" stroke="#221B3A" stroke-width="6"/><rect x="84" y="88" width="56" height="36" rx="12" fill="#221B3A"/><rect x="164" y="88" width="56" height="36" rx="12" fill="#221B3A"/><rect x="92" y="94" width="18" height="8" rx="4" fill="#FFFFFF" opacity=".5"/>'
    out += '<path d="M152 124l-6 130" stroke="#B89A6E" stroke-width="5"/>'
    # Schnurrbart
    out += '<path d="M240 176c10-18 30-18 40-4c10-14 30-14 40 4c-12 4-22 18-40 8c-18 10-28-4-40-8Z" fill="#221B3A"/><path d="M280 186l4 70" stroke="#B89A6E" stroke-width="5"/>'
    # Krone
    out += '<path d="M250 70l14 30 16-34 16 34 14-30 4 52h-68Z" fill="#F7B840"/><circle cx="280" cy="62" r="6" fill="#E8559B"/><path d="M306 122l10 130" stroke="#B89A6E" stroke-width="5"/>'
    # Sprechblase
    out += '<path d="M60 150h96a14 14 0 0 1 14 14v34a14 14 0 0 1-14 14h-58l-22 18 4-18h-20a14 14 0 0 1-14-14v-34a14 14 0 0 1 14-14Z" fill="#FFFFFF"/><path d="M76 176h64M76 192h40" stroke="#E8559B" stroke-width="7" stroke-linecap="round"/>'
    return frame(25, "#F2F7FD", "#DCE7F5", out)


def d26():  # Konfetti-Kanonen
    out = ""
    cols = ["#E8559B", "#F7B840", "#3BB7B0", "#7C5CE8", "#F07C5E"]
    for k, (x, rot) in enumerate([(150, -12), (200, 0), (250, 12)]):
        out += f'<g transform="rotate({rot} {x} 240)"><rect x="{x-16}" y="130" width="32" height="112" rx="6" fill="{cols[k*2%5]}"/><rect x="{x-16}" y="150" width="32" height="10" fill="#FFFFFF" opacity=".6"/><rect x="{x-18}" y="124" width="36" height="12" rx="4" fill="#E9E3F3"/></g>'
    import random
    rnd = random.Random(26)
    for _ in range(60):
        x = rnd.uniform(90, 310); y = rnd.uniform(20, 115); r = rnd.uniform(2, 5)
        c = cols[rnd.randrange(5)]
        if rnd.random() < .5:
            out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{c}"/>'
        else:
            out += f'<rect x="{x:.0f}" y="{y:.0f}" width="{r*2:.0f}" height="{r:.0f}" fill="{c}" transform="rotate({rnd.uniform(0,180):.0f} {x:.0f} {y:.0f})"/>'
    return frame(26, "#FFF7EC", "#F7E6CC", out)


def d27():  # Leuchtbuchstaben LOVE
    out = ""
    letters = {
        "L": "M0 0h22v70h36v24h-58Z",
        "O": "M30 0c20 0 32 18 32 47s-12 47-32 47s-30-18-30-47s10-47 30-47Zm0 24c-6 0-8 10-8 23s2 23 8 23s8-10 8-23s-2-23-8-23Z",
        "V": "M0 0h24l12 56l12-56h24l-24 94h-24Z",
        "E": "M0 0h56v22h-34v14h28v20h-28v16h34v22h-56Z",
    }
    for k, ch in enumerate("LOVE"):
        x = 64 + k * 72
        out += f'<g transform="translate({x},120)"><path d="{letters[ch]}" fill="#F4EEE3" stroke="#C9B27E" stroke-width="3"/></g>'
        for j in range(4):
            out += f'<circle cx="{x+12+j*12}" cy="{130+j*18}" r="4" fill="#FFE29A"/>'
    return frame(27, "#F7F2EA", "#EAE0CF", out)


def d28():  # Laternen
    out = ""
    for x, s, c in [(130, 1.0, "#3E3850"), (210, 1.25, "#C9B27E"), (290, .9, "#3E3850")]:
        w, h = 44 * s, 70 * s
        top = 250 - h
        out += f'<circle cx="{x}" cy="{top+h*.55}" r="{30*s}" fill="#FFE29A" opacity=".45"/>'
        out += f'<rect x="{x-w/2}" y="{top}" width="{w}" height="{h}" rx="4" fill="none" stroke="{c}" stroke-width="4"/>'
        out += f'<path d="M{x-w/2-4} {top}h{w+8}l-8 -12h{-(w-8)}Z" fill="{c}"/><path d="M{x} {top-12}v-12m-8 0a8 8 0 0 1 16 0" stroke="{c}" stroke-width="3" fill="none"/>'
        out += f'<rect x="{x-w/2}" y="{top+h-6}" width="{w}" height="6" fill="{c}"/>'
        out += candle(x, top + h - 6, 22 * s, "#FBF7EF")
    return frame(28, "#EFEDF6", "#DCD8EA", out)


def d29():  # Stehtisch-Hussen
    out = ""
    for x, c in [(140, "#FFFFFF"), (260, "#7C5CE8")]:
        out += f'<ellipse cx="{x}" cy="86" rx="54" ry="12" fill="{c}"/><path d="M{x-54} 86c4 60 22 70 30 90c-6 30-10 50-14 70h76c-4-20-8-40-14-70c8-20 26-30 30-90Z" fill="{c}"/>'
        out += f'<path d="M{x-24} 176c16 6 32 6 48 0" stroke="{"#D9D4E6" if c=="#FFFFFF" else "#5B3FC0"}" stroke-width="6"/>'
        out += f'<path d="M{x-10} 110c-6 20-4 40 0 60M{x+14} 110c4 20 2 40-2 60" stroke="{"#ECE8F3" if c=="#FFFFFF" else "#6A4DD6"}" stroke-width="3" fill="none"/>'
    return frame(29, "#F1F3F8", "#DDE2EC", out)


def d30():  # Kindergeburtstag Deko-Box
    out = '<path d="M110 150h180v100h-180Z" fill="#7C5CE8"/><path d="M100 136h200v24h-200Z" fill="#9C7CF0"/><path d="M190 136h20v114h-20Z" fill="#F7B840"/>'
    out += balloon(140, 80, 22, "#E8559B", slen=40) + balloon(262, 72, 24, "#3BB7B0", slen=46) + balloon(200, 56, 20, "#F7B840", slen=60)
    out += '<path d="M126 190l20 14l20-14l20 14l20-14l20 14l20-14l20 14l20-14" stroke="#FFFFFF" stroke-width="4" fill="none"/>'
    out += '<text x="200" y="236" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="22" fill="#FFFFFF">PARTY</text>'
    return frame(30, "#FDF4F9", "#F1DEEB", out)


def d31():  # Blumenbogen
    out = '<path d="M110 256V130a90 90 0 0 1 180 0v126" stroke="#D6C7A4" stroke-width="8" fill="none"/>'
    import random
    rnd = random.Random(31)
    cols = ["#FFFFFF", "#F6B3B8", "#F9D2C5", "#E7A6A0", "#FBE7EA"]
    for k in range(34):
        t = k / 33
        ang = math.pi * (1.05 - 1.1 * t)
        if t < .5:
            x = 200 + 90 * math.cos(ang) + rnd.uniform(-8, 8)
            y = 130 - 90 * math.sin(ang) + rnd.uniform(-8, 8)
        else:
            continue
        out += f'<ellipse cx="{x+rnd.uniform(-6,6):.0f}" cy="{y+rnd.uniform(-4,4):.0f}" rx="12" ry="6" fill="#8FB48A" transform="rotate({rnd.uniform(0,180):.0f} {x:.0f} {y:.0f})"/>'
        out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(9,14):.0f}" fill="{cols[k%5]}"/><circle cx="{x:.0f}" cy="{y:.0f}" r="4" fill="#E28F95" opacity=".5"/>'
    for x in (110, 290):
        for y in (250, 236):
            out += f'<circle cx="{x+rnd.uniform(-10,10):.0f}" cy="{y}" r="11" fill="{cols[rnd.randrange(5)]}"/>'
    out += '<path d="M150 258h100" stroke="#E7DCC6" stroke-width="6"/>'
    return frame(31, "#FBF6F3", "#EFE3DD", out)


# ---------------------------------------------------------------- Torten
def tier(x, y, w, h, col, deco="#FFFFFF"):
    return (
        f'<rect x="{x-w/2}" y="{y-h}" width="{w}" height="{h}" rx="4" fill="{col}"/>'
        f'<ellipse cx="{x}" cy="{y-h}" rx="{w/2}" ry="7" fill="{col}"/>'
        f'<path d="M{x-w/2} {y-h+8}q{w/8} 10 {w/4} 0t{w/4} 0t{w/4} 0t{w/4} 0" stroke="{deco}" stroke-width="4" fill="none"/>'
    )


def plate(y=250, w=150):
    return f'<ellipse cx="200" cy="{y}" rx="{w/2}" ry="12" fill="#FFFFFF"/><ellipse cx="200" cy="{y-3}" rx="{w/2-10}" ry="8" fill="#F2EEE8"/>'


def s1():  # Hochzeitstorte
    out = plate(252, 190) + tier(200, 246, 150, 60, "#FBF7F1") + tier(200, 186, 110, 52, "#FBF7F1") + tier(200, 134, 72, 44, "#FBF7F1")
    for x, y, c in [(172, 92, "#F6B3B8"), (190, 84, "#FFFFFF"), (210, 86, "#F9D2C5"), (150, 150, "#F6B3B8"), (256, 206, "#F9D2C5"), (140, 214, "#FFFFFF")]:
        out += f'<circle cx="{x}" cy="{y}" r="10" fill="{c}"/><circle cx="{x}" cy="{y}" r="4" fill="#E28F95" opacity=".5"/>'
    out += '<path d="M130 216c-10 4-16 12-14 20M268 150c10 4 14 10 12 18" stroke="#8FB48A" stroke-width="5" fill="none" stroke-linecap="round"/>'
    return frame(1, "#FBF6F1", "#EFE4DA", out)


def s2():  # Naked Cake
    out = plate(252, 170)
    for k, y in enumerate([246, 206, 166]):
        out += f'<rect x="130" y="{y-30}" width="140" height="30" rx="4" fill="#D9A56C"/>'
        out += f'<rect x="130" y="{y-40}" width="140" height="10" fill="#FBF3E6"/>'
    out += '<ellipse cx="200" cy="126" rx="70" ry="8" fill="#FBF3E6"/>'
    for x, c in [(160, "#C2334A"), (178, "#3E3A8C"), (196, "#C2334A"), (214, "#E8559B"), (232, "#3E3A8C"), (248, "#C2334A"), (206, "#8FB48A")]:
        out += f'<circle cx="{x}" cy="{118 - (x % 3) * 3}" r="{7 if x!=206 else 5}" fill="{c}"/>'
    return frame(2, "#F7F3EC", "#E9E0D0", out)


def s3():  # Drip Cake
    out = plate(252, 170) + '<rect x="130" y="126" width="140" height="120" rx="6" fill="#F7B8D2"/>'
    out += '<path d="M130 132h140v14c-6 0-6 24-12 24s-6-18-12-18s-6 34-12 34s-6-26-12-26s-6 16-12 16s-6-30-12-30s-6 22-12 22s-6-14-12-14s-6 28-12 28s-6-24-12-24s-6 12-12 12Z" fill="#5A3322"/>'
    out += '<ellipse cx="200" cy="130" rx="70" ry="9" fill="#5A3322"/>'
    for x, c in [(158, "#F7B840"), (182, "#FFFFFF"), (206, "#E8559B"), (232, "#F7B840")]:
        out += f'<circle cx="{x}" cy="116" r="11" fill="{c}"/>'
    out += '<path d="M244 120c0-20 20-24 20-4" fill="#FFFFFF"/>' + candle(212, 108, 22, "#7C5CE8") + candle(190, 108, 18, "#3BB7B0")
    for k in range(10):
        out += f'<rect x="{140+k*13}" y="{190+ (k%3)*14}" width="6" height="2.5" rx="1" fill="{["#FFFFFF","#F7B840","#3BB7B0"][k%3]}" transform="rotate({k*37%90} {140+k*13} {190})"/>'
    return frame(3, "#FDF1F6", "#F2DCE8", out)


def s4():  # Zahlentorte 18
    out = plate(256, 250)
    out += '<path d="M96 110h28v136h-28Z" fill="#F4D7B5"/>'
    out += '<path d="M200 106c34 0 50 16 50 34c0 12-8 20-18 24c14 4 24 16 24 32c0 26-24 50-56 50s-56-24-56-50c0-16 10-28 24-32c-10-4-18-12-18-24c0-18 16-34 50-34Zm0 24c-12 0-20 6-20 14s8 14 20 14s20-6 20-14s-8-14-20-14Zm0 52c-14 0-24 8-24 18s10 20 24 20s24-10 24-20s-10-18-24-18Z" fill="#F4D7B5"/>'
    for x, y in [(110, 104), (110, 150), (110, 196), (110, 236), (170, 118), (230, 118), (200, 176), (160, 222), (240, 222), (200, 246)]:
        out += f'<circle cx="{x}" cy="{y}" r="9" fill="#FFFFFF"/><circle cx="{x+8}" cy="{y+4}" r="5" fill="#E8559B"/>'
    out += '<path d="M290 190l8-18 8 18-8 18Z" fill="#F7B840"/><circle cx="310" cy="150" r="7" fill="#7C5CE8"/>'
    return frame(4, "#FFF6EE", "#F4E2CF", out)


def s5():  # Motivtorte Einhorn
    out = plate(252, 170) + '<rect x="134" y="140" width="132" height="106" rx="10" fill="#FFFFFF"/><ellipse cx="200" cy="142" rx="66" ry="10" fill="#FFFFFF"/>'
    out += '<path d="M192 138l8-62l8 62Z" fill="#F7B840"/><path d="M194 120l12-4M196 104l10-4M198 90l8-3" stroke="#E3992E" stroke-width="2"/>'
    out += '<path d="M168 136c-6-18 4-26 10-22c-4 8 0 16 2 22Z" fill="#FFFFFF" stroke="#F1D8E6"/><path d="M232 136c6-18-4-26-10-22c4 8 0 16-2 22Z" fill="#FFFFFF" stroke="#F1D8E6"/>'
    out += '<path d="M172 190c4 6 12 6 16 0M212 190c4 6 12 6 16 0" stroke="#3E3850" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="170" cy="206" r="7" fill="#F7B8D2"/><circle cx="230" cy="206" r="7" fill="#F7B8D2"/>'
    for k, c in enumerate(["#F7B8D2", "#C9B2F5", "#9FE0DA", "#F7B8D2", "#FFE29A", "#C9B2F5"]):
        out += f'<circle cx="{146+k*22}" cy="{136 - (k%2)*8}" r="12" fill="{c}"/>'
    out += '<path d="M134 150c-10 20-4 50 6 70M266 150c10 20 4 50-6 70" stroke="#C9B2F5" stroke-width="10" fill="none" stroke-linecap="round"/>'
    return frame(5, "#F6F1FD", "#E6DCF8", out)


def cupcake(x, y, s, frost, case="#E8559B", top="#C2334A"):
    return (
        f'<path d="M{x-22*s} {y-30*s}h{44*s}l-6 {30*s}h{-32*s}Z" fill="{case}"/>'
        + "".join(f'<path d="M{x-18*s+k*9*s} {y-28*s}l{2*s} {26*s}" stroke="#FFFFFF" stroke-width="{1.5*s}" opacity=".5"/>' for k in range(5))
        + f'<path d="M{x-26*s} {y-30*s}c-4-14 8-20 14-18c0-12 20-16 24-4c10-6 22 2 18 14c6 2 6 8 0 8Z" fill="{frost}"/>'
        + f'<path d="M{x-14*s} {y-50*s}c4-10 16-14 22-6c4-8 14-6 14 4c-10 4-26 6-36 2Z" fill="{frost}"/>'
        + f'<circle cx="{x}" cy="{y-58*s}" r="{6*s}" fill="{top}"/>'
    )


def s6():  # Cupcake-Box
    out = '<path d="M80 150h240l-10 100h-220Z" fill="#FFFFFF"/><path d="M80 150h240v14h-240Z" fill="#F1ECE4"/>'
    for k, (fr, ca) in enumerate([("#F7B8D2", "#E8559B"), ("#FFF1D6", "#7C5CE8"), ("#C9B2F5", "#3BB7B0"), ("#9FE0DA", "#F7B840")]):
        out += cupcake(118 + k * 55, 176, .95, fr, ca)
    out += '<path d="M80 150l20-40h200l20 40" fill="#F4EEE3" opacity=".7"/>'
    return frame(6, "#FDF6F0", "#F1E3D6", out)


def s7():  # Cake Pops
    out = '<path d="M140 214h120l-10 42h-100Z" fill="#7C5CE8"/><rect x="134" y="206" width="132" height="12" rx="4" fill="#9C7CF0"/>'
    pops = [(150, 110, "#F7B8D2"), (180, 86, "#5A3322"), (210, 100, "#FFFFFF"), (240, 84, "#9FE0DA"), (168, 140, "#FFE29A"), (228, 134, "#E8559B"), (198, 64, "#C9B2F5")]
    for x, y, c in pops:
        out += f'<path d="M{x} {y+16}L{200 + (x-200)*.3:.0f} 210" stroke="#EDE6DA" stroke-width="3"/>'
    for x, y, c in pops:
        out += f'<circle cx="{x}" cy="{y}" r="16" fill="{c}"/><circle cx="{x-5}" cy="{y-5}" r="4" fill="#FFFFFF" opacity=".5"/>'
        for j in range(3):
            out += f'<rect x="{x-8+j*7}" y="{y+2-j*3}" width="4" height="1.8" fill="{["#F7B840","#3BB7B0","#E8559B"][j]}"/>'
    return frame(7, "#F5F1FD", "#E3DBF6", out)


def s8():  # Candy Bar
    out = '<rect x="60" y="196" width="280" height="12" rx="3" fill="#F4EEE3"/><path d="M64 208h272v48h-272Z" fill="#FBF7F1"/><path d="M64 214h272" stroke="#E7DCC6" stroke-width="3"/>'
    jars = [(96, 70, "#F7B8D2"), (150, 92, "#FFE29A"), (206, 80, "#9FE0DA"), (260, 96, "#C9B2F5"), (312, 72, "#F79C8A")]
    import random
    rnd = random.Random(8)
    for x, h, c in jars:
        top = 196 - h
        out += f'<rect x="{x-22}" y="{top}" width="44" height="{h}" rx="10" fill="#FFFFFF" opacity=".75" stroke="#E1DDE9" stroke-width="2"/>'
        for _ in range(int(h / 6)):
            cx = x + rnd.uniform(-14, 14); cy = rnd.uniform(top + 14, 190)
            out += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="5" fill="{c}"/>'
        out += f'<rect x="{x-18}" y="{top-8}" width="36" height="10" rx="3" fill="#D9A441"/>'
    out += '<path d="M60 70q35 26 70 0t70 0t70 0t70 0" stroke="#E8559B" stroke-width="3" fill="none"/>'
    for k in range(4):
        out += f'<circle cx="{95+k*70}" cy="80" r="6" fill="#F7B840"/>'
    return frame(8, "#FDF4F1", "#F2E0DA", out)


def s9():  # Donut-Wand
    out = '<rect x="92" y="40" width="216" height="206" rx="10" fill="#FFFFFF"/><rect x="92" y="246" width="216" height="12" fill="#E7DCC6"/>'
    cols = ["#F7B8D2", "#5A3322", "#FFE29A", "#9FE0DA", "#C9B2F5"]
    for r in range(4):
        for c in range(4):
            x = 124 + c * 50; y = 72 + r * 48
            out += f'<circle cx="{x}" cy="{y-8}" r="3" fill="#C9B27E"/>'
            out += f'<circle cx="{x}" cy="{y+6}" r="19" fill="#E0A96A"/><circle cx="{x}" cy="{y+4}" r="17" fill="{cols[(r+c)%5]}"/><circle cx="{x}" cy="{y+6}" r="6" fill="#FFFFFF"/>'
            out += f'<rect x="{x-9}" y="{y-4}" width="4" height="1.8" fill="#FFFFFF"/><rect x="{x+6}" y="{y+12}" width="4" height="1.8" fill="#FFFFFF"/>'
    return frame(9, "#FBF4EE", "#EFE2D5", out)


def s10():  # Macaron-Turm
    out = '<rect x="192" y="230" width="16" height="22" fill="#D9A441"/><ellipse cx="200" cy="254" rx="46" ry="8" fill="#D9A441"/>'
    cols = ["#F7B8D2", "#C9B2F5", "#9FE0DA", "#FFE29A", "#F79C8A"]
    rows = 8
    for r in range(rows):
        y = 222 - r * 22
        n = rows - r + 1
        w = n * 20
        for k in range(n):
            x = 200 - w / 2 + 10 + k * 20
            c = cols[(r + k) % 5]
            out += f'<ellipse cx="{x:.0f}" cy="{y}" rx="11" ry="6" fill="{c}"/><rect x="{x-9:.0f}" y="{y-1}" width="18" height="4" fill="#FFF7EC"/><ellipse cx="{x:.0f}" cy="{y+5}" rx="11" ry="5" fill="{c}"/>'
    out += '<path d="M200 36l4 10 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1Z" fill="#F7B840"/>'
    return frame(10, "#FBF4FA", "#EEDFEC", out)


def s11():  # Petit Fours
    out = '<rect x="70" y="200" width="260" height="46" rx="6" fill="#FFFFFF"/><rect x="66" y="244" width="268" height="10" rx="4" fill="#E7DCC6"/>'
    cols = [("#F7B8D2", "#E8559B"), ("#FFF1D6", "#D9A441"), ("#C9B2F5", "#7C5CE8"), ("#5A3322", "#F7B8D2")]
    for r in range(2):
        for k in range(5):
            x = 92 + k * 46; y = 168 + r * 34
            bg, dot = cols[(k + r) % 4]
            out += f'<rect x="{x}" y="{y}" width="34" height="28" rx="4" fill="{bg}"/><rect x="{x}" y="{y}" width="34" height="6" rx="3" fill="#FFFFFF" opacity=".45"/><circle cx="{x+17}" cy="{y+14}" r="4" fill="{dot}"/>'
    return frame(11, "#F8F4EE", "#EAE2D6", out)


def s12():  # Blechkuchen
    out = ""
    for k, (y, top, dots) in enumerate([(226, "#E0A96A", "#F7F0E4"), (178, "#C2334A", "#FFFFFF"), (130, "#5A3322", "#F7B840")]):
        x0 = 90 + k * 8
        out += f'<rect x="{x0}" y="{y}" width="{220 - k*16}" height="34" rx="4" fill="#8E929C"/><rect x="{x0+4}" y="{y+4}" width="{212 - k*16}" height="26" rx="2" fill="{top}"/>'
        for j in range(8 - k):
            out += f'<circle cx="{x0+22+j*26}" cy="{y+17}" r="{5 if k!=0 else 7}" fill="{dots}" opacity=".85"/>'
    return frame(12, "#F7F3EE", "#E6DED3", out)


def s13():  # Vegane Schokotorte
    out = plate(252, 180) + '<rect x="130" y="150" width="140" height="96" rx="6" fill="#4A2A1C"/><ellipse cx="200" cy="152" rx="70" ry="10" fill="#5A3322"/>'
    out += '<path d="M130 190h140M130 218h140" stroke="#8A5A3B" stroke-width="5"/>'
    for x in (160, 186, 214, 240):
        out += f'<circle cx="{x}" cy="146" r="8" fill="#C2334A"/><path d="M{x} 138c2-6 6-8 10-8" stroke="#8FB48A" stroke-width="2" fill="none"/>'
    out += '<path d="M300 110c-16 0-24 14-20 30c14 0 24-12 20-30Z" fill="#8FB48A"/><path d="M286 138l10-18" stroke="#6E9A69" stroke-width="2"/>'
    return frame(13, "#F4F1EA", "#E3DDD0", out)


def s14():  # Firmenlogo-Torte
    out = plate(250, 250) + '<rect x="90" y="150" width="220" height="92" rx="8" fill="#FFFFFF"/><rect x="90" y="140" width="220" height="16" rx="8" fill="#F4EEF9"/>'
    out += '<rect x="130" y="166" width="140" height="60" rx="8" fill="#6B3BE8"/><path d="M150 206c12-24 28-24 36-6c8-18 26-18 34 6" stroke="#FFFFFF" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="244" cy="186" r="8" fill="#FF7A59"/>'
    out += '<path d="M90 242q27 10 55 0t55 0t55 0t55 0" stroke="#E7DDF4" stroke-width="5" fill="none"/>'
    return frame(14, "#F3F0FB", "#E1DBF2", out)


# ------------------------------------------------ Zubehör (Passt dazu)
def d32():  # Heliumflasche
    out = '<rect x="150" y="92" width="100" height="160" rx="30" fill="#8FA4B8"/>'
    out += '<rect x="150" y="92" width="100" height="160" rx="30" fill="url(#hl32)"/>'
    out += '<rect x="180" y="62" width="40" height="36" rx="6" fill="#5E6B7A"/><rect x="172" y="50" width="56" height="14" rx="7" fill="#3E4856"/>'
    out += '<path d="M220 72h26v10h-26Z" fill="#3E4856"/><circle cx="252" cy="77" r="7" fill="#E8559B"/>'
    out += '<rect x="164" y="146" width="72" height="54" rx="8" fill="#FFFFFF"/><text x="200" y="171" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="17" text-anchor="middle" fill="#3E4856">HELIUM</text><text x="200" y="190" font-family="Arial,Helvetica,sans-serif" font-size="11" text-anchor="middle" fill="#6A7684">Ballongas</text>'
    out += balloon(300, 96, 24, "#F7B840", string=False) + balloon(328, 140, 20, "#7C5CE8", string=False)
    out += '<path d="M300 124Q290 190 258 200M328 163Q320 200 262 206" stroke="#8C8698" stroke-width="1.4" fill="none"/>'
    defs = '<defs><linearGradient id="hl32" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".35" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".12"/></linearGradient></defs>'
    return frame(32, "#EEF3F8", "#D9E2EC", defs + out)


def d33():  # Elektrische Ballonpumpe
    out = '<rect x="110" y="150" width="160" height="96" rx="22" fill="#7C5CE8"/><rect x="110" y="150" width="160" height="30" rx="15" fill="#9C7CF0"/>'
    out += '<circle cx="150" cy="212" r="14" fill="#5B3FC4"/><circle cx="150" cy="212" r="6" fill="#FFFFFF"/>'
    out += '<rect x="186" y="198" width="60" height="10" rx="5" fill="#5B3FC4"/><rect x="186" y="216" width="40" height="10" rx="5" fill="#5B3FC4"/>'
    out += '<path d="M150 150v-26h-8v-14h24v14h-8v26Z" fill="#3E3850"/><path d="M230 150v-26h-8v-14h24v14h-8v26Z" fill="#3E3850"/>'
    out += balloon(154, 70, 26, "#E8559B", string=False) + balloon(234, 72, 22, "#3BB7B0", string=False)
    out += '<path d="M270 214c30 0 40 20 70 20" stroke="#3E3850" stroke-width="4" fill="none"/><rect x="336" y="226" width="22" height="16" rx="3" fill="#3E3850"/>'
    return frame(33, "#F3F0FB", "#E1DBF2", out)


def d34():  # Ballonband & Gewichte
    out = ''
    for k, c in enumerate(["#E8559B", "#F7B840", "#7C5CE8"]):
        x = 120 + k * 80
        out += f'<path d="M{x} 70q-20 40 0 80t0 70" stroke="{c}" stroke-width="3" fill="none"/>'
        out += f'<path d="M{x-22} 226h44l-8 26h-28Z" fill="{c}"/><rect x="{x-24}" y="218" width="48" height="10" rx="5" fill="{c}" opacity=".75"/>'
        out += f'<ellipse cx="{x}" cy="62" rx="10" ry="6" fill="{c}"/>'
    out += '<circle cx="330" cy="120" r="34" fill="#F4C9C0"/><circle cx="330" cy="120" r="12" fill="#FBF1EE"/>'
    out += '<path d="M330 154q-10 30 10 60t-14 40" stroke="#E7A6A0" stroke-width="3" fill="none"/>'
    return frame(34, "#FFF6F2", "#F4E1DA", out)


def d35():  # Outdoor-Verlängerung mit Zeitschaltuhr
    out = '<rect x="120" y="110" width="110" height="130" rx="18" fill="#3E3850"/><circle cx="175" cy="160" r="34" fill="#FFFFFF"/>'
    for k in range(12):
        a = k / 12 * 2 * math.pi
        out += f'<rect x="{175+26*math.cos(a)-3:.0f}" y="{160+26*math.sin(a)-3:.0f}" width="6" height="6" rx="1" fill="{"#F7B840" if k < 5 else "#CFC8DA"}"/>'
    out += '<path d="M175 160l0-18M175 160l12 6" stroke="#3E3850" stroke-width="3" stroke-linecap="round"/>'
    out += '<circle cx="158" cy="214" r="6" fill="#1B1730"/><circle cx="192" cy="214" r="6" fill="#1B1730"/>'
    out += '<path d="M230 190c40 0 30 40 70 40s40-60 60-60" stroke="#F07C5E" stroke-width="7" fill="none" stroke-linecap="round"/>'
    for k in range(5):
        x = 60 + k * 16
        out += f'<circle cx="{x}" cy="{84 + (k % 2) * 10}" r="12" fill="#FFE29A" opacity=".45"/><ellipse cx="{x}" cy="{84 + (k % 2) * 10}" rx="5" ry="7" fill="#FFD266"/>'
    return frame(35, "#2A2442", "#1B1730", out, glow="#6B4FD8", glow_op=".35")


DECO = {16: d16, 17: d17, 18: d18, 19: d19, 20: d20, 21: d21, 22: d22, 23: d23, 24: d24, 25: d25, 26: d26, 27: d27, 28: d28, 29: d29, 30: d30, 31: d31, 32: d32, 33: d33, 34: d34, 35: d35}
SWEETS = {1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9, 10: s10, 11: s11, 12: s12, 13: s13, 14: s14}

if __name__ == "__main__":
    for i, fn in DECO.items():
        open(os.path.join(ROOT, "shop", f"{i}.svg"), "w").write(fn())
    for i, fn in SWEETS.items():
        open(os.path.join(ROOT, "sweets", f"{i}.svg"), "w").write(fn())
    print("Deko:", len(DECO), "Torten:", len(SWEETS))
