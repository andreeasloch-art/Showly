-- Wunschtorten werden wie alles andere sofort bezahlt (Richtpreis).
-- Die Konditorei sagt zu (gleicher Preis), senkt den Preis (Rest geht
-- zurück) oder nennt einen höheren Preis ("quoted"); der Kunde bestätigt
-- ihn und zahlt die Differenz nach, oder lehnt ab und bekommt alles zurück.

-- 1 ---------------------------------------------------------------------------
alter type public.sweet_status add value if not exists 'quoted';

alter table public.sweet_requests
  add column if not exists paid_cents        integer not null default 0,  -- insgesamt bezahlt
  add column if not exists extra_cents       integer not null default 0,  -- davon nachgezahlt
  add column if not exists refunded_cents    integer not null default 0,
  add column if not exists quote_cents       integer,                     -- höherer Preis, wartet auf den Kunden
  add column if not exists quote_note        text,
  add column if not exists extra_session_id  text unique;

-- 2 Auszahlung je Wunschtorte (Festpreis-Pakete laufen über die Teilbestellung)
alter table public.payouts
  add column if not exists sweet_request_id bigint unique references public.sweet_requests(id) on delete cascade;
