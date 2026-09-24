/* Melden und Blockieren.
 *
 * Apps mit Inhalten von Nutzern müssen im App Store eine Möglichkeit zum
 * Melden und zum Blockieren anbieten (Richtlinie 1.2), und der Digital
 * Services Act verlangt ein Meldeverfahren (Art. 16).
 *
 * Wer etwas meldet, sieht den Inhalt ab sofort nicht mehr. Wer eine Person
 * blockiert, sieht keine Beiträge, Kommentare und Bewertungen mehr von ihr.
 * Beides gilt zunächst in diesem Browser. Ist die Datenbank angebunden,
 * geht die Meldung zusätzlich an den Server (reportContent), wo sie in der
 * Tabelle reports zur Prüfung landet. */
import { loadJSON, saveJSON } from "./persist";

export type ReportTarget = "post" | "comment" | "review" | "profile";

export const REPORT_REASONS = ["abuse", "spam", "false", "explicit", "rights", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface LocalReport {
  target: ReportTarget;
  id: string;
  reason: ReportReason;
  details?: string;
  author?: string;
  dateISO: string;
}

interface State {
  reports: LocalReport[];
  hidden: string[];
  blocked: string[];
}

const KEY = "moderation";
const EMPTY: State = { reports: [], hidden: [], blocked: [] };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function ensure() {
  if (loaded || typeof window === "undefined") return;
  const s = loadJSON<Partial<State>>(KEY, {});
  state = { reports: s.reports || [], hidden: s.hidden || [], blocked: s.blocked || [] };
  loaded = true;
}

function commit(next: State) {
  state = next;
  saveJSON(KEY, state);
  listeners.forEach((fn) => fn());
}

const norm = (name: string) => name.trim().toLowerCase();

export function subscribeModeration(fn: () => void) {
  ensure();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function moderationSnapshot(): State {
  ensure();
  return state;
}

export const moderationServerSnapshot = (): State => EMPTY;

export function addReport(r: Omit<LocalReport, "dateISO">) {
  ensure();
  const key = `${r.target}:${r.id}`;
  commit({
    ...state,
    reports: [...state.reports, { ...r, dateISO: new Date().toISOString() }],
    hidden: state.hidden.includes(key) ? state.hidden : [...state.hidden, key],
  });
}

export function blockAuthor(name: string) {
  ensure();
  const n = norm(name);
  if (!n || state.blocked.some((x) => norm(x) === n)) return;
  commit({ ...state, blocked: [...state.blocked, name.trim()] });
}

export function unblockAuthor(name: string) {
  ensure();
  commit({ ...state, blocked: state.blocked.filter((x) => norm(x) !== norm(name)) });
}

/** Soll dieser Inhalt für mich ausgeblendet sein? */
export function isHidden(s: State, target: ReportTarget, id: string, author?: string): boolean {
  if (s.hidden.includes(`${target}:${id}`)) return true;
  return !!author && s.blocked.some((x) => norm(x) === norm(author));
}
