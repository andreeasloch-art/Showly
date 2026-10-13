/* Story-Leiste auf der Startseite: eine Reihe runder Bilder, die langsam
 * und ohne Ende durchläuft. Bunter Ring = noch nicht gesehen, grauer Ring =
 * schon gesehen. Tippen öffnet die Story (StoryViewer).
 *
 * Wer anbietet, sieht vorne "Deine Story" mit Plus und kommt damit ins
 * Konto zum Posten. Beim Wischen oder Berühren hält die Leiste kurz an;
 * wer weniger Bewegung eingestellt hat, bekommt sie ohne Durchlauf. */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  demoGroups,
  groupSeen,
  loadCloudStories,
  localStories,
  subscribeStories,
  type StoryGroup,
} from "@/showly/stories";
import { StoryViewer } from "./StoryViewer";
import { useMediaUrl } from "./MediaView";
import { useHydrated } from "@/showly/useHydrated";

const COPY = {
  de: { mine: "Deine Story", label: "Stories" },
  en: { mine: "Your story", label: "Stories" },
  es: { mine: "Tu historia", label: "Historias" },
} as const;

/** Pixel pro Sekunde */
const SPEED = 26;

let tick = 0;
const bump = () => tick++;

export function StoryBar({ mode }: { mode: "acts" | "locations" }) {
  const { lang, session, myProviders } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const version = useSyncExternalStore(
    (fn) =>
      subscribeStories(() => {
        bump();
        fn();
      }),
    () => tick,
    () => 0,
  );
  const [cloud, setCloud] = useState<StoryGroup[] | null>(null);
  /* Gesehen und eigene Stories liegen im Browser; erst nach dem ersten
     Zeichnen berücksichtigen, damit Server und Browser gleich beginnen */
  const hydrated = useHydrated();
  /* Beim Öffnen festgehaltene Liste, damit sich die Reihenfolge beim
     Ansehen (gesehen = nach hinten) nicht unter dem Betrachter verschiebt */
  const [open, setOpen] = useState<{ list: StoryGroup[]; i: number } | null>(
    null,
  );
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCloudStories().then((g) => alive && setCloud(g));
    return () => {
      alive = false;
    };
  }, [version]);

  const isProvider =
    !!session &&
    (session.role !== "customer" ||
      !!myProviders.baker ||
      !!myProviders.deco ||
      !!myProviders.location);

  const groups = useMemo(() => {
    const own: StoryGroup[] = [];
    const local = hydrated ? localStories() : [];
    if (local.length && session)
      own.push({
        key: "local",
        kind: local[0]!.providerKind,
        providerId: session.providerId || 0,
        name: { de: session.name || C.mine },
        city: "",
        local: true,
        stories: local
          .slice()
          .reverse()
          .map((s) => ({
            id: s.id,
            url: "",
            ref: s.ref,
            kind: s.kind,
            caption: s.caption,
            at: s.at,
          })),
      });
    const real = cloud || [];
    let list = [...own, ...(real.length ? real : demoGroups())];
    /* Bei "Locations" kommen Locations nach vorne */
    if (mode === "locations")
      list = [
        ...list.filter((g) => g.kind === "location"),
        ...list.filter((g) => g.kind !== "location"),
      ];
    if (!hydrated) return list;
    /* Ungesehene zuerst, Reihenfolge sonst beibehalten */
    return [
      ...list.filter((g) => !groupSeen(g)),
      ...list.filter((g) => groupSeen(g)),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, mode, session, version, lang, hydrated]);

  /* Endlos-Durchlauf: Liste steht zweimal hintereinander; nach der ersten
     Hälfte springt die Position unmerklich zurück. Berühren oder Wischen
     hält 2,5 Sekunden an, danach läuft es von der neuen Stelle weiter. */
  useEffect(() => {
    const el = scroller.current;
    if (!el || open !== null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    let pos = el.scrollLeft;
    let holdUntil = 0;
    let visible = true;
    const hold = () => {
      holdUntil = performance.now() + 2500;
    };
    const onScroll = () => {
      /* Vom Wischen: Position übernehmen */
      if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
    };
    const io = new IntersectionObserver(
      ([e]) => (visible = !!e?.isIntersecting),
    );
    io.observe(el);
    const step = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      if (visible && now > holdUntil) {
        const half = el.scrollWidth / 2;
        pos += (SPEED * dt) / 1000;
        if (half > 0 && pos >= half) pos -= half;
        el.scrollLeft = pos;
      } else if (now <= holdUntil) {
        pos = el.scrollLeft;
        const half = el.scrollWidth / 2;
        if (half > 0 && pos >= half) {
          pos -= half;
          el.scrollLeft = pos;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("wheel", hold, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("focusin", hold);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("focusin", hold);
    };
  }, [open, groups.length]);

  if (!groups.length && !isProvider) return null;

  const item = (g: StoryGroup, i: number, copy: boolean) => {
    const name = g.name[lang] || g.name["de"] || "";
    return (
      <li key={(copy ? "b" : "a") + g.key} aria-hidden={copy || undefined}>
        <button
          type="button"
          className={"sb-item" + (hydrated && groupSeen(g) ? " seen" : "")}
          onClick={() => setOpen({ list: groups, i })}
          tabIndex={copy ? -1 : 0}
        >
          <span className="sb-ring">
            <Avatar g={g} />
          </span>
          <span className="sb-name">{name}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="sb" aria-label={C.label}>
      {isProvider && (
        <button
          type="button"
          className="sb-item sb-mine"
          onClick={() =>
            navigate({ to: "/dashboard", search: { tab: "story" } as never })
          }
        >
          <span className="sb-ring">
            <span className="sb-ph">
              <Icon name="camera" />
            </span>
            <span className="sb-plus">
              <Icon name="plus" />
            </span>
          </span>
          <span className="sb-name">{C.mine}</span>
        </button>
      )}
      <div className="sb-scroll" ref={scroller}>
        <ul className="sb-track">
          {groups.map((g, i) => item(g, i, false))}
          {groups.length > 3 && groups.map((g, i) => item(g, i, true))}
        </ul>
      </div>
      {open && (
        <StoryViewer
          groups={open.list}
          start={open.i}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** Rundbild: festes Bild, sonst das erste Foto der Story (auch örtlich) */
function Avatar({ g }: { g: StoryGroup }) {
  const first = g.stories.find((s) => s.kind === "image");
  const local = useMediaUrl(!g.avatar && first?.ref ? first.ref : "");
  const img = g.avatar || first?.url || local || "";
  return img ? (
    <img src={img} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className="sb-ph">
      <Icon name="play" />
    </span>
  );
}
