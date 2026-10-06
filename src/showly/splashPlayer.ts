/* Eigener Abspieler für das Startvideo, wenn <video> nicht von selbst starten
 * darf (eingebettete Ansichten in Apps, iPhone im Stromsparmodus).
 *
 * Die Bilder kommen aus derselben /splash.mp4 wie beim <video>; die Datei wird
 * hier selbst zerlegt. WebCodecs entschlüsselt sie auf dem Grafikchip, gemalt wird
 * in ein <canvas>. Welches Bild gezeigt wird, richtet sich nach der echten
 * Uhrzeit: Kommt das Gerät einmal nicht hinterher, wird ein Bild übersprungen
 * statt langsamer zu werden. So gibt es keine Zeitlupe. Es werden nur wenige
 * Bilder im Voraus entschlüsselt, damit der Speicher klein bleibt. */

interface Packed {
  width: number;
  height: number;
  fps: number;
  codec: string;
  description: Uint8Array;
  frames: { key: boolean; data: Uint8Array }[];
}

/** Liest Bilder und Angaben aus einer MP4-Datei mit einer H.264-Spur ohne
 *  B-Frames (so kodiert scripts/splash/encode_video.py). Nur das, was der
 *  Vorspann braucht, kein allgemeiner MP4-Zerleger. */
export function parseMp4(buf: ArrayBuffer): Packed {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const type = (p: number) => String.fromCharCode(...u8.subarray(p + 4, p + 8));
  /* Kinder-Boxen in [start, end) */
  function boxes(start: number, end: number) {
    const out: { type: string; start: number; end: number }[] = [];
    let p = start;
    while (p + 8 <= end) {
      let size = v.getUint32(p);
      let head = 8;
      if (size === 1) {
        size = Number(v.getBigUint64(p + 8));
        head = 16;
      } else if (size === 0) size = end - p;
      if (size < head || p + size > end) break;
      out.push({ type: type(p), start: p + head, end: p + size });
      p += size;
    }
    return out;
  }
  const find = (start: number, end: number, path: string[]) => {
    let range = { start, end };
    for (const t of path) {
      const b = boxes(range.start, range.end).find((x) => x.type === t);
      if (!b) throw new Error(`MP4: ${t} fehlt`);
      range = b;
    }
    return range;
  };

  const moov = find(0, u8.length, ["moov"]);
  const trak = boxes(moov.start, moov.end).filter((b) => b.type === "trak").find((t) => {
    const hdlr = find(t.start, t.end, ["mdia", "hdlr"]);
    return String.fromCharCode(...u8.subarray(hdlr.start + 8, hdlr.start + 12)) === "vide";
  });
  if (!trak) throw new Error("MP4: keine Videospur");
  const mdhd = find(trak.start, trak.end, ["mdia", "mdhd"]);
  const timescale = v.getUint32(mdhd.start + (u8[mdhd.start] === 1 ? 20 : 12));
  const stbl = find(trak.start, trak.end, ["mdia", "minf", "stbl"]);
  const kids = boxes(stbl.start, stbl.end);
  const get = (t: string) => kids.find((k) => k.type === t);

  /* stsd → avc1 → avcC */
  const stsd = get("stsd");
  if (!stsd) throw new Error("MP4: stsd fehlt");
  const entry = boxes(stsd.start + 8, stsd.end)[0];
  if (!entry || entry.type !== "avc1") throw new Error("MP4: kein H.264");
  const width = v.getUint16(entry.start + 24);
  const height = v.getUint16(entry.start + 26);
  const avcC = boxes(entry.start + 78, entry.end).find((b) => b.type === "avcC");
  if (!avcC) throw new Error("MP4: avcC fehlt");
  const description = u8.subarray(avcC.start, avcC.end);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const codec = `avc1.${hex(description[1]!)}${hex(description[2]!)}${hex(description[3]!)}`;

  /* Bildrate aus der ersten Dauer */
  const stts = get("stts");
  const delta = stts ? v.getUint32(stts.start + 12) : 0;
  const fps = delta ? Math.round(timescale / delta) : 24;

  /* Größen, Lage und Schlüsselbilder */
  const stsz = get("stsz");
  if (!stsz) throw new Error("MP4: stsz fehlt");
  const fixed = v.getUint32(stsz.start + 4);
  const count = v.getUint32(stsz.start + 8);
  const sizes = Array.from({ length: count }, (_, i) => fixed || v.getUint32(stsz.start + 12 + i * 4));

  const co = get("stco") ?? get("co64");
  if (!co) throw new Error("MP4: stco fehlt");
  const big = co.type === "co64";
  const chunks = Array.from({ length: v.getUint32(co.start + 4) }, (_, i) =>
    big ? Number(v.getBigUint64(co.start + 8 + i * 8)) : v.getUint32(co.start + 8 + i * 4),
  );
  const stsc = get("stsc");
  if (!stsc) throw new Error("MP4: stsc fehlt");
  const runs = Array.from({ length: v.getUint32(stsc.start + 4) }, (_, i) => ({
    first: v.getUint32(stsc.start + 8 + i * 12),
    per: v.getUint32(stsc.start + 12 + i * 12),
  }));
  const stss = get("stss");
  const keys = stss
    ? new Set(Array.from({ length: v.getUint32(stss.start + 4) }, (_, i) => v.getUint32(stss.start + 8 + i * 4)))
    : null;

  const frames: Packed["frames"] = [];
  let n = 0;
  for (let c = 0; c < chunks.length && n < count; c++) {
    const run = runs.filter((r) => r.first <= c + 1).pop();
    let off = chunks[c]!;
    for (let k = 0; k < (run?.per ?? 1) && n < count; k++, n++) {
      const size = sizes[n]!;
      frames.push({ key: keys ? keys.has(n + 1) : true, data: u8.subarray(off, off + size) });
      off += size;
    }
  }
  return { width, height, fps, codec, description, frames };
}

export function canDecodeVideo(): boolean {
  return typeof window !== "undefined" && "VideoDecoder" in window && "EncodedVideoChunk" in window;
}

const AHEAD = 6;

/** Spielt das Video einmal ab. Erfüllt sich am Ende oder bei stop(), schlägt
 *  fehl, wenn das Gerät es nicht entschlüsseln kann. */
export async function playOnCanvas(
  canvas: HTMLCanvasElement,
  url: string,
  ctl: { stopped: boolean },
  onFirstFrame: () => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Startvideo: ${res.status}`);
  const vid = parseMp4(await res.arrayBuffer());
  const config: VideoDecoderConfig = {
    codec: vid.codec,
    codedWidth: vid.width,
    codedHeight: vid.height,
    ...(vid.description.length ? { description: vid.description } : {}),
    optimizeForLatency: true,
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) throw new Error("Startvideo: nicht unterstützt");
  if (ctl.stopped) return;

  canvas.width = vid.width;
  canvas.height = vid.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("kein canvas");

  const ready: VideoFrame[] = [];
  let failed: unknown = null;
  const decoder = new VideoDecoder({ output: (f) => ready.push(f), error: (e) => (failed = e) });
  decoder.configure(config);

  const frameUs = 1e6 / vid.fps;
  const lastUs = (vid.frames.length - 1) * frameUs;
  let next = 0;
  let flushed = false;
  let drained = false;

  function feed() {
    while (next < vid.frames.length && decoder.decodeQueueSize < 3 && ready.length < AHEAD) {
      const f = vid.frames[next]!;
      decoder.decode(
        new EncodedVideoChunk({
          type: f.key ? "key" : "delta",
          timestamp: Math.round(next * frameUs),
          duration: Math.round(frameUs),
          data: f.data,
        }),
      );
      next++;
    }
    if (next >= vid.frames.length && !flushed) {
      flushed = true;
      decoder.flush().then(
        () => (drained = true),
        () => (drained = true),
      );
    }
  }

  function cleanup() {
    ready.splice(0).forEach((f) => f.close());
    if (decoder.state !== "closed") decoder.close();
  }

  return new Promise<void>((resolve, reject) => {
    let start = 0;
    let shown = false;
    let shownUs = -1;
    const tick = (now: number) => {
      try {
        if (ctl.stopped) return (cleanup(), resolve());
        if (failed) return (cleanup(), reject(failed));
        feed();
        if (!start && ready.length) start = now;
        if (start) {
          const target = (now - start) * 1000;
          let draw: VideoFrame | null = null;
          while (ready.length && ready[0]!.timestamp <= target) {
            draw?.close();
            draw = ready.shift()!;
          }
          if (draw) {
            ctx.drawImage(draw, 0, 0, vid.width, vid.height);
            shownUs = draw.timestamp;
            draw.close();
            if (!shown) {
              shown = true;
              onFirstFrame();
            }
          }
          if (drained && !ready.length && (shownUs >= lastUs - 1 || target > lastUs + 500_000)) {
            return (cleanup(), resolve());
          }
        }
        requestAnimationFrame(tick);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    requestAnimationFrame(tick);
  });
}
