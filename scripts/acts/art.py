# -*- coding: utf-8 -*-
"""Erzeugt die Kuenstlerbilder als SVG (public/acts/<id>.svg).

Aufruf: python3 scripts/acts/build.py

Alle Bilder teilen sich denselben Aufbau (Buehnenraum, Lichtkegel, Bodenlicht,
Streulicht, Vignette). Nur Palette und Figur unterscheiden sich. Dadurch wirken
sie im Raster wie eine zusammengehoerige Serie."""

W, H = 400, 300
GROUND = 232


def defs(i, p):
    """Verlaeufe und Filter, pro Bild mit eigener Kennung."""
    return (
        f'<defs>'
        f'<linearGradient id="sky{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{p["sky0"]}"/>'
        f'<stop offset=".52" stop-color="{p["sky1"]}"/>'
        f'<stop offset="1" stop-color="{p["sky2"]}"/></linearGradient>'
        f'<radialGradient id="glow{i}" cx=".5" cy=".42" r=".62">'
        f'<stop offset="0" stop-color="{p["glow"]}" stop-opacity=".62"/>'
        f'<stop offset=".55" stop-color="{p["glow"]}" stop-opacity=".18"/>'
        f'<stop offset="1" stop-color="{p["glow"]}" stop-opacity="0"/></radialGradient>'
        f'<linearGradient id="beam{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{p["beam"]}" stop-opacity=".5"/>'
        f'<stop offset="1" stop-color="{p["beam"]}" stop-opacity="0"/></linearGradient>'
        f'<radialGradient id="pool{i}" cx=".5" cy=".5" r=".5">'
        f'<stop offset="0" stop-color="{p["beam"]}" stop-opacity=".5"/>'
        f'<stop offset="1" stop-color="{p["beam"]}" stop-opacity="0"/></radialGradient>'
        f'<linearGradient id="floor{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{p["floor0"]}"/>'
        f'<stop offset="1" stop-color="{p["floor1"]}"/></linearGradient>'
        f'<linearGradient id="fig{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{p["fig0"]}"/>'
        f'<stop offset="1" stop-color="{p["fig1"]}"/></linearGradient>'
        f'<linearGradient id="rim{i}" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{p["rim"]}" stop-opacity=".95"/>'
        f'<stop offset="1" stop-color="{p["rim"]}" stop-opacity=".15"/></linearGradient>'
        f'<radialGradient id="vig{i}" cx=".5" cy=".46" r=".78">'
        f'<stop offset=".55" stop-color="#000" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="{p["vig"]}" stop-opacity=".55"/></radialGradient>'
        # Unschaerfekreise im Hintergrund, wie bei offener Blende: innen
        # gleichmaessig, am Rand ein etwas hellerer Saum, dann weich aus.
        f'<radialGradient id="bok{i}">'
        f'<stop offset="0" stop-color="{p["glow"]}" stop-opacity=".5"/>'
        f'<stop offset=".7" stop-color="{p["glow"]}" stop-opacity=".38"/>'
        f'<stop offset=".86" stop-color="{p["beam"]}" stop-opacity=".46"/>'
        f'<stop offset="1" stop-color="{p["beam"]}" stop-opacity="0"/></radialGradient>'
        # Dunst ueber dem Buehnenboden: nimmt dem Uebergang die harte Kante
        f'<linearGradient id="haze{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{p["beam"]}" stop-opacity="0"/>'
        f'<stop offset=".6" stop-color="{p["beam"]}" stop-opacity=".2"/>'
        f'<stop offset="1" stop-color="{p["beam"]}" stop-opacity="0"/></linearGradient>'
        # Spiegelung im Boden, nach unten auslaufend
        f'<linearGradient id="refg{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="#fff" stop-opacity=".34"/>'
        f'<stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        f'<mask id="refm{i}"><rect y="{GROUND}" width="{W}" height="{H - GROUND}" fill="url(#refg{i})"/></mask>'
        # Farbstimmung in den Logofarben: Violett von links oben, Koralle von
        # rechts unten. So wirken alle Bilder wie aus einem Guss.
        f'<linearGradient id="grade{i}" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="#6B3BFF" stop-opacity=".55"/>'
        f'<stop offset=".55" stop-color="#C13BD6" stop-opacity=".12"/>'
        f'<stop offset="1" stop-color="#FF7A59" stop-opacity=".5"/></linearGradient>'
        f'</defs>'
    )


def beams(i, xs=(128, 272), spread=52, top=-10, bottom=214):
    """Zwei Lichtkegel von oben, leicht nach aussen geneigt.

    Drei ineinanderliegende Kegel statt einem: aussen breit und schwach,
    innen schmal und hell. Das ergibt eine weiche Kante wie bei echtem
    Buehnenlicht im Dunst, ohne einen Weichzeichner, der beim Scrollen
    Rechenzeit kosten wuerde."""
    out = []
    for k, x in enumerate(xs):
        lean = -18 if k == 0 else 18
        for scale, op, head in ((1.35, ".32", 20), (1.0, ".5", 14), (.55, ".62", 8)):
            sp = spread * scale
            out.append(
                f'<path d="M{x - head} {top} L{x + head} {top} '
                f'L{x + sp + lean} {bottom} L{x - sp + lean} {bottom}Z" '
                f'fill="url(#beam{i})" opacity="{op}"/>'
            )
    return "".join(out)


def floor(i, y=214):
    return (
        f'<rect y="{y}" width="{W}" height="{H - y}" fill="url(#floor{i})"/>'
        f'<ellipse cx="200" cy="{y + 16}" rx="150" ry="30" fill="url(#pool{i})"/>'
        f'<rect y="{y}" width="{W}" height="1.5" fill="#fff" opacity=".14"/>'
    )


def sparks(pts, color="#FFFFFF"):
    """Feine Lichtpunkte fuer Tiefe."""
    return "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" opacity="{o}"/>'
        for x, y, r, o in pts
    )


DUST = [
    (52, 58, 2.2, ".5"), (96, 34, 1.5, ".38"), (146, 74, 1.8, ".3"),
    (318, 46, 2.4, ".46"), (356, 92, 1.6, ".34"), (262, 28, 1.7, ".4"),
    (28, 128, 1.4, ".26"), (376, 150, 1.5, ".24"), (208, 22, 1.3, ".3"),
]


def bokeh(i, n=11):
    """Unschaerfekreise an festen, je Bild verschiedenen Stellen.

    Der Zufall ist mit der Bildnummer gesaet: jedes Bild bekommt seine eigene
    Anordnung, und ein erneuter Lauf erzeugt genau dieselbe Datei."""
    import random
    rnd = random.Random(i * 7919)
    out = []
    for k in range(n):
        x = rnd.uniform(8, 392)
        y = rnd.uniform(8, 150)
        # wenige grosse, sehr blasse Kreise und mehr kleine: so staffelt sich
        # die Tiefe, statt dass gleich grosse Blasen im Bild stehen
        big = k < 3
        r = rnd.uniform(20, 34) if big else rnd.uniform(5, 13)
        o = rnd.uniform(.08, .16) if big else rnd.uniform(.18, .34)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="url(#bok{i})" opacity="{o:.2f}"/>')
    return "".join(out)


def reflection(i, subject):
    """Die Figur noch einmal, gespiegelt an der Bodenlinie und nach unten
    ausgeblendet. Macht aus dem Boden eine glaenzende Buehne."""
    return (
        f'<g mask="url(#refm{i})" opacity=".55">'
        f'<g transform="translate(0 {2 * GROUND}) scale(1 -1)">{subject}</g></g>'
    )


def scene(i, p, back="", subject="", front="", dust=DUST):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'preserveAspectRatio="xMidYMid slice">'
        + defs(i, p)
        + f'<rect width="{W}" height="{H}" fill="url(#sky{i})"/>'
        + bokeh(i)
        + f'<ellipse cx="200" cy="126" rx="188" ry="128" fill="url(#glow{i})"/>'
        + back
        + beams(i)
        + floor(i)
        + reflection(i, subject)
        + f'<rect y="150" width="{W}" height="90" fill="url(#haze{i})"/>'
        + subject
        + front
        + sparks(dust)
        + f'<rect width="{W}" height="{H}" fill="url(#grade{i})" style="mix-blend-mode:soft-light"/>'
        + f'<rect width="{W}" height="{H}" fill="url(#vig{i})"/>'
        + "</svg>"
    )
