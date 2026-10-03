-- Showly: eine Person, ein Profil
--
-- Jede Person bekommt genau ein Künstler- oder Planerprofil. Mehrere Figuren
-- und Acts trägt sie in diesem einen Profil ein, nicht in weiteren Profilen.
--
-- Zwei Sperren:
--  1. Je Konto höchstens ein Profil (eindeutiger Index auf artists.owner).
--  2. Je Person höchstens ein Konto mit Profil. Bei der Ausweisprüfung bildet
--     der Server aus Vorname, Nachname, Geburtsdatum und Ausstellungsland
--     einen Prüfwert (HMAC-SHA256 mit geheimem Schlüssel). Gespeichert wird
--     nur dieser Prüfwert, nie Name oder Geburtsdatum im Klartext. Taucht
--     derselbe Prüfwert bei einem zweiten Konto auf, wird das zweite Profil
--     nicht freigeschaltet.

-- 1. Ein Profil je Konto. Schlägt fehl, wenn es schon doppelte Einträge gibt;
--    die müssen dann vorher von Hand zusammengeführt werden.
create unique index if not exists artists_owner_unique on public.artists (owner);

-- 2. Prüfwerte aus der Ausweisprüfung
create table if not exists public.identity_fingerprints (
  hash        text primary key check (char_length(hash) = 64),
  -- Beim Löschen des Kontos löscht der Server den Prüfwert mit
  -- (account.functions.ts). Nur bei gesperrten Personen bleibt er ohne
  -- Zuordnung stehen, damit die Sperre nicht mit einem neuen Konto endet.
  owner       uuid unique references public.profiles(id) on delete set null,
  blocked     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Nur der Server (Dienstschlüssel) liest und schreibt hier. Ohne Regeln
-- sieht über die öffentliche Schnittstelle niemand etwas.
alter table public.identity_fingerprints enable row level security;
