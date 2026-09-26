# -*- coding: utf-8 -*-
import subjects as S

def P(sky0, sky1, sky2, glow, beam, floor0, floor1, fig0, fig1, rim, vig):
    return dict(sky0=sky0, sky1=sky1, sky2=sky2, glow=glow, beam=beam,
                floor0=floor0, floor1=floor1, fig0=fig0, fig1=fig1, rim=rim, vig=vig)

PAL = {
 1:  P("#061334","#123A72","#3E7FB8","#BFE4FF","#DCF0FF","#1B4B84","#0A2447","#E8F4FF","#9EC7EA","#FFFFFF","#03102B"),
 2:  P("#140A33","#2E1263","#5B2296","#FFD98A","#FFE8B8","#3A1A72","#190A40","#1B0F3D","#0B0620","#FFE9A8","#0A0522"),
 3:  P("#180733","#3A1060","#7A1E7A","#FFB35C","#FFD9A0","#43135F","#1C0733","#2A1147","#120726","#FFD166","#0E0424"),
 4:  P("#07153A","#14306B","#2C5591","#CFE4FF","#E4F1FF","#1D3F72","#0A1B3E","#C62828","#7E1515","#FFD9D0","#04102E"),
 5:  P("#070E33","#141F5E","#2B3D8F","#9FD2FF","#CDE6FF","#1A2A66","#080F33","#151C3F","#070B22","#BBD8FF","#040820"),
 6:  P("#20062C","#540F4B","#96206E","#FFB3DC","#FFD6EC","#5E1250","#26082C","#3B0B33","#1B0418","#FFD9EE","#150320"),
 7:  P("#03231F","#07473C","#0D7A63","#9BF5DC","#CFFBEE","#0B5546","#03251F","#124F42","#07281F","#C8FBEA","#021A16"),
 8:  P("#1E1103","#472806","#8A5210","#FFD98A","#FFE9BE","#573310","#1F1004","#3A2007","#1A0C02","#FFE9B8","#150B02"),
 9:  P("#050E2E","#0F2A63","#1E4FA0","#9FC6FF","#CFE2FF","#132F63","#060F30","#16306B","#081634","#BBD8FF","#030A24"),
 10: P("#20062F","#4C0C57","#8A1782","#FFB0E4","#FFD6F2","#520F55","#210630","#3E0B3F","#1C0420","#FFD9F2","#150322"),
 11: P("#0B0A33","#221565","#4426A0","#C4B0FF","#E0D6FF","#281A6E","#0C0A33","#1E1355","#0B0726","#DCD0FF","#070522"),
 20: P("#140A2E","#2F1560","#5C2A92","#FFD1A8","#FFE6CE","#38196C","#150A30","#2A1550","#100722","#FFDCC0","#0A0520"),
 21: P("#2A0C12","#66200F","#B34A16","#FFCF96","#FFE5C2","#6E2611","#2B0C12","#3E1608","#1C0904","#FFE0B8","#1A0709"),
 22: P("#16072F","#3B0F6B","#78209E","#EFC0FF","#FBDFFF","#42126F","#170731","#241047","#0F0524","#F0D4FF","#0D0424"),
 # --- neue Profile ---
 12: P("#140A2E","#2F1560","#5C2A92","#FFD1A8","#FFE6CE","#38196C","#150A30","#2A1550","#100722","#FFDCC0","#0A0520"),
 14: P("#2A0C12","#66200F","#B34A16","#FFCF96","#FFE5C2","#6E2611","#2B0C12","#3E1608","#1C0904","#FFE0B8","#1A0709"),
 18: P("#16072F","#3B0F6B","#78209E","#EFC0FF","#FBDFFF","#42126F","#170731","#241047","#0F0524","#F0D4FF","#0D0424"),
 13: P("#1C0A06","#3E1A0C","#6E3216","#FFCF96","#FFE3BE","#43200F","#1B0A05","#2A1308","#120603","#FFDFB2","#120604"),
 15: P("#070B1E","#161F42","#2E3C70","#C9D6F2","#E4EDFB","#1C2750","#080C22","#20294C","#0C1026","#DCE7F8","#05081A"),
 16: P("#220A06","#5A1C0A","#A83E12","#FFC28A","#FFDCB4","#5E220C","#230A06","#3A1A0E","#170805","#FFD4A6","#150605"),
 17: P("#1E1204","#4A2B07","#8F5711","#FFDC96","#FFECC4","#5A3611","#1F1105","#3C2208","#1B0D03","#FFEBBC","#160C02"),
 23: P("#12082E","#2E1160","#5B2CA8","#FFD1A8","#FFE6CE","#341668","#130830","#251152","#0E0624","#FFDCC0","#0A0520"),
 24: P("#1E1204","#452705","#8A5210","#FFDC96","#FFECC4","#553212","#1E1005","#3A2008","#1A0C02","#FFEBBC","#150B02"),
 25: P("#07182E","#123A5E","#2A6E96","#BFE4FF","#DCF0FF","#16406A","#08182F","#123152","#061020","#E8F4FF","#040F20"),
 20: P("#16072F","#3B0F6B","#78209E","#EFC0FF","#FBDFFF","#42126F","#170731","#241047","#0F0524","#F0D4FF","#0D0424"),
 21: P("#2A0A22","#5E1244","#9A2468","#FFC6E2","#FFE2F0","#651546","#2B0A22","#43102F","#1E0616","#FFDCEE","#1A0514"),
 22: P("#1C1030","#3E1C55","#6E3A80","#FFD6EC","#FFE9F4","#4A2260","#1D1032","#33163F","#150A1C","#FFE0F0","#120818"),
 19: P("#2A0A22","#5E1244","#9A2468","#FFC6E2","#FFE2F0","#651546","#2B0A22","#43102F","#1E0616","#FFDCEE","#1A0514"),
 # --- Hypnose, Moderation, Fotografie ---
 26: P("#0C0628","#241056","#4A1E94","#D8C4FF","#ECE2FF","#2A1462","#0D0629","#1C0E44","#0A0520","#E4D8FF","#060318"),
 27: P("#050C24","#0E2152","#1E4290","#A8CCFF","#D2E4FF","#132A60","#060D28","#15224D","#070C22","#C8DCFF","#040818"),
 28: P("#10131C","#232B3E","#46557A","#F4E6CC","#FFF3DE","#2A3350","#10131E","#262C40","#10131C","#F6EEDC","#0A0C14"),
 # --- Kinderschminken ---
 29: P("#1E0A2E","#46146A","#8A2A9E","#FFC6EC","#FFE3F5","#4E1A6E","#1F0A30","#3A1452","#180826","#FFD9F0","#12061E"),
}

ART = {
 1:  S.snowqueen, 2: S.magician, 3: S.dj, 4: S.santa, 5: S.mentalist,
 6:  S.dancer, 7: S.clown, 8: S.acrobat,
 9:  lambda i,p: S.hero(i,p,"#1E5BCF",True),
 10: S.comet,
 11: lambda i,p: S.hero(i,p,"#5B2FD6",False),
 12: S.musician, 13: S.comedy, 14: S.stiltwalker, 15: S.pantomime,
 16: S.firestreet, 17: S.cyrwheel, 18: S.eventstage, 19: S.weddingarch,
 20: S.eventstage, 21: S.weddingarch, 22: S.weddingarch,
 23: lambda i,p: S.bandstage(i,p,"rock"),
 24: lambda i,p: S.bandstage(i,p,"brass"),
 25: lambda i,p: S.bandstage(i,p,"rock"),
 26: S.hypnotist, 27: S.host, 28: S.photographer,
 29: S.facepaint,
}

def build():
    return {i: ART[i](i, PAL[i]) for i in ART}

if __name__ == "__main__":
    import os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "..", "public", "acts")
    imgs = build()
    for i, svg in imgs.items():
        with open(os.path.join(out, f"{i}.svg"), "w") as f:
            f.write(svg)
    print("Bilder:", len(imgs), "| groesste:", max(len(v) for v in imgs.values()), "Zeichen")
