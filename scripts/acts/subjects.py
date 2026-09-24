# -*- coding: utf-8 -*-
"""Figuren und Kulissen je Kuenstler. Immer dieselbe Bodenlinie (y=232),
dieselbe Lichtrichtung (Licht von links oben, Saum von rechts)."""

from art import scene, sparks

GROUND = 232


def gown(i, x=200, top=112, w=52):
    """Stehende Figur im langen Kleid, Kopf + fliessender Saum."""
    return (
        f'<path d="M{x} {top} C{x - 16} {top + 22} {x - 20} {top + 46} {x - w/2} {GROUND} '
        f'Q{x} {GROUND + 12} {x + w/2} {GROUND} '
        f'C{x + 20} {top + 46} {x + 16} {top + 22} {x} {top}Z" fill="url(#fig{i})"/>'
        f'<circle cx="{x}" cy="{top - 12}" r="13" fill="url(#fig{i})"/>'
        f'<path d="M{x + 3} {top - 24} a13 13 0 0 1 9 20 L{x + 14} {GROUND - 4} '
        f'l-9 2 C{x + 18} {top + 40} {x + 14} {top + 20} {x + 3} {top - 24}Z" '
        f'fill="url(#rim{i})" opacity=".85"/>'
    )


def torso(i, x=200, top=118, hw=21):
    """Stehende Figur mit Beinen, fuer Anzug- und Kostuemtypen."""
    return (
        f'<circle cx="{x}" cy="{top - 14}" r="12.5" fill="url(#fig{i})"/>'
        f'<path d="M{x} {top - 2} c-14 0 -{hw} 10 -{hw} 24 l2 34 h{hw - 4} '
        f'l3 {GROUND - top - 58} h11 l3 -{GROUND - top - 58} h{hw - 4} l2 -34 '
        f'c0 -14 -{hw - 7} -24 -{hw} -24Z" fill="url(#fig{i})"/>'
        f'<path d="M{x + 4} {top - 26} a12.5 12.5 0 0 1 7 22 c9 4 12 12 12 22 '
        f'l-2 32 -7 1 2 -34 c0 -12 -5 -18 -12 -20Z" fill="url(#rim{i})" opacity=".8"/>'
    )


# ---------------------------------------------------------------- 1 Eiskoenigin
def snowqueen(i, p):
    back = (
        '<g fill="#12326A" opacity=".5">'
        '<path d="M-6 216 60 128 122 216Z"/><path d="M286 216 348 120 404 216Z"/></g>'
        '<g fill="#1B4A88" opacity=".7"><path d="M76 218 150 132 220 218Z"/>'
        '<path d="M206 218 268 146 326 218Z"/></g>'
    )
    # Kleid hell, Oberkoerper dunkel: so bleibt die Figur lesbar
    figure = (
        f'<path d="M200 132 C182 150 172 188 164 {GROUND} '
        f'Q200 {GROUND + 12} 236 {GROUND} C228 188 218 150 200 132Z" fill="url(#fig{i})"/>'
        f'<path d="M200 108 c-14 0 -21 10 -20 22 l4 14 h32 l4 -14 c1 -12 -6 -22 -20 -22Z" '
        f'fill="#2E5D94"/>'
        f'<circle cx="200" cy="98" r="12" fill="#31659E"/>'
        f'<path d="M188 96 c-2 -14 6 -22 12 -22 s14 8 12 22 c-4 -8 -20 -8 -24 0Z" '
        f'fill="#17406F"/>'
        f'<path d="M182 122 c-14 6 -22 22 -24 40" stroke="#31659E" stroke-width="7" '
        f'fill="none" stroke-linecap="round"/>'
        f'<path d="M218 122 c14 6 22 22 24 40" stroke="#31659E" stroke-width="7" '
        f'fill="none" stroke-linecap="round"/>'
        f'<path d="M206 76 a12 12 0 0 1 5 22 c10 6 12 16 11 26l-7 -1 c1 -9 -1 -15 -9 -19Z" '
        f'fill="url(#rim{i})" opacity=".7"/>'
    )
    crown = (
        '<path d="M184 80 L189 62 L195 76 L200 56 L205 76 L211 62 L216 80Z" '
        'fill="#EAF6FF"/>'
        '<path d="M184 80h32v5h-32Z" fill="#BFE0FB"/>'
        '<circle cx="200" cy="54" r="3" fill="#FFFFFF"/>'
    )
    crystals = sparks([(120, 96, 3, ".55"), (286, 112, 2.6, ".5"), (150, 150, 2, ".4"),
                       (262, 168, 2.2, ".42"), (96, 178, 2.4, ".35")], "#DCEEFF")
    snow = "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#EAF6FF" opacity="{o}"/>'
        for x, y, r, o in [(44, 96, 2.6, ".6"), (334, 66, 2.2, ".55"), (238, 58, 1.8, ".5"),
                           (72, 168, 2, ".4"), (300, 196, 2.4, ".45"), (168, 44, 2, ".5")]
    )
    return scene(i, p, back, figure + crown, crystals + snow)


# ---------------------------------------------------------------- 2 Zauberer
def magician(i, p):
    back = (
        '<path d="M64 218 V96 a136 136 0 0 1 272 0 V218Z" fill="#1B0F3D" opacity=".45"/>'
        '<g stroke="#F7C948" stroke-width="1.2" opacity=".3" fill="none">'
        '<path d="M64 130h272"/><path d="M64 168h272"/></g>'
    )
    hat = ('<path d="M176 96h48v6h-48Z" fill="#0E0A22"/>'
           '<path d="M158 96h84l-6 8h-72Z" fill="#0E0A22"/>'
           '<path d="M180 56h40v42h-40Z" fill="#0E0A22"/>'
           '<path d="M180 82h40v10h-40Z" fill="#F7C948" opacity=".9"/>')
    cape = (f'<path d="M200 112 C168 122 150 168 142 {GROUND} '
            f'L258 {GROUND} C250 168 232 122 200 112Z" fill="url(#fig{i})" opacity=".96"/>')
    wand = ('<path d="M236 148 l40 -26" stroke="#F4EFE2" stroke-width="4" '
            'stroke-linecap="round"/>'
            '<path d="M282 112 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4Z" '
            'fill="#FFE9A8"/>')
    cards = ('<g opacity=".85" fill="#F4EFE2">'
             '<rect x="104" y="118" width="16" height="22" rx="2" transform="rotate(-18 112 129)"/>'
             '<rect x="86" y="150" width="16" height="22" rx="2" transform="rotate(12 94 161)"/>'
             '<rect x="120" y="176" width="16" height="22" rx="2" transform="rotate(-8 128 187)"/>'
             '</g>')
    return scene(i, p, back, cape + torso(i, top=124) + hat, wand + cards)


# ---------------------------------------------------------------- 3 DJ
def dj(i, p):
    back = ('<g opacity=".5">'
            '<path d="M40 -8 L120 214 L86 214 L14 -8Z" fill="#FF8A3D" opacity=".22"/>'
            '<path d="M360 -8 L288 214 L322 214 L390 -8Z" fill="#FF3D8A" opacity=".22"/></g>')
    bars = "".join(
        f'<rect x="{x}" y="{214 - h}" width="12" height="{h}" rx="3" '
        f'fill="#FFD166" opacity=".4"/>'
        for x, h in [(36, 40), (56, 66), (76, 30), (306, 34), (326, 62), (346, 44)]
    )
    booth = (f'<rect x="116" y="176" width="168" height="{GROUND - 176}" rx="6" '
             f'fill="#1A1030"/>'
             f'<rect x="116" y="176" width="168" height="4" fill="#FFD166" opacity=".55"/>')
    decks = ('<circle cx="150" cy="196" r="15" fill="#2B1B4D"/>'
             '<circle cx="150" cy="196" r="4" fill="#FFD166"/>'
             '<circle cx="250" cy="196" r="15" fill="#2B1B4D"/>'
             '<circle cx="250" cy="196" r="4" fill="#FFD166"/>')
    head = (f'<circle cx="200" cy="140" r="16" fill="url(#fig{i})"/>'
            f'<path d="M172 140 a28 28 0 0 1 56 0" stroke="#FFD166" stroke-width="5" '
            f'fill="none" stroke-linecap="round"/>'
            f'<rect x="168" y="136" width="12" height="18" rx="5" fill="#FFD166"/>'
            f'<rect x="220" y="136" width="12" height="18" rx="5" fill="#FFD166"/>'
            f'<path d="M200 156 c-22 0 -34 10 -34 20h68c0 -10 -12 -20 -34 -20Z" '
            f'fill="url(#fig{i})"/>'
            f'<path d="M206 126 a16 16 0 0 1 8 26 c12 3 18 10 18 20h-8c0 -10 -8 -16 -18 -18Z" '
            f'fill="url(#rim{i})" opacity=".7"/>')
    return scene(i, p, back + bars, booth + head + decks)


# ---------------------------------------------------------------- 4 Weihnachtsmann
def santa(i, p):
    back = ('<g fill="#23305E" opacity=".6">'
            '<path d="M52 218 V150 l16 -18 16 18 v68Z"/>'
            '<path d="M324 218 V142 l18 -20 18 20 v76Z"/></g>'
            '<g fill="#2C3D74" opacity=".55">'
            '<path d="M112 218 l24 -44 24 44Z"/><path d="M244 218 l22 -38 22 38Z"/></g>')
    trees = ('<g fill="#0E5A46" opacity=".85">'
             '<path d="M70 206 l16 -34 16 34Z"/><path d="M70 188 l16 -32 16 32Z"/>'
             '<path d="M300 208 l18 -38 18 38Z"/><path d="M300 188 l18 -34 18 34Z"/></g>')
    body = (f'<path d="M200 124 c-26 0 -40 20 -40 42 l-4 {GROUND - 166} h88 '
            f'l-4 -{GROUND - 166 - 0} c0 -22 -14 -42 -40 -42Z" fill="url(#fig{i})"/>'
            f'<circle cx="200" cy="112" r="15" fill="#F6D7BE"/>'
            f'<path d="M184 112 c0 18 8 26 16 26 s16 -8 16 -26 c-6 6 -26 6 -32 0Z" '
            f'fill="#F4F1EC"/>'
            f'<path d="M182 104 c4 -16 32 -16 36 0 l6 -2 c-2 -20 -46 -20 -48 2Z" '
            f'fill="#C62828"/>'
            f'<path d="M178 102h44v7h-44Z" fill="#F4F1EC"/>'
            f'<circle cx="226" cy="86" r="6" fill="#F4F1EC"/>'
            f'<path d="M218 90 c6 -18 4 -26 -6 -30" stroke="#C62828" stroke-width="7" '
            f'fill="none" stroke-linecap="round"/>'
            f'<rect x="176" y="182" width="48" height="12" rx="3" fill="#3B2415"/>'
            f'<rect x="192" y="182" width="16" height="12" rx="2" fill="#E8B44A"/>')
    sack = (f'<path d="M252 {GROUND} c-14 -8 -16 -34 2 -42 22 -10 42 4 40 22 '
            f'-2 12 -12 20 -26 20Z" fill="#7A4A20"/>'
            f'<path d="M256 190 c8 -8 22 -8 30 0" stroke="#5C3312" stroke-width="3" '
            f'fill="none"/>')
    snow = sparks([(60, 64, 2.6, ".6"), (140, 40, 2, ".5"), (300, 58, 2.4, ".55"),
                   (240, 96, 1.8, ".4"), (96, 128, 2.2, ".45"), (348, 150, 2, ".4")], "#EAF3FF")
    return scene(i, p, back + trees, body + sack, snow)


# ---------------------------------------------------------------- 5 Mentalist
def mentalist(i, p):
    back = ('<circle cx="252" cy="118" r="78" fill="none" stroke="#8FB6FF" '
            'stroke-width="1.2" opacity=".26"/>'
            '<circle cx="252" cy="118" r="110" fill="none" stroke="#8FB6FF" '
            'stroke-width="1" opacity=".16"/>')
    orb = ('<circle cx="252" cy="112" r="30" fill="#9FD2FF" opacity=".2"/>'
           '<circle cx="252" cy="112" r="17" fill="#CDEBFF" opacity=".85"/>'
           '<circle cx="246" cy="106" r="5.5" fill="#fff" opacity=".9"/>')
    hands = (f'<path d="M182 152 c4 -20 14 -32 28 -38" stroke="url(#fig{i})" '
             f'stroke-width="10" fill="none" stroke-linecap="round"/>'
             f'<path d="M218 150 c10 -16 22 -24 34 -26" stroke="url(#fig{i})" '
             f'stroke-width="10" fill="none" stroke-linecap="round"/>')
    cards = ('<g fill="#E8F1FF" opacity=".8">'
             '<rect x="108" y="124" width="17" height="24" rx="2" transform="rotate(-22 116 136)"/>'
             '<rect x="300" y="166" width="17" height="24" rx="2" transform="rotate(18 308 178)"/>'
             '<rect x="130" y="180" width="17" height="24" rx="2" transform="rotate(9 138 192)"/>'
             '</g>')
    return scene(i, p, back, torso(i, x=190, top=150) + hands, orb + cards)


# ---------------------------------------------------------------- 6 Taenzerin
def dancer(i, p):
    back = ('<path d="M0 218 C90 176 150 206 200 176 C252 146 320 190 400 158 V218Z" '
            'fill="#7A1148" opacity=".35"/>')
    ribbon = ('<path d="M96 196 C128 132 176 188 208 128 C236 76 300 116 330 74" '
              'stroke="#FFC2E6" stroke-width="4.5" fill="none" opacity=".75" '
              'stroke-linecap="round"/>')
    figure = (f'<g transform="rotate(-8 200 180)">'
              f'<circle cx="198" cy="106" r="12" fill="url(#fig{i})"/>'
              f'<path d="M198 118 c-12 2 -18 12 -16 24 l6 26 -14 54 h12 l14 -44 '
              f'12 44 h12 l-10 -56 4 -24 c2 -12 -6 -22 -20 -24Z" fill="url(#fig{i})"/>'
              f'<path d="M186 126 c-16 -6 -26 -18 -30 -32" stroke="url(#fig{i})" '
              f'stroke-width="8" fill="none" stroke-linecap="round"/>'
              f'<path d="M212 126 c16 -10 22 -24 22 -38" stroke="url(#fig{i})" '
              f'stroke-width="8" fill="none" stroke-linecap="round"/>'
              f'<path d="M204 96 a12 12 0 0 1 4 24 c10 4 14 12 12 24l-6 -2 '
              f'c2 -10 -2 -16 -12 -18Z" fill="url(#rim{i})" opacity=".75"/></g>')
    return scene(i, p, back + ribbon, figure)


# ---------------------------------------------------------------- 7 Clown
def clown(i, p):
    back = ('<path d="M0 46 Q60 96 120 46 Q180 96 240 46 Q300 96 360 46 Q390 78 400 52 V-4H0Z" '
            'fill="#0C5E4C" opacity=".5"/>'
            '<g stroke="#8FF3D6" stroke-width="1.4" opacity=".3" fill="none">'
            '<path d="M0 62 Q60 112 120 62 Q180 112 240 62 Q300 112 360 62"/></g>')
    balloons = "".join(
        f'<g><path d="M{x} {y + 12} L248 176" stroke="#DFF7EE" stroke-width="1" '
        f'opacity=".45"/><ellipse cx="{x}" cy="{y}" rx="13" ry="16" fill="{c}" '
        f'opacity=".92"/><ellipse cx="{x - 4}" cy="{y - 5}" rx="4" ry="5" fill="#fff" '
        f'opacity=".4"/></g>'
        for x, y, c in [(276, 74, "#FF6B6B"), (306, 96, "#FFD166"), (288, 118, "#4ECDC4"),
                        (320, 62, "#A78BFA")]
    )
    figure = (torso(i, x=176, top=126) +
              '<circle cx="176" cy="112" r="5" fill="#FF5A5A"/>'
              '<path d="M158 104 a20 20 0 0 1 36 0Z" fill="#FFD166" opacity=".9"/>'
              '<path d="M156 108 c-8 0 -10 10 -2 12" stroke="#FF8A3D" stroke-width="5" '
              'fill="none" stroke-linecap="round"/>'
              '<path d="M196 108 c8 0 10 10 2 12" stroke="#FF8A3D" stroke-width="5" '
              'fill="none" stroke-linecap="round"/>')
    confetti = sparks([(72, 108, 3, ".5"), (108, 158, 2.4, ".45"), (60, 178, 2.6, ".4"),
                       (336, 176, 2.4, ".4"), (128, 88, 2, ".4")], "#FFE9A8")
    return scene(i, p, back, figure + balloons, confetti)


# ---------------------------------------------------------------- 8 Akrobatik
def acrobat(i, p):
    back = ('<g opacity=".35" fill="#7A5410">'
            '<path d="M-4 218 C60 150 120 190 180 140 L180 218Z"/>'
            '<path d="M404 218 C340 150 280 190 220 140 L220 218Z"/></g>')
    silks = ('<path d="M120 -6 C140 70 112 140 132 218" stroke="#FFE1A8" stroke-width="7" '
             'fill="none" opacity=".45"/>'
             '<path d="M282 -6 C262 70 292 140 270 218" stroke="#FFE1A8" stroke-width="7" '
             'fill="none" opacity=".45"/>')
    hoop = ('<path d="M200 -4 V54" stroke="#F2C35C" stroke-width="3"/>'
            '<circle cx="200" cy="116" r="60" fill="none" stroke="#F2C35C" stroke-width="6"/>'
            '<circle cx="200" cy="116" r="60" fill="none" stroke="#FFF3D0" stroke-width="2" '
            'opacity=".6"/>')
    figure = (f'<g>'
              f'<circle cx="200" cy="94" r="11" fill="url(#fig{i})"/>'
              f'<path d="M200 105 c-10 0 -15 8 -13 18 l5 22 c-14 16 -22 26 -26 40 l11 5 '
              f'c6 -14 14 -24 24 -34 10 10 18 20 24 34 l11 -5 c-4 -14 -12 -24 -26 -40 '
              f'l5 -22 c2 -10 -5 -18 -15 -18Z" fill="url(#fig{i})"/>'
              f'<path d="M188 112 c-18 -2 -28 -14 -30 -30" stroke="url(#fig{i})" '
              f'stroke-width="7.5" fill="none" stroke-linecap="round"/>'
              f'<path d="M212 112 c18 -2 28 -14 30 -30" stroke="url(#fig{i})" '
              f'stroke-width="7.5" fill="none" stroke-linecap="round"/>'
              f'<path d="M205 84 a11 11 0 0 1 3 22 c9 3 11 10 10 18l-6 -1 c1 -8 -2 -12 -10 -14Z" '
              f'fill="url(#rim{i})" opacity=".8"/></g>')
    return scene(i, p, back + silks, hoop + figure)


# ---------------------------------------------------------------- Helden
def skyline(color="#101A3A", op=".6", base=218):
    blocks = [(-6, 148, 40), (38, 120, 30), (72, 156, 34), (110, 132, 26),
              (250, 138, 30), (284, 160, 34), (322, 124, 32), (358, 150, 46)]
    return f'<g fill="{color}" opacity="{op}">' + "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{base - y}"/>' for x, y, w in blocks
    ) + "</g>"


def windows():
    pts = []
    for x in (4, 20, 46, 80, 94, 258, 292, 330, 366, 382):
        for y in (140, 160, 180, 200):
            pts.append((x + 4, y, 1.6, ".35"))
    return sparks(pts, "#9FD2FF")


def hero(i, p, cape="#1E5BCF", single=True):
    back = skyline() + windows()
    burst = ('<g opacity=".35" stroke="#BBD8FF" stroke-width="2" fill="none">'
             '<path d="M200 44 V14"/><path d="M150 60 L132 36"/><path d="M250 60 L268 36"/>'
             '<path d="M118 100 L88 90"/><path d="M282 100 L312 90"/></g>')

    def figure(x, capecol, scale=1.0):
        return (f'<g transform="translate({x} 0) scale({scale}) translate({(1 - scale) * 200 / scale:.0f} 0)">'
                f'<path d="M200 126 c-30 6 -44 44 -56 {GROUND - 132} h34 c6 -30 14 -52 22 -66Z" '
                f'fill="{capecol}" opacity=".9"/>'
                f'<path d="M200 126 c30 6 44 44 56 {GROUND - 132} h-34 c-6 -30 -14 -52 -22 -66Z" '
                f'fill="{capecol}" opacity=".7"/>'
                f'{torso(i, top=128)}'
                f'<path d="M186 106 a14 14 0 0 1 28 0Z" fill="#FFFFFF" opacity=".18"/>'
                f'</g>')

    if single:
        subject = figure(0, cape)
    else:
        subject = figure(-52, cape, .86) + figure(52, "#C2185B", .86)
    return scene(i, p, back, subject, burst)


def comet(i, p):
    back = (skyline("#2A1038", ".55") + windows() +
            '<path d="M40 40 C120 60 200 40 300 92" stroke="#FFB3E6" stroke-width="3" '
            'fill="none" opacity=".55"/>'
            '<circle cx="316" cy="98" r="10" fill="#FFD9F2" opacity=".8"/>')
    trail = ('<path d="M92 214 C130 180 160 168 190 160" stroke="#FF8AD4" stroke-width="6" '
             'fill="none" opacity=".45" stroke-linecap="round"/>')
    figure = (f'<g transform="rotate(-12 200 170)">'
              f'<path d="M200 128 c-34 8 -50 40 -62 {GROUND - 136} h34 c8 -30 18 -52 28 -64Z" '
              f'fill="#E0409A" opacity=".85"/>'
              f'{torso(i, top=130)}'
              f'<path d="M186 108 a14 14 0 0 1 28 0Z" fill="#FFFFFF" opacity=".2"/></g>')
    stars = sparks([(66, 76, 2.6, ".6"), (140, 52, 2, ".5"), (334, 150, 2.4, ".45"),
                    (268, 60, 1.8, ".45")], "#FFE3F6")
    return scene(i, p, back, trail + figure, stars)


# ---------------------------------------------------------------- 20-22 Buehne
def musician(i, p):
    back = ('<rect x="36" y="150" width="58" height="68" rx="6" fill="#1D1330" opacity=".9"/>'
            '<circle cx="65" cy="184" r="18" fill="#3A2A55"/>'
            '<rect x="306" y="150" width="58" height="68" rx="6" fill="#1D1330" opacity=".9"/>'
            '<circle cx="335" cy="184" r="18" fill="#3A2A55"/>')
    notes = ('<g fill="#FFD9A8" opacity=".65">'
             '<circle cx="120" cy="92" r="6"/><rect x="124" y="66" width="2.5" height="28"/>'
             '<circle cx="286" cy="70" r="5"/><rect x="289" y="48" width="2.5" height="24"/>'
             '</g>')
    # Korpus vor dem Bauch, Hals schraeg nach links oben - so liest es sich
    # sofort als Gitarre und nicht als Ball
    guitar = ('<g transform="rotate(-24 214 182)">'
              '<path d="M196 166 c-13 0 -22 9 -22 20 0 8 5 14 12 16 -7 3 -12 9 -12 17 '
              '0 12 10 21 24 21 15 0 26 -10 26 -23 0 -9 -5 -16 -13 -19 8 -3 13 -9 13 -17 '
              '0 -10 -10 -17 -22 -17Z" fill="#C2681E"/>'
              '<ellipse cx="198" cy="202" rx="7" ry="7" fill="#4A2408"/>'
              '<rect x="192" y="98" width="11" height="70" rx="3" fill="#8A4A14"/>'
              '<rect x="189" y="86" width="17" height="16" rx="3" fill="#5E3009"/>'
              '<g stroke="#F3DDB6" stroke-width=".9" opacity=".7">'
              '<path d="M194 100 V214"/><path d="M198 100 V214"/><path d="M202 100 V214"/></g>'
              '</g>')
    arm = (f'<path d="M182 150 c-6 16 0 30 14 38" stroke="url(#fig{i})" stroke-width="9" '
           f'fill="none" stroke-linecap="round"/>'
           f'<path d="M216 148 c10 12 12 26 6 38" stroke="url(#fig{i})" stroke-width="9" '
           f'fill="none" stroke-linecap="round"/>')
    return scene(i, p, back, torso(i, x=200, top=126) + guitar + arm, notes)


def stiltwalker(i, p):
    back = ('<g stroke="#FFE0B8" stroke-width="1.4" opacity=".4" fill="none">'
            '<path d="M-4 40 Q100 80 200 40 Q300 80 404 40"/></g>' +
            sparks([(48, 52, 3, ".5"), (112, 62, 2.6, ".45"), (200, 40, 3, ".5"),
                    (288, 62, 2.6, ".45"), (352, 52, 3, ".5")], "#FFE9C2"))
    # Zwei schlanke Stelzen vom Saum bis zum Boden, mit Trittbrett und Schuh
    stilts = ('<path d="M190 132 L176 236" stroke="#E8DCC2" stroke-width="5"/>'
              '<path d="M210 132 L226 236" stroke="#E8DCC2" stroke-width="5"/>'
              '<rect x="170" y="138" width="22" height="5" rx="2" fill="#C9B68E" '
              'transform="rotate(-8 181 140)"/>'
              '<rect x="208" y="138" width="22" height="5" rx="2" fill="#C9B68E" '
              'transform="rotate(8 219 140)"/>'
              '<path d="M172 130 h20 l2 8 h-24Z" fill="#2F1C0C"/>'
              '<path d="M208 130 h20 l2 8 h-24Z" fill="#2F1C0C"/>')
    coat = (f'<path d="M200 74 c-19 3 -27 20 -27 39 l-3 20 c11 6 49 6 60 0 l-3 -20 '
            f'c0 -19 -8 -36 -27 -39Z" fill="url(#fig{i})"/>'
            f'<path d="M175 122 c15 6 35 6 50 0 l-4 14 c-13 5 -29 5 -42 0Z" '
            f'fill="#F2C35C" opacity=".5"/>')
    head = (f'<circle cx="200" cy="60" r="12" fill="url(#fig{i})"/>'
            f'<path d="M187 53 a13 13 0 0 1 26 0Z" fill="#F2C35C"/>'
            f'<path d="M200 30 l4 10 10 2 -10 4 -4 10 -4 -10 -10 -4 10 -2Z" '
            f'fill="#FFE9C2" opacity=".9"/>'
            f'<path d="M205 44 a12 12 0 0 1 4 22 c11 5 15 16 15 28l-7 1 '
            f'c0 -12 -4 -20 -13 -24Z" fill="url(#rim{i})" opacity=".7"/>')
    arms = (f'<path d="M175 92 c-17 -6 -28 -15 -33 -28" stroke="url(#fig{i})" '
            f'stroke-width="8" fill="none" stroke-linecap="round"/>'
            f'<path d="M225 92 c17 -6 28 -15 33 -28" stroke="url(#fig{i})" '
            f'stroke-width="8" fill="none" stroke-linecap="round"/>')
    flags = ('<path d="M142 66 V28" stroke="#E8DCC2" stroke-width="3"/>'
             '<path d="M142 30 l26 8 -26 10Z" fill="#FF6B6B"/>'
             '<path d="M258 66 V28" stroke="#E8DCC2" stroke-width="3"/>'
             '<path d="M258 30 l-26 8 26 10Z" fill="#4ECDC4"/>')
    return scene(i, p, back, stilts + coat + arms + head, flags)


def eventstage(i, p):
    import math
    arch = []
    cols = ["#FF6B6B", "#FFD166", "#4ECDC4", "#A78BFA", "#FF8AD4"]
    for k in range(19):
        a = math.pi * k / 18
        x = 200 - 150 * math.cos(a)
        y = 228 - 150 * math.sin(a) * 0.92
        r = 10 if k % 2 == 0 else 8
        c = cols[k % len(cols)]
        arch.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{c}" opacity=".9"/>')
        arch.append(f'<circle cx="{x - r / 3:.0f}" cy="{y - r / 3:.0f}" r="{r / 3.4:.1f}" '
                    f'fill="#fff" opacity=".45"/>')
    stage = ('<rect x="104" y="200" width="192" height="10" rx="3" fill="#2B1550"/>'
             '<rect x="104" y="210" width="192" height="8" fill="#1B0C36" opacity=".9"/>')
    carpet = ('<path d="M160 218 h80 l46 42 h-172Z" fill="#8A1240" opacity=".7"/>'
              '<path d="M160 218 h80 l4 4 h-88Z" fill="#C2185B" opacity=".6"/>')
    lanterns = ('<g>'
                '<rect x="78" y="206" width="16" height="26" rx="3" fill="#2B1550"/>'
                '<rect x="72" y="198" width="28" height="10" rx="4" fill="#3B1F68"/>'
                '<circle cx="86" cy="192" r="7" fill="#FFD166" opacity=".95"/>'
                '<rect x="306" y="206" width="16" height="26" rx="3" fill="#2B1550"/>'
                '<rect x="300" y="198" width="28" height="10" rx="4" fill="#3B1F68"/>'
                '<circle cx="314" cy="192" r="7" fill="#FFD166" opacity=".95"/></g>')
    tables = carpet + lanterns
    lights = ('<g stroke="#FFE9A8" stroke-width="1.2" opacity=".45" fill="none">'
              '<path d="M-4 30 Q90 70 184 34"/><path d="M216 34 Q310 70 404 30"/></g>' +
              sparks([(30, 44, 2.6, ".55"), (78, 58, 2.4, ".5"), (126, 52, 2.4, ".5"),
                      (274, 52, 2.4, ".5"), (322, 58, 2.4, ".5"), (370, 44, 2.6, ".55")],
                     "#FFE9A8"))
    return scene(i, p, "".join(arch), stage + tables, lights)


# ---------------------------------------------------------------- Comedy-Club
def comedy(i, p):
    back = ('<rect x="-4" y="60" width="408" height="158" fill="#2A1414" opacity=".55"/>'
            '<g stroke="#7A4230" stroke-width="1.2" opacity=".45" fill="none">'
            + "".join(f'<path d="M-4 {y}h408"/>' for y in range(76, 218, 18))
            + "".join(f'<path d="M{x} 60V218"/>' for x in range(16, 400, 46)) + '</g>'
            '<path d="M-4 60h408v8H-4Z" fill="#3A1C14" opacity=".7"/>')
    stool = ('<path d="M252 196h34v5h-34Z" fill="#2B1608"/>'
             '<path d="M256 200l4 32M282 200l-4 32" stroke="#2B1608" stroke-width="4" '
             'stroke-linecap="round"/>')
    mic = ('<path d="M150 232V126" stroke="#D8CFC4" stroke-width="4" stroke-linecap="round"/>'
           '<path d="M132 232h36" stroke="#2B2118" stroke-width="6" stroke-linecap="round"/>'
           '<path d="M150 126c8-10 20-12 28-6" stroke="#D8CFC4" stroke-width="4" '
           'fill="none" stroke-linecap="round"/>'
           '<ellipse cx="184" cy="116" rx="11" ry="14" fill="#3A2C22"/>'
           '<ellipse cx="184" cy="116" rx="7" ry="10" fill="#5C4636"/>')
    glow = ('<ellipse cx="184" cy="116" rx="46" ry="46" fill="#FFD9A8" opacity=".16"/>')
    return scene(i, p, back, stool + mic, glow)


# ---------------------------------------------------------------- Pantomime
def pantomime(i, p):
    back = ('<circle cx="200" cy="120" r="92" fill="#FFFFFF" opacity=".07"/>'
            '<circle cx="200" cy="120" r="126" fill="#FFFFFF" opacity=".04"/>')
    wall = ('<g stroke="#EAF0FA" stroke-width="1.6" opacity=".4" fill="none" '
            'stroke-dasharray="7 8">'
            '<path d="M254 78V214"/><path d="M254 78h58"/><path d="M254 214h58"/></g>')
    figure = (f'<circle cx="196" cy="96" r="13" fill="#F2F5FB"/>'
              f'<path d="M196 84c-8 0-12 6-11 13 1 6 5 10 11 10s10-4 11-10c1-7-3-13-11-13Z" '
              f'fill="#F7FAFF"/>'
              f'<circle cx="191" cy="95" r="2" fill="#1B2340"/><circle cx="201" cy="95" r="2" fill="#1B2340"/>'
              f'<path d="M192 104c3 3 8 3 11 0" stroke="#1B2340" stroke-width="1.6" fill="none" '
              f'stroke-linecap="round"/>'
              f'<path d="M196 110c-15 0-23 10-22 23l3 26h38l3-26c1-13-7-23-22-23Z" fill="url(#fig{i})"/>'
              f'<g stroke="#F2F5FB" stroke-width="3" opacity=".85">'
              f'<path d="M178 128h36"/><path d="M178 140h36"/><path d="M178 152h36"/></g>'
              f'<path d="M178 162h36l4 {GROUND - 166}h-44Z" fill="#1B2340"/>'
              f'<path d="M216 122c14 2 26 10 32 22" stroke="url(#fig{i})" stroke-width="9" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M176 122c-12 4-20 14-22 26" stroke="url(#fig{i})" stroke-width="9" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M188 76a13 13 0 0 1 24 4l-24 6Z" fill="#1B2340"/>'
              f'<path d="M182 78h32v4h-32Z" fill="#1B2340"/>')
    return scene(i, p, back + wall, figure)


# ---------------------------------------------------------------- Feuershow
def firestreet(i, p):
    back = ('<g fill="#2C1208" opacity=".7">'
            '<path d="M-4 218V132h54v86Z"/><path d="M62 218V150h44v68Z"/>'
            '<path d="M300 218V144h46v74Z"/><path d="M356 218V126h48v92Z"/></g>'
            + sparks([(16, 150, 2, ".4"), (34, 176, 2, ".4"), (78, 168, 2, ".35"),
                      (316, 162, 2, ".4"), (372, 148, 2, ".4")], "#FFD9A8"))
    glow = ('<ellipse cx="200" cy="150" rx="128" ry="92" fill="#FF8A3D" opacity=".16"/>')
    fire = ('<g>'
            '<circle cx="112" cy="112" r="15" fill="#FFD166" opacity=".55"/>'
            '<path d="M112 100c7 5 9 12 4 17-5 4-12 2-13-4-1-5 3-9 9-13Z" fill="#FF8A3D"/>'
            '<circle cx="290" cy="128" r="15" fill="#FFD166" opacity=".5"/>'
            '<path d="M290 116c7 5 9 12 4 17-5 4-12 2-13-4-1-5 3-9 9-13Z" fill="#FF6B4A"/>'
            '<path d="M120 116C160 96 240 106 284 130" stroke="#FFB46B" stroke-width="2.4" '
            'fill="none" opacity=".5"/></g>')
    figure = (f'<circle cx="200" cy="104" r="12" fill="url(#fig{i})"/>'
              f'<path d="M200 116c-15 0-22 10-21 22l4 20-10 {GROUND - 158}h11l12-32 12 32h11'
              f'l-10-{GROUND - 158} 4-20c1-12-6-22-21-22Z" fill="url(#fig{i})"/>'
              f'<path d="M184 124c-22-2-46 0-66-8" stroke="url(#fig{i})" stroke-width="8" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M216 126c22 0 46 4 66-2" stroke="url(#fig{i})" stroke-width="8" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M206 94a12 12 0 0 1 4 24c10 5 13 14 12 24l-7 1c1-10-2-16-11-19Z" '
              f'fill="url(#rim{i})" opacity=".65"/>')
    return scene(i, p, back + glow, figure + fire)


# ---------------------------------------------------------------- Cyr-Rad
def cyrwheel(i, p):
    back = ('<g opacity=".3" fill="#8A6410">'
            '<path d="M-4 218C56 160 116 190 172 146V218Z"/>'
            '<path d="M404 218C344 160 284 190 228 146V218Z"/></g>')
    wheel = ('<circle cx="200" cy="140" r="78" fill="none" stroke="#F2C35C" stroke-width="7"/>'
             '<circle cx="200" cy="140" r="78" fill="none" stroke="#FFF3D0" stroke-width="2.4" '
             'opacity=".55"/>')
    figure = (f'<g transform="rotate(-16 200 140)">'
              f'<circle cx="200" cy="82" r="11" fill="url(#fig{i})"/>'
              f'<path d="M200 93c-9 0-14 7-13 16l4 26-8 58h11l10-46 10 46h11l-8-58 4-26'
              f'c1-9-4-16-13-16Z" fill="url(#fig{i})"/>'
              f'<path d="M188 100c-18 6-28 20-30 38" stroke="url(#fig{i})" stroke-width="7.5" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M212 100c18 6 28 20 30 38" stroke="url(#fig{i})" stroke-width="7.5" '
              f'fill="none" stroke-linecap="round"/>'
              f'<path d="M205 72a11 11 0 0 1 3 22c9 3 11 10 10 18l-6-1c1-8-2-12-10-14Z" '
              f'fill="url(#rim{i})" opacity=".8"/></g>')
    return scene(i, p, back, wheel + figure)


# ---------------------------------------------------------------- Hochzeit
def weddingarch(i, p):
    arch = ('<path d="M112 232V150a88 88 0 0 1 176 0v82" fill="none" stroke="#E8DCC8" '
            'stroke-width="7"/>')
    flowers = "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".9"/>'
        for x, y, r, c in [
            (112, 176, 8, "#F6D9E6"), (118, 148, 7, "#FBE7F1"), (134, 120, 8, "#F2C9DE"),
            (160, 98, 7, "#FBE7F1"), (196, 88, 9, "#F6D9E6"), (232, 96, 7, "#FBE7F1"),
            (258, 116, 8, "#F2C9DE"), (276, 144, 7, "#FBE7F1"), (286, 172, 8, "#F6D9E6"),
            (124, 204, 7, "#F2C9DE"), (280, 202, 7, "#F2C9DE"),
        ]
    ) + "".join(
        f'<circle cx="{x}" cy="{y}" r="3" fill="#CFE6D2" opacity=".8"/>'
        for x, y in [(126, 162), (146, 132), (176, 92), (216, 90), (248, 106), (282, 158)]
    )
    lights = ('<g stroke="#FFE9C2" stroke-width="1.2" opacity=".45" fill="none">'
              '<path d="M-4 52Q90 92 184 56"/><path d="M216 56Q310 92 404 52"/></g>' +
              sparks([(28, 64, 2.6, ".55"), (76, 78, 2.4, ".5"), (124, 70, 2.4, ".5"),
                      (276, 70, 2.4, ".5"), (324, 78, 2.4, ".5"), (372, 64, 2.6, ".55")],
                     "#FFE9C2"))
    aisle = ('<path d="M166 232h68l40 48H126Z" fill="#F3E7FF" opacity=".5"/>'
             '<g fill="#2B1550" opacity=".8">'
             '<rect x="92" y="206" width="26" height="6" rx="3"/>'
             '<rect x="100" y="212" width="5" height="18"/>'
             '<rect x="282" y="206" width="26" height="6" rx="3"/>'
             '<rect x="290" y="212" width="5" height="18"/></g>')
    return scene(i, p, arch + flowers, aisle, lights)


# ---------------------------------------------------------------- Band
def _player(i, x, kind, scale=1.0):
    """Ein Bandmitglied: 'voc' am Mikro, 'git' mit Gitarre, 'bass' seitlich."""
    head_y = 118
    body = (f'<circle cx="{x}" cy="{head_y}" r="11" fill="url(#fig{i})"/>'
            f'<path d="M{x} {head_y + 11}c-13 0-19 9-18 20l3 20 4 {GROUND - head_y - 55}h7'
            f'l4-26 4 26h7l4-{GROUND - head_y - 55} 3-20c1-11-5-20-18-20Z" fill="url(#fig{i})"/>')
    if kind == "voc":
        extra = (f'<path d="M{x - 20} {head_y + 4}l16-2" stroke="url(#fig{i})" stroke-width="7" '
                 f'stroke-linecap="round"/>'
                 f'<path d="M{x - 34} {GROUND}V{head_y - 6}" stroke="#D8CFC4" stroke-width="3"/>'
                 f'<ellipse cx="{x - 34}" cy="{head_y - 12}" rx="7" ry="9" fill="#3A2C22"/>'
                 f'<ellipse cx="{x - 34}" cy="{head_y - 12}" rx="4" ry="6" fill="#6B5342"/>')
    elif kind == "git":
        extra = ('<g transform="translate(%d 0) rotate(-22 %d 168)">' % (0, x) +
                 f'<path d="M{x - 4} 150c-11 0-19 8-19 18 0 11 9 19 20 19s20-8 20-19'
                 f'c0-10-9-18-21-18Z" fill="#C2681E"/>'
                 f'<circle cx="{x - 3}" cy="168" r="5.5" fill="#4A2408"/>'
                 f'<rect x="{x - 8}" y="112" width="9" height="44" rx="3" fill="#8A4A14"/>'
                 f'<rect x="{x - 11}" y="102" width="15" height="13" rx="3" fill="#5E3009"/></g>')
    else:
        extra = (f'<path d="M{x + 16} {head_y + 10}c10 4 16 12 18 22" stroke="url(#fig{i})" '
                 f'stroke-width="7" fill="none" stroke-linecap="round"/>'
                 f'<rect x="{x + 26}" y="150" width="8" height="42" rx="4" fill="#8A4A14"/>')
    rim = (f'<path d="M{x + 4} {head_y - 10}a11 11 0 0 1 3 21c9 3 12 10 11 18l-6-1'
           f'c1-8-2-12-10-14Z" fill="url(#rim{i})" opacity=".7"/>')
    return f'<g transform="translate({x}) scale({scale}) translate({-x})">{body}{extra}{rim}</g>'


def bandstage(i, p, style="rock"):
    back = ('<rect x="30" y="150" width="52" height="68" rx="6" fill="#1D1330" opacity=".9"/>'
            '<circle cx="56" cy="184" r="16" fill="#3A2A55"/>'
            '<rect x="318" y="150" width="52" height="68" rx="6" fill="#1D1330" opacity=".9"/>'
            '<circle cx="344" cy="184" r="16" fill="#3A2A55"/>'
            '<path d="M0 60h400" stroke="#FFD9A8" stroke-width="1" opacity=".18"/>')
    drums = ('<ellipse cx="292" cy="196" rx="34" ry="12" fill="#2A1A48"/>'
             '<path d="M258 196v-18a34 12 0 0 1 68 0v18Z" fill="#3A2560"/>'
             '<ellipse cx="292" cy="178" rx="34" ry="12" fill="#E8DCC2" opacity=".9"/>'
             '<ellipse cx="292" cy="178" rx="20" ry="7" fill="#CBBBA0" opacity=".6"/>'
             '<path d="M252 168l-16-12" stroke="#C9A227" stroke-width="2.4"/>'
             '<ellipse cx="232" cy="154" rx="17" ry="4" fill="#E8C15A"/>'
             '<path d="M332 168l14-14" stroke="#C9A227" stroke-width="2.4"/>'
             '<ellipse cx="350" cy="152" rx="15" ry="3.6" fill="#E8C15A"/>')
    notes = ('<g fill="#FFD9A8" opacity=".55">'
             '<circle cx="96" cy="82" r="5"/><rect x="99" y="60" width="2.4" height="24"/>'
             '<circle cx="312" cy="66" r="4.4"/><rect x="315" y="46" width="2.2" height="22"/></g>')
    if style == "brass":
        players = _player(i, 136, "bass") + _player(i, 200, "voc") + _player(i, 264, "bass", .95)
        front = notes
        mid = ""
    else:
        players = _player(i, 128, "git") + _player(i, 196, "voc")
        front = notes
        mid = drums
    return scene(i, p, back, mid + players, front)


# ---------------------------------------------------------------- Hypnotiseur
def hypnotist(i, p):
    spiral = '<g fill="none" stroke="#C9B6FF" stroke-width="1.4" opacity=".32">'
    for k in range(1, 8):
        spiral += f'<circle cx="262" cy="104" r="{k * 13}"/>'
    spiral += '</g>'
    swirl = ('<path d="M262 104 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a18 18 0 1 1 -18 -18 '
             'a24 24 0 1 1 24 24" fill="none" stroke="#E6DCFF" stroke-width="2.2" opacity=".55"/>')
    arm = (f'<path d="M212 150 c14 -10 26 -22 34 -40" stroke="url(#fig{i})" stroke-width="10" '
           f'fill="none" stroke-linecap="round"/>'
           f'<path d="M186 152 c-6 14 -4 28 4 38" stroke="url(#fig{i})" stroke-width="9" '
           f'fill="none" stroke-linecap="round"/>')
    pendulum = ('<path d="M246 108 L270 172" stroke="#E9DFC8" stroke-width="1.6"/>'
                '<circle cx="272" cy="178" r="9" fill="#FFD36A"/>'
                '<circle cx="269" cy="175" r="3" fill="#FFF3C4"/>'
                '<circle cx="272" cy="178" r="22" fill="#FFD36A" opacity=".18"/>')
    trail = ('<path d="M244 186 q28 12 56 -4" stroke="#FFD36A" stroke-width="1.4" fill="none" '
             'opacity=".35" stroke-dasharray="3 5"/>')
    return scene(i, p, spiral + swirl, torso(i, x=196, top=132) + arm, pendulum + trail)


# ---------------------------------------------------------------- Moderator
def host(i, p):
    back = ('<rect x="40" y="74" width="320" height="120" rx="10" fill="#0E1633" opacity=".75"/>'
            '<rect x="52" y="86" width="296" height="96" rx="6" fill="#1C2C66" opacity=".8"/>'
            '<path d="M70 158 l40 -30 30 18 44 -40 36 26 40 -22 38 30" stroke="#8FD3FF" '
            'stroke-width="2.4" fill="none" opacity=".7"/>'
            '<g fill="#8FD3FF" opacity=".5"><rect x="70" y="100" width="70" height="6" rx="3"/>'
            '<rect x="70" y="112" width="44" height="6" rx="3"/></g>')
    podium = ('<path d="M246 170 h64 l-6 62 h-52 Z" fill="#1A1F3D"/>'
              '<path d="M244 164 h68 v10 h-68 Z" fill="#2B3566"/>'
              '<rect x="266" y="192" width="24" height="16" rx="3" fill="#6B8CFF" opacity=".75"/>'
              '<path d="M274 164 c0 -12 -2 -20 -10 -26" stroke="#C9CFE0" stroke-width="2.2" fill="none"/>'
              '<ellipse cx="262" cy="136" rx="4" ry="5.5" fill="#39405E"/>')
    card = (f'<path d="M176 148 c-8 12 -8 24 -2 32" stroke="url(#fig{i})" stroke-width="9" '
            f'fill="none" stroke-linecap="round"/>'
            '<rect x="166" y="176" width="16" height="22" rx="2" fill="#F2F4FA" '
            'transform="rotate(-12 174 187)"/>'
            f'<path d="M212 148 c12 6 22 8 32 4" stroke="url(#fig{i})" stroke-width="9" '
            f'fill="none" stroke-linecap="round"/>')
    return scene(i, p, back, torso(i, x=196, top=128) + card, podium)


# ---------------------------------------------------------------- Fotograf
def photographer(i, p):
    back = ('<rect x="258" y="70" width="96" height="150" rx="4" fill="#E9EEF8" opacity=".14"/>'
            '<path d="M258 70 L306 36 L354 70" fill="#E9EEF8" opacity=".1"/>'
            '<path d="M306 36 V70" stroke="#E9EEF8" stroke-width="1.5" opacity=".35"/>'
            '<g stroke="#C8D2E6" stroke-width="2.2" opacity=".55">'
            '<path d="M306 150 L290 232"/><path d="M306 150 L322 232"/><path d="M306 150 V232"/></g>'
            '<path d="M60 232 L84 150 L108 232" stroke="#C8D2E6" stroke-width="2" fill="none" opacity=".4"/>'
            '<rect x="70" y="108" width="28" height="44" rx="3" fill="#FFFFFF" opacity=".25"/>')
    camera = ('<rect x="214" y="118" width="42" height="28" rx="5" fill="#1B1D26"/>'
              '<rect x="222" y="112" width="14" height="8" rx="2" fill="#1B1D26"/>'
              '<circle cx="238" cy="132" r="11" fill="#2C3040"/>'
              '<circle cx="238" cy="132" r="7" fill="#5A7BD6"/>'
              '<circle cx="235" cy="129" r="2.4" fill="#DCE6FF"/>'
              '<rect x="246" y="114" width="8" height="4" rx="1" fill="#E23A5A"/>')
    arms = (f'<path d="M186 150 c10 -6 20 -14 30 -18" stroke="url(#fig{i})" stroke-width="10" '
            f'fill="none" stroke-linecap="round"/>'
            f'<path d="M214 152 c14 0 30 -8 38 -16" stroke="url(#fig{i})" stroke-width="10" '
            f'fill="none" stroke-linecap="round"/>')
    flash = ('<circle cx="236" cy="130" r="40" fill="#FFFFFF" opacity=".12"/>'
             '<path d="M236 76 v14 M270 96 l-10 9 M202 96 l10 9" stroke="#FFFFFF" '
             'stroke-width="2.4" stroke-linecap="round" opacity=".7"/>')
    return scene(i, p, back, torso(i, x=196, top=130) + arms + camera, flash)
