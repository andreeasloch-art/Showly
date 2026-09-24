/* Event-Blog als Feed, im Aufbau wie Instagram.
 *
 * Oben die runden Act-Kreise: ein Klick zeigt nur Beiträge mit diesem Act.
 * Darunter der Feed mit großen Bildern, Doppeltipp zum Liken, Kommentaren.
 * Geschrieben wird in einem eigenen Fenster statt in einem Formular über dem
 * Feed; das Formular nahm vorher den ganzen ersten Bildschirm ein, bevor man
 * überhaupt einen Beitrag sah.
 *
 * Es gibt keine erfundenen Beispielbeiträge. Solange niemand etwas geteilt
 * hat, lädt die Seite dazu ein, den ersten Beitrag zu schreiben. */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { seoHead } from "@/showly/seo";
import { useShowly } from "@/showly/store";
import { ARTISTS } from "@/showly/data";
import { Icon, bgOf } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { MediaPicker } from "@/components/showly/MediaPicker";
import { MediaCarousel } from "@/components/showly/MediaView";
import { CityAutocomplete } from "@/components/showly/CityAutocomplete";
import { ArtistTagPicker } from "@/components/showly/ArtistTagPicker";
import { ReportMenu, useModeration } from "@/components/showly/ReportMenu";
import { isHidden } from "@/showly/moderation";
import type { MediaRef } from "@/showly/media";
import {
  addComment,
  addPost,
  postsSnapshot,
  removePost,
  subscribe,
  toggleLike,
  type Post,
} from "@/showly/community";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";

export const Route = createFileRoute("/blog")({
  head: () => seoHead("/blog", "/blog"),
  component: BlogPage,
});

const EMPTY: Post[] = [];

const TEXT = {
  de: {
    eyebrow: "Aus der Community",
    h1: "Eure Events",
    sub: "Fotos, Videos und Geschichten von Feiern mit Showly-Acts. Teile deine eigene.",
    create: "Beitrag erstellen",
    composeH: "Neuer Beitrag",
    close: "Schließen",
    namePh: "Dein Name",
    textPh: "Erzähl kurz, was an eurem Event besonders war …",
    asArtist: "Du schreibst als Künstler",
    asArtistP: "Dein Profil steht am Beitrag und ist für alle anklickbar.",
    tagged: "Aufgetreten",
    badgeArtist: "Künstler",
    city: "Ort",
    cityPh: "z. B. München",
    post: "Teilen",
    needText: "Schreib ein paar Sätze zu deinem Event.",
    needName: "Bitte trag einen Namen ein.",
    posted: "Dein Beitrag ist online.",
    emptyH: "Noch keine Beiträge",
    emptyP: "Sei die erste Person, die ein Event zeigt. Fotos, Videos oder ein paar Sätze reichen.",
    emptyBtn: "Ersten Beitrag erstellen",
    emptyActH: (n: string) => `Noch keine Beiträge mit ${n}`,
    emptyActP: "Warst du bei einem Auftritt dabei? Zeig, wie es war.",
    like: "Gefällt mir",
    likes: (n: number) => (n === 1 ? "1 Gefällt-mir" : `${n} Gefällt-mir`),
    comment: "Kommentieren",
    commentPh: "Kommentieren …",
    send: "Senden",
    viewAll: (n: number) => `Alle ${n} Kommentare ansehen`,
    hide: "Kommentare ausblenden",
    del: "Beitrag löschen",
    profile: "Profil ansehen",
    filterAll: "Alle Beiträge",
    filterMine: "Meine Beiträge",
    all: "Alle",
    onlyWith: (n: string) => `Nur Beiträge mit ${n}`,
    shareH: "Zeig euer Event",
    shareP: "Ein Foto, ein Video, ein paar Zeilen. Markiere die Acts, die aufgetreten sind.",
    discover: "Acts entdecken",
    more: "mehr",
  },
  en: {
    eyebrow: "From the community",
    h1: "Your events",
    sub: "Photos, videos and stories from parties with Showly acts. Share your own.",
    create: "Create post",
    composeH: "New post",
    close: "Close",
    namePh: "Your name",
    textPh: "Tell us briefly what made your event special …",
    asArtist: "You are posting as an artist",
    asArtistP: "Your profile is shown with the post and everyone can open it.",
    tagged: "Performed",
    badgeArtist: "Artist",
    city: "Place",
    cityPh: "e.g. Munich",
    post: "Share",
    needText: "Write a few sentences about your event.",
    needName: "Please enter a name.",
    posted: "Your post is live.",
    emptyH: "No posts yet",
    emptyP: "Be the first to show an event. Photos, videos or a few lines are enough.",
    emptyBtn: "Create the first post",
    emptyActH: (n: string) => `No posts with ${n} yet`,
    emptyActP: "Were you at one of their shows? Show how it was.",
    like: "Like",
    likes: (n: number) => (n === 1 ? "1 like" : `${n} likes`),
    comment: "Comment",
    commentPh: "Add a comment …",
    send: "Send",
    viewAll: (n: number) => `View all ${n} comments`,
    hide: "Hide comments",
    del: "Delete post",
    profile: "View profile",
    filterAll: "All posts",
    filterMine: "My posts",
    all: "All",
    onlyWith: (n: string) => `Only posts with ${n}`,
    shareH: "Show your event",
    shareP: "A photo, a video, a few lines. Tag the acts that performed.",
    discover: "Discover acts",
    more: "more",
  },
  es: {
    eyebrow: "De la comunidad",
    h1: "Vuestros eventos",
    sub: "Fotos, vídeos e historias de fiestas con artistas de Showly. Comparte la tuya.",
    create: "Crear publicación",
    composeH: "Nueva publicación",
    close: "Cerrar",
    namePh: "Tu nombre",
    textPh: "Cuenta brevemente qué hizo especial vuestro evento …",
    asArtist: "Publicas como artista",
    asArtistP: "Tu perfil aparece en la publicación y cualquiera puede abrirlo.",
    tagged: "Actuaron",
    badgeArtist: "Artista",
    city: "Lugar",
    cityPh: "p. ej. Múnich",
    post: "Compartir",
    needText: "Escribe unas frases sobre vuestro evento.",
    needName: "Introduce un nombre.",
    posted: "Tu publicación está en línea.",
    emptyH: "Todavía no hay publicaciones",
    emptyP: "Sé la primera persona en mostrar un evento. Bastan fotos, vídeos o unas frases.",
    emptyBtn: "Crear la primera publicación",
    emptyActH: (n: string) => `Aún no hay publicaciones con ${n}`,
    emptyActP: "¿Estuviste en una de sus actuaciones? Muestra cómo fue.",
    like: "Me gusta",
    likes: (n: number) => (n === 1 ? "1 me gusta" : `${n} me gusta`),
    comment: "Comentar",
    commentPh: "Escribe un comentario …",
    send: "Enviar",
    viewAll: (n: number) => `Ver los ${n} comentarios`,
    hide: "Ocultar comentarios",
    del: "Borrar publicación",
    profile: "Ver perfil",
    filterAll: "Todas",
    filterMine: "Mías",
    all: "Todos",
    onlyWith: (n: string) => `Solo publicaciones con ${n}`,
    shareH: "Muestra tu evento",
    shareP: "Una foto, un vídeo, unas líneas. Etiqueta a los artistas que actuaron.",
    discover: "Descubrir artistas",
    more: "más",
  },
} as const;

/* Alle drei Sprachblöcke haben dieselben Schlüssel. Ohne diesen gemeinsamen
   Typ hielte TypeScript die deutschen Texte für die einzig erlaubten Werte. */
type Copy = (typeof TEXT)[keyof typeof TEXT];

function useLocale() {
  const { lang } = useShowly();
  const key = (lang as "de" | "en" | "es") ?? "de";
  return { key, T: (TEXT[key] ?? TEXT.de) as Copy };
}

function when(iso: string, key: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return key === "en" ? "just now" : key === "es" ? "ahora mismo" : "gerade eben";
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h`;
  try {
    return d.toLocaleDateString(key === "en" ? "en-GB" : key === "es" ? "es-ES" : "de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase();
}

/* Name, unter dem zuletzt in diesem Browser geschrieben wurde. Ohne Konto
   ist das die einzige Möglichkeit, eigene Beiträge wiederzuerkennen, etwa
   für "Meine Beiträge" und zum Löschen. */
const NAME_KEY = "showly.blogName";
function savedName() {
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}
function rememberName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* privates Fenster oder gesperrter Speicher: dann eben nicht */
  }
}

function BlogPage() {
  const { session, L, catLabel } = useShowly();
  const { key, T } = useLocale();
  const posts = useSyncExternalStore(subscribe, postsSnapshot, () => EMPTY);
  const [mine, setMine] = useState(false);
  const [actFilter, setActFilter] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [guestName, setGuestName] = useState("");
  useEffect(() => setGuestName(savedName()), [composing]);
  const me = session?.name || guestName;

  /* Act-Kreise: zuerst die Acts, zu denen es Beiträge gibt, nach Anzahl;
     danach die übrigen, damit die Reihe auch ohne Beiträge etwas zeigt. */
  const stories = useMemo(() => {
    const count = new Map<number, number>();
    posts.forEach((p) =>
      (p.artistIds || []).forEach((id) => count.set(id, (count.get(id) || 0) + 1)),
    );
    return [...ARTISTS].map((a) => ({ a, n: count.get(a.id) || 0 })).sort((x, y) => y.n - x.n);
  }, [posts]);

  const mod = useModeration();
  const shown = useMemo(() => {
    /* Gemeldete Beiträge und Beiträge blockierter Personen ausblenden */
    let list = posts.filter((p) => !isHidden(mod, "post", p.id, p.author));
    if (mine && me) list = list.filter((p) => p.author === me);
    if (actFilter !== null) list = list.filter((p) => (p.artistIds || []).includes(actFilter));
    return list;
  }, [posts, mine, me, actFilter, mod]);

  const filterAct = actFilter !== null ? ARTISTS.find((a) => a.id === actFilter) : undefined;

  return (
    <div className="page active ui26 feed26">
      <section className="feed26-top">
        <div className="feed26-head">
          <div>
            <div className="home-pill rise" style={{ ["--d" as string]: "0ms" }}>
              <Icon name="party" /> {T.eyebrow}
            </div>
            <h1 className="rise" style={{ ["--d" as string]: "60ms" }}>
              {T.h1}
            </h1>
            <p className="rise" style={{ ["--d" as string]: "120ms" }}>
              {T.sub}
            </p>
          </div>
          <button
            className="home-btn primary rise"
            style={{ ["--d" as string]: "180ms" }}
            onClick={() => setComposing(true)}
          >
            <Icon name="plus" /> {T.create}
          </button>
        </div>

        <div className="feed26-stories rise" style={{ ["--d" as string]: "240ms" }} role="group">
          <button
            className={"story" + (actFilter === null ? " on" : "")}
            onClick={() => setActFilter(null)}
            aria-pressed={actFilter === null}
          >
            <span className="story-ring all">
              <span className="story-img">
                <Icon name="all" />
              </span>
            </span>
            <span className="story-name">{T.all}</span>
          </button>
          {stories.map(({ a, n }) => (
            <button
              key={a.id}
              className={"story" + (actFilter === a.id ? " on" : "")}
              onClick={() => setActFilter((f) => (f === a.id ? null : a.id))}
              aria-pressed={actFilter === a.id}
              aria-label={T.onlyWith(String(L(a.name)))}
            >
              <span className={"story-ring" + (n > 0 ? " has" : "")}>
                <span className="story-img" style={bgOf(a, "center 28%")} />
              </span>
              <span className="story-name">{String(L(a.name))}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="feed26-layout">
        <main className="feed26-feed">
          {posts.length > 0 && (
            <div className="feed26-bar">
              <div className="join26-seg feed26-seg" role="group">
                <button
                  className={"join26-seg-btn" + (mine ? "" : " on")}
                  aria-pressed={!mine}
                  onClick={() => setMine(false)}
                >
                  {T.filterAll}
                </button>
                <button
                  className={"join26-seg-btn" + (mine ? " on" : "")}
                  aria-pressed={mine}
                  onClick={() => setMine(true)}
                >
                  {T.filterMine}
                </button>
              </div>
              {filterAct && (
                <button className="feed26-actchip" onClick={() => setActFilter(null)}>
                  <span className="feed26-actchip-img" style={bgOf(filterAct, "center 28%")} />
                  {String(L(filterAct.name))}
                  <Icon name="close" />
                </button>
              )}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="feed26-empty" data-reveal>
              {filterAct ? (
                <>
                  <span className="feed26-empty-img" style={bgOf(filterAct, "center 28%")} />
                  <h3>{T.emptyActH(String(L(filterAct.name)))}</h3>
                  <p>{T.emptyActP}</p>
                  <div className="feed26-empty-btns">
                    <button className="home-btn primary" onClick={() => setComposing(true)}>
                      <Icon name="plus" /> {T.create}
                    </button>
                    <Link
                      className="home-btn soft"
                      to="/kuenstler/$id"
                      params={{ id: String(filterAct.id) }}
                    >
                      {T.profile}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <span className="feed26-empty-ic">
                    <Icon name="camera" />
                  </span>
                  <h3>{T.emptyH}</h3>
                  <p>{T.emptyP}</p>
                  <button className="home-btn primary" onClick={() => setComposing(true)}>
                    <Icon name="plus" /> {T.emptyBtn}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="feed26-list">
              {shown.map((p) => (
                <PostCard key={p.id} post={p} me={me} T={T} localeKey={key} />
              ))}
            </div>
          )}
        </main>

        <aside className="feed26-side">
          <div className="feed26-share">
            <span className="feed26-share-ic">
              <Icon name="camera" />
            </span>
            <h3>{T.shareH}</h3>
            <p>{T.shareP}</p>
            <button className="home-btn primary wide" onClick={() => setComposing(true)}>
              <Icon name="plus" /> {T.create}
            </button>
          </div>
          <div className="feed26-suggest">
            <h3>{T.discover}</h3>
            {ARTISTS.filter((a) => a.superhost)
              .slice(0, 5)
              .map((a) => (
                <Link
                  key={a.id}
                  className="feed26-suggest-row"
                  to="/kuenstler/$id"
                  params={{ id: String(a.id) }}
                >
                  <span className="feed26-suggest-img" style={bgOf(a, "center 28%")} />
                  <span className="feed26-suggest-text">
                    <b>{String(L(a.name))}</b>
                    <small>
                      {catLabel(a.cat)} · {String(L(a.loc))}
                    </small>
                  </span>
                  <span className="feed26-suggest-go">{T.profile}</span>
                </Link>
              ))}
          </div>
        </aside>
      </div>

      {composing && <Composer T={T} localeKey={key} onClose={() => setComposing(false)} />}
      <Footer />
    </div>
  );
}

/* Fenster zum Schreiben eines Beitrags. Schließt mit Esc, mit Klick neben
   das Fenster und nach dem Teilen. Der Fokus springt beim Öffnen ins
   Textfeld. */
function Composer({
  T,
  localeKey,
  onClose,
}: {
  T: Copy;
  localeKey: "de" | "en" | "es";
  onClose: () => void;
}) {
  const okText = useContactCheck();
  const { session, toast } = useShowly();
  const [name, setName] = useState(() => session?.name || savedName());
  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [tagged, setTagged] = useState<number[]>(() =>
    session?.providerId ? [session.providerId] : [],
  );
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [err, setErr] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function publish() {
    if (!name.trim()) return setErr(T.needName);
    if (text.trim().length < 10) return setErr(T.needText);
    if (!okText(name, text)) return;
    addPost({
      author: name.trim(),
      text: text.trim(),
      media,
      artistIds: tagged,
      ...(session?.providerId ? { authorProviderId: session.providerId } : {}),
      ...(session?.role ? { authorRole: session.role } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
    });
    rememberName(name.trim());
    toast(T.posted);
    onClose();
  }

  return (
    <div className="feed26-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="feed26-sheet" role="dialog" aria-modal="true" aria-labelledby="compose-h">
        <header className="feed26-sheet-head">
          <button className="feed26-x" onClick={onClose} aria-label={T.close}>
            <Icon name="close" />
          </button>
          <h2 id="compose-h">{T.composeH}</h2>
          <button className="feed26-share-btn" onClick={publish}>
            {T.post}
          </button>
        </header>

        <div className="feed26-sheet-body">
          {session?.providerId !== undefined && (
            <div className="compose-asartist">
              <Icon name="sparkle" />
              <span>
                <strong>{T.asArtist}</strong>
                <em>{T.asArtistP}</em>
              </span>
            </div>
          )}
          <div className="feed26-who">
            <span className="ig-avatar">{initials(name || "Showly")}</span>
            <input value={name} placeholder={T.namePh} onChange={(e) => setName(e.target.value)} />
          </div>
          <textarea
            ref={textRef}
            className="feed26-text"
            rows={4}
            value={text}
            placeholder={T.textPh}
            onChange={(e) => setText(e.target.value)}
          />
          <ContactHint text={text} />
          <MediaPicker value={media} onChange={setMedia} lang={localeKey} />
          <ArtistTagPicker
            value={tagged}
            onChange={setTagged}
            {...(session?.providerId !== undefined ? { ownId: session.providerId } : {})}
          />
          <div className="feed26-field">
            <span>{T.city}</span>
            <CityAutocomplete
              value={city}
              onChange={setCity}
              placeholder={T.cityPh}
              showScopeToggle={false}
            />
          </div>
          {err && <p className="picker-err">{err}</p>}
          <button className="home-btn primary wide" onClick={publish}>
            <Icon name="send" /> {T.post}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Ein Beitrag im Feed.
 *
 * Mit Bildern: Bilderstrecke, darunter die Zeile mit Herz und Sprechblase,
 * die Zahl der Gefällt-mir und der Text wie eine Bildunterschrift.
 * Ohne Bilder: der Text selbst steht groß auf einer Farbfläche in den
 * Logofarben, wie ein Textbeitrag bei Instagram.
 *
 * Doppeltipp aufs Bild liked den Beitrag, wie gewohnt. Ein zweiter
 * Doppeltipp nimmt das Gefällt-mir nicht zurück; das geht nur übers Herz. */
function PostCard({
  post,
  me,
  T,
  localeKey,
}: {
  post: Post;
  me: string;
  T: Copy;
  localeKey: string;
}) {
  const okText = useContactCheck();
  const { L, catLabel } = useShowly();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acts = (post.artistIds || [])
    .map((id) => ARTISTS.find((a) => a.id === id))
    .filter((a): a is (typeof ARTISTS)[number] => !!a);
  const authorProfile = post.authorProviderId
    ? ARTISTS.find((a) => a.id === post.authorProviderId)
    : undefined;
  const hasMedia = post.media.length > 0;

  const openProfile = (id: number) =>
    navigate({ to: "/kuenstler/$id", params: { id: String(id) } });

  function likeByTap() {
    if (!post.liked) toggleLike(post.id);
    setBurst((b) => b + 1);
  }

  function comment() {
    const author = me.trim() || "Gast";
    if (draft.trim().length < 2) return;
    if (!okText(draft)) return;
    addComment(post.id, author, draft.trim());
    setDraft("");
    setShowAll(true);
  }

  const mod = useModeration();
  const long = post.text.length > 140;
  const visibleComments = post.comments.filter((c) => !isHidden(mod, "comment", c.id, c.author));
  const comments = showAll ? visibleComments : visibleComments.slice(-2);

  return (
    <article className="ig-post" data-reveal>
      <header className="ig-head">
        {authorProfile ? (
          <button
            className="ig-avatar ring"
            onClick={() => openProfile(authorProfile.id)}
            aria-label={String(L(authorProfile.name))}
          >
            <span style={bgOf(authorProfile, "center 26%")} />
          </button>
        ) : (
          <span className="ig-avatar">{initials(post.author)}</span>
        )}
        <div className="ig-who">
          <div className="ig-author">
            {authorProfile ? (
              <button onClick={() => openProfile(authorProfile.id)}>{post.author}</button>
            ) : (
              <span>{post.author}</span>
            )}
            {authorProfile && (
              <span className="ig-badge">
                <Icon name="check" /> {T.badgeArtist}
              </span>
            )}
          </div>
          <div className="ig-meta">
            {post.city ? `${post.city} · ` : ""}
            {when(post.dateISO, localeKey)}
          </div>
        </div>
        {post.author === me && me ? (
          <button className="ig-icon-btn" onClick={() => removePost(post.id)} aria-label={T.del}>
            <Icon name="trash" />
          </button>
        ) : (
          <ReportMenu target="post" id={post.id} author={post.author} className="ig-icon-btn" />
        )}
      </header>

      <div className="ig-media" onDoubleClick={likeByTap}>
        {hasMedia ? (
          <MediaCarousel items={post.media} />
        ) : (
          <div className={"ig-textcard" + (post.text.length > 180 ? " small" : "")}>
            <p>{post.text}</p>
            <span>— {post.author}</span>
          </div>
        )}
        {burst > 0 && (
          <span className="ig-burst" key={burst} aria-hidden="true">
            <Icon name="heartOn" />
          </span>
        )}
      </div>

      <div className="ig-actions">
        <button
          className={"ig-icon-btn heart" + (post.liked ? " on" : "")}
          onClick={() => toggleLike(post.id)}
          aria-label={T.like}
          aria-pressed={post.liked}
        >
          <Icon name={post.liked ? "heartOn" : "heart"} />
        </button>
        <button
          className="ig-icon-btn"
          onClick={() => inputRef.current?.focus()}
          aria-label={T.comment}
        >
          <Icon name="comment" />
        </button>
      </div>

      <div className="ig-body">
        {post.likes > 0 && <div className="ig-likes">{T.likes(post.likes)}</div>}

        {hasMedia && (
          <p className={"ig-caption" + (long && !expanded ? " clamp" : "")}>
            <b>{post.author}</b> {post.text}
          </p>
        )}
        {hasMedia && long && !expanded && (
          <button className="ig-more" onClick={() => setExpanded(true)}>
            {T.more}
          </button>
        )}

        {acts.length > 0 && (
          <div className="ig-tags">
            <span className="ig-tags-h">{T.tagged}</span>
            {acts.map((a) => (
              <button className="ig-tag" key={a.id} onClick={() => openProfile(a.id)}>
                <span className="ig-tag-img" style={bgOf(a, "center 26%")} />
                <span>
                  <b>{String(L(a.name))}</b>
                  <small>{catLabel(a.cat)}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {visibleComments.length > 2 && (
          <button className="ig-more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? T.hide : T.viewAll(visibleComments.length)}
          </button>
        )}
        {comments.length > 0 && (
          <ul className="ig-comments">
            {comments.map((c) => (
              <li key={c.id}>
                <span>
                  <b>{c.author}</b> {c.text}
                </span>
                {c.author !== me && <ReportMenu target="comment" id={c.id} author={c.author} className="small" />}
              </li>
            ))}
          </ul>
        )}

        <div className="ig-reply">
          <input
            ref={inputRef}
            value={draft}
            placeholder={T.commentPh}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && comment()}
            aria-label={T.comment}
          />
          {draft.trim().length >= 2 && (
            <button className="ig-send" onClick={comment}>
              {T.send}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
