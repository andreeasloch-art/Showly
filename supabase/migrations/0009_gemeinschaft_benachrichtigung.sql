-- Showly: Bewertungen und Event-Blog in der Datenbank, Benachrichtigungen
--
-- 1. Anzeigename bei Bewertung, Beitrag und Kommentar. Die Person wählt ihn
--    beim Schreiben (etwa nur den Vornamen); der Name im Konto bleibt privat.
alter table public.reviews       add column if not exists author_name text check (char_length(author_name) <= 60);
alter table public.posts         add column if not exists author_name text check (char_length(author_name) <= 60);
alter table public.post_comments add column if not exists author_name text check (char_length(author_name) <= 60);

-- Wer als Künstler schreibt, verweist auf sein Profil
alter table public.posts add column if not exists author_artist bigint references public.artists(id) on delete set null;

-- 2. Benachrichtigungen per Mail: Merker, damit dieselbe Mail nie zweimal
--    rausgeht (etwa Erinnerung "Anfrage wartet seit 24 Stunden").
create table if not exists public.notifications_sent (
  key        text primary key check (char_length(key) <= 120),
  created_at timestamptz not null default now()
);
alter table public.notifications_sent enable row level security;

-- 3. Auszahlungen: Kennung der Stripe-Überweisung und Fehlertext
alter table public.payouts add column if not exists stripe_transfer_id text;
alter table public.payouts add column if not exists last_error text;
