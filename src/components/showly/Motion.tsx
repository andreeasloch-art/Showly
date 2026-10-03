/* Bewegung, die Showly als Bühne erzählt.
 *
 * StageLight  Zwei Scheinwerfer im Kopfbereich der Startseite. Am Computer
 *             folgen sie der Maus, am Handy dem Finger; ohne Berührung
 *             wandern sie langsam von selbst über die Bühne.
 * CardLights  Jede Künstlerkarte wird einmal "angestrahlt", wenn sie ins
 *             Bild scrollt. Die Karte ist vorher schon sichtbar, das Licht
 *             kommt nur dazu.
 * Celebrate   Kurzer Konfetti-Moment in den Logofarben, wenn eine Buchung
 *             oder Bestellung abgeschlossen ist.
 *
 * Wer in den Systemeinstellungen weniger Bewegung gewählt hat, bekommt ruhige
 * Scheinwerfer, kein Wandern und kein Konfetti. */
import { useEffect, useRef } from "react";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Die Farben aus der Wortmarke */
const LOGO = ["#4832FD", "#6D3EEA", "#8530D0", "#B8AEFC", "#ED31C5", "#FC5691", "#FF976A", "#4AECB5"];

export function StageLight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const stage = el?.parentElement;
    if (!el || !stage) return;
    if (reduced()) {
      el.classList.add("still");
      return;
    }
    let raf = 0;
    let tx = 0.62;
    let ty = 0.42;
    let x = tx;
    let y = ty;
    let lastInput = 0;
    let visible = true;

    const apply = () => {
      /* Weich nachziehen statt springen */
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty("--lx", (x * 100).toFixed(2) + "%");
      el.style.setProperty("--ly", (y * 100).toFixed(2) + "%");
      /* Winkel der beiden Kegel von den oberen Ecken zum Lichtpunkt */
      const r = stage.getBoundingClientRect();
      const px = x * r.width;
      const py = y * r.height;
      const aL = Math.atan2(px - r.width * 0.12, py) * (180 / Math.PI);
      const aR = Math.atan2(px - r.width * 0.88, py) * (180 / Math.PI);
      el.style.setProperty("--al", (-aL).toFixed(2) + "deg");
      el.style.setProperty("--ar", (-aR).toFixed(2) + "deg");
    };

    const tick = (now: number) => {
      /* Ohne Eingabe wandert das Licht langsam über die Bühne */
      if (now - lastInput > 2600) {
        const t = now / 1000;
        tx = 0.5 + Math.sin(t * 0.45) * 0.3;
        ty = 0.45 + Math.sin(t * 0.31 + 1) * 0.15;
      }
      apply();
      if (visible) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      lastInput = performance.now();
    };

    /* Nur rechnen, solange der Kopfbereich zu sehen ist */
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = !!entry?.isIntersecting;
      if (visible && !was) raf = requestAnimationFrame(tick);
    });
    io.observe(stage);
    const onVis = () => {
      if (document.hidden) {
        visible = false;
      } else if (!visible) {
        visible = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerdown", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onMove);
    };
  }, []);

  return (
    <div className="stage-light" ref={ref} aria-hidden="true">
      <span className="beam l" />
      <span className="beam r" />
      <span className="spot" />
    </div>
  );
}

/* Karten einmal anstrahlen, wenn sie ins Bild kommen */
export function CardLights() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("lit");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.35 },
    );
    const scan = () => {
      document.querySelectorAll(".act-card").forEach((c) => {
        if (seen.has(c)) return;
        seen.add(c);
        io.observe(c);
      });
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}

/* Konfetti in den Logofarben, einmal beim Erscheinen */
export function Celebrate() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduced()) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.scale(dpr, dpr);

    type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; round: boolean };
    const parts: P[] = [];
    const burst = (ox: number, dir: number) => {
      for (let i = 0; i < 70; i++) {
        const a = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.55);
        const sp = 9 + Math.random() * 9;
        parts.push({
          x: ox,
          y: H * 0.98,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 8,
          c: LOGO[Math.floor(Math.random() * LOGO.length)]!,
          round: Math.random() < 0.3,
        });
      }
    };
    burst(W * 0.08, 1);
    burst(W * 0.92, -1);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1800) / 700);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
        }
        ctx.restore();
      }
      if (t < 2500) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas className="celebrate" ref={ref} aria-hidden="true" />;
}
