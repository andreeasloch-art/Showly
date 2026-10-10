/* Typen zur Datenbank.
 *
 * Von Hand geschrieben, passend zu supabase/migrations/0001_showly_grundlage.sql,
 * 0002_anfragen_konto_meldungen.sql, 0003_buchungsablauf_geld.sql und
 * 0004_chat_admin_anbieter_support.sql und
 * 0005_privat_gewerblich_steuer.sql und 0007_medien_pruefung.sql.
 * Sobald das Supabase-Projekt steht, lässt sich diese Datei erzeugen mit:
 *   npx supabase gen types typescript --project-id <kennung> > src/lib/database.types.ts
 * Dann bleibt sie automatisch im Takt mit dem Schema. */

export type UserRole = "customer" | "artist" | "planner" | "admin";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "requested"
  | "declined"
  | "noshow";
export type PenaltyReason = "late" | "noshow";
export type PenaltyStatus = "hearing" | "due" | "proof" | "waived";
export type PayoutStatus = "scheduled" | "held" | "paid" | "cancelled";
export type SweetStatus = "sent" | "quoted" | "confirmed" | "declined" | "booked" | "cancelled";
export type ReportTarget = "post" | "comment" | "review" | "profile";
export type ReportStatus = "open" | "removed" | "kept";
export type VerificationStatus =
  | "none"
  | "pending"
  | "processing"
  | "verified"
  | "failed"
  | "cancelled";

/** Mehrsprachiges Textfeld, wie es in der Datenbank als JSON liegt. */
export type LText = {
  de: string;
  en?: string;
  es?: string;
}
export type LList = {
  de: string[];
  en?: string[];
  es?: string[];
}

export type MediaRefRow = {
  id: string;
  kind: "image" | "video";
  name?: string;
  ratio?: number;
}

/* Supabase leitet aus dieser Form ab, was beim Lesen und Schreiben erlaubt ist.
   Fehlt ein Teil, hält die Bibliothek jede Tabelle für leer und meldet "never". */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
}

export type ProfileRow = {
  id: string;
  role: UserRole;
  display_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type MediaStatus = "pending" | "approved" | "rejected";
export type MediaRow = {
  id: string;
  owner: string;
  kind: "image" | "video";
  path: string;
  mime: string;
  bytes: number;
  duration: number | null;
  ratio: number | null;
  auto_check: Record<string, unknown>;
  status: MediaStatus;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ArtistRow = {
  id: number;
  /** Pakete Basic/Premium/Luxus der Planer (0015), showly/plannerPackages.ts */
  packages?: { id: string; name: string; price: number; dur: string; inc: string[]; text: string; popular?: boolean }[] | null;
  /** Arbeitszeiten je Wochentag (0013), showly/workHours.ts */
  work_hours?: Record<string, [number, number]> | null;
  /** Stornostufe, Springer-Liste, Stornoquote (0016), showly/policies.ts */
  cancel_tier?: "flexibel" | "moderat" | "streng";
  standby?: boolean;
  cancel_rate?: number;
  /** Wochenendzuschlag und Saisonpreise (0019), showly/surcharges.ts */
  surcharges?: { weekend: number; seasons: { from: string; to: string; pct: number; label: string }[] } | null;
  /** Urlaubsmodus von–bis einschließlich (0019) */
  away_from?: string | null;
  away_until?: string | null;
  owner: string;
  cat: string;
  name: LText;
  loc: LText;
  descr: LText;
  tags: LList;
  langs: LList;
  includes: LList;
  specs: LList;
  price_cents: number;
  color: string | null;
  image_path: string | null;
  /** Galerie: Fotos und Videos (Kennungen aus public.media) */
  media: { id: string; kind: "image" | "video"; ratio?: number }[];
  verified: boolean;
  superhost: boolean;
  published: boolean;
  rating: number;
  review_count: number;
  events_count: number;
  response_time: LText | Record<string, never>;
  response_rate: string | null;
  instant_book: boolean;
  /** gewerblich (true) oder privat; bei privat keine Vertragsstrafe */
  business: boolean;
  tax_ack_at: string | null;
  blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type BookingRow = {
  /** Teilbestellung je Anbieter (0012) */
  sub_order_id?: number | null;
  id: number;
  /** null, wenn das Kundenkonto gelöscht wurde */
  customer: string | null;
  /** null, wenn das Künstlerprofil gelöscht wurde */
  artist_id: number | null;
  day: string;
  slot: string | null;
  hours: number;
  amount_cents: number;
  fee_cents: number;
  payout_cents: number;
  status: BookingStatus;
  figure: string | null;
  location: string | null;
  guests: number | null;
  stripe_session_id: string | null;
  requested_at: string | null;
  /** Beispielprofil aus dem Katalog, wenn artist_id leer ist */
  catalog_artist: number | null;
  pkg: string | null;
  occasion: string | null;
  notes: string | null;
  address: string | null;
  customer_name: string | null;
  paid: boolean;
  cancelled_by: "customer" | "artist" | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  checked_in_by: "artist" | "customer" | null;
  refunded_cents: number;
  refunded_at: string | null;
  /** gespeicherte Stornoregel, Umbuchung, Check-in-Hinweis, Ersatz (0016) */
  policy?: PolicyJson | null;
  rebooked_at?: string | null;
  rebooked_from?: string | null;
  checkin_alert_at?: string | null;
  replacements?: { id: number; name: string; price_cents: number; rating: number; standby: boolean }[] | null;
  created_at: string;
}

export type PenaltyRow = {
  id: number;
  booking_id: number;
  artist_id: number | null;
  amount_cents: number;
  reason: PenaltyReason;
  status: PenaltyStatus;
  hearing_until: string | null;
  due_at: string | null;
  statement: string | null;
  /** schon mit Auszahlungen verrechnet (0016) */
  offset_cents?: number;
  created_at: string;
  updated_at: string;
}

export type VoucherRow = {
  code: string;
  owner: string | null;
  booking_id: number | null;
  amount_cents: number;
  valid_until: string;
  redeemed_at: string | null;
  created_at: string;
}

export type PayoutRow = {
  id: number;
  artist_id: number | null;
  /** null bei Teilbestellungen von Konditoreien und Deko-Anbietern (0019) */
  booking_id: number | null;
  /** Wunschtorte (0020) */
  sweet_request_id?: number | null;
  sub_order_id?: number | null;
  owner?: string | null;
  kind?: "artist" | "baker" | "deco" | "location";
  event_day?: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  reserve_cents: number;
  reserve_until: string | null;
  payout_on: string;
  status: PayoutStatus;
  stripe_transfer_id: string | null;
  last_error: string | null;
  /** Geschwindigkeit und Gebühr, eingefroren bei Reklamation, verrechnete Strafen (0016) */
  speed?: "standard" | "fast" | "express";
  express_fee_cents?: number;
  frozen?: boolean;
  offset_cents?: number;
  /** Provision und Abrechnung (0021) */
  provision_bp?: number | null;
  provision_ust_cent?: number;
  erstattet_cent?: number;
  ausgezahlt_am?: string | null;
  einbehalt_frei_am?: string | null;
  ueberwiesen_cent?: number | null;
  auszahlung_id?: number | null;
  einbehalt_auszahlung_id?: number | null;
  created_at: string;
}

export type PayoutAccountRow = {
  profile_id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  updated_at: string;
}

export type SweetRequestRow = {
  /** Teilbestellung je Anbieter (0012) */
  sub_order_id?: number | null;
  id: number;
  customer: string | null;
  baker_ref: number;
  baker_owner: string | null;
  sweet_ref: number;
  day: string;
  qty: number;
  city: string | null;
  wishes: string | null;
  customer_name: string | null;
  price_cents: number;
  direct: boolean;
  /** Stornoregel Torte (0018) */
  policy?: PolicyJson | null;
  status: SweetStatus;
  stripe_session_id: string | null;
  /** Wunschtorten (0020): bezahlt, davon nachgezahlt, erstattet, höherer Preis */
  paid_cents?: number;
  extra_cents?: number;
  refunded_cents?: number;
  quote_cents?: number | null;
  quote_note?: string | null;
  extra_session_id?: string | null;
  created_at: string;
}

export type ShopOrderRow = {
  /** Teilbestellung je Anbieter (0012) */
  sub_order_id?: number | null;
  id: number;
  customer: string | null;
  items: {
    shopId: number;
    mode: "rent" | "buy";
    qty: number;
    price_cents: number;
    from?: string;
    to?: string;
    size?: string;
    ship?: "pickup" | "delivery" | "shipping";
    deposit_cents?: number;
  }[];
  total_cents: number;
  status: "pending" | "paid" | "shipped" | "returned" | "cancelled";
  ship_to: string | null;
  stripe_session_id: string | null;
  provider_owners: string[];
  /** Kaution und Rückgabe (0013) */
  deposit_cents?: number;
  deposit_refunded_cents?: number;
  returned_at?: string | null;
  condition_note?: string | null;
  /** Stornoregel, Sorglos-Paket, Übergabeprotokoll, Schaden (0016) */
  policy?: PolicyJson | null;
  carefree?: boolean;
  handover?: HandoverRow;
  damage?: { items: { key: string; qty?: number }[]; cents: number; note?: string; objected_at?: string } | null;
  damage_reported_at?: string | null;
  deposit_released_at?: string | null;
  created_at: string;
}

export type PolicyJson = { kind: "artist" | "cake" | "rental"; tier: "flexibel" | "moderat" | "streng"; free: number; half: number; midRate: number; rebook: boolean };
export type HandoverStep = { photos: string[]; at: string; by: string; note?: string; confirmed_at?: string };
export type HandoverRow = { out?: HandoverStep; back?: HandoverStep };

export type ComplaintRow = {
  id: number;
  booking_id: number | null;
  shop_order_id: number | null;
  sweet_request_id: number | null;
  customer: string;
  provider_owner: string | null;
  category: "late" | "short" | "different" | "rude" | "cake" | "item" | "damage";
  body: string;
  evidence: string[];
  amount_cents: number;
  status: "open" | "offer" | "agreed" | "escalated" | "decided" | "withdrawn";
  statement: string | null;
  statement_at: string | null;
  statement_due: string;
  offer_cents: number | null;
  offer_by: "customer" | "provider" | null;
  refund_cents: number | null;
  decision: string | null;
  decide_by: string;
  decided_at: string | null;
  created_at: string;
}

export type ProviderRow = {
  id: number;
  owner: string;
  kind: "baker" | "deco" | "location";
  data: Record<string, unknown>;
  published: boolean;
  blocked: boolean;
  created_at: string;
  updated_at: string;
}

export type ProviderOfferRow = {
  id: number;
  provider_id: number;
  kind: "sweet" | "deco";
  data: Record<string, unknown>;
  price_cents: number;
  rent_cents: number;
  direct: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type MessageRow = {
  /** Anhang im privaten Speicher "chat" (0014) */
  attachment?: { path: string; name: string; mime: string; bytes: number } | null;
  id: number;
  booking_id: number | null;
  sweet_request_id: number | null;
  sender: string | null;
  sender_role: "customer" | "provider" | "admin";
  body: string;
  read_at: string | null;
  created_at: string;
}

export type SupportTopic = "booking" | "payment" | "account" | "provider" | "report" | "other";

export type SupportTicketRow = {
  id: number;
  profile: string | null;
  email: string;
  name: string | null;
  topic: SupportTopic;
  body: string;
  status: "open" | "answered" | "closed";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

export type ClientErrorRow = {
  id: number;
  profile: string | null;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

export type ReviewRow = {
  id: number;
  artist_id: number;
  author: string;
  rating: number;
  body: string;
  event_date: string | null;
  media: MediaRefRow[];
  author_name: string | null;
  /** verifizierte Buchung, Teilnoten, Antwort, verdeckt bis veröffentlicht (0016) */
  booking_id?: number | null;
  verified?: boolean;
  sub?: Record<string, number>;
  reply?: string | null;
  reply_at?: string | null;
  published_at?: string | null;
  created_at: string;
}

export type PostRow = {
  id: number;
  author: string;
  body: string;
  city: string | null;
  media: MediaRefRow[];
  author_name: string | null;
  author_artist: number | null;
  created_at: string;
}

export type VerificationRow = {
  id: number;
  profile_id: string;
  provider: string;
  provider_session_id: string | null;
  status: VerificationStatus;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportRow = {
  id: number;
  reporter: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  decision: string | null;
  decided_at: string | null;
  created_at: string;
}


/* Belegsystem (0021) */
export type AnbieterRow = {
  id: string;
  typ: "gewerblich" | "kleinunternehmer" | "privat";
  name: string | null;
  firma: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
  steuernummer: string | null;
  ust_id: string | null;
  handelsregister: string | null;
  rechnung_praefix: string | null;
  ust_satz_standard: number;
  geburtsdatum: string | null;
  steuer_id: string | null;
  iban: string | null;
  auszahlungen_gesperrt: boolean;
  sperrgrund: string | null;
  zaehler_jahr: number;
  umsatz_jahr_cent: number;
  buchungen_jahr: number;
  hinweis_gewerbe: boolean;
  hinweis_gewerbe_am: string | null;
  warnung_umsatzgrenze: boolean;
  created_at: string;
  updated_at: string;
};
export type BelegRow = {
  id: number;
  art: "rechnung" | "quittung" | "storno" | "korrektur" | "provisionsrechnung" | "auszahlungsabrechnung" | "kaution";
  nummer: string;
  kreis: string;
  jahr: number;
  laufnummer: number;
  aussteller_typ: "anbieter" | "plattform";
  anbieter_id: string | null;
  im_namen_von_anbieter: boolean;
  kunde_id: string | null;
  order_id: number | null;
  buchung_id: number | null;
  bezug_beleg_id: number | null;
  quelle: string | null;
  belegdatum: string;
  leistung_von: string | null;
  leistung_bis: string | null;
  aussteller_snapshot: Record<string, unknown>;
  empfaenger_snapshot: Record<string, unknown>;
  netto_cent: number;
  steuer_cent: number;
  brutto_cent: number;
  steuer_aufstellung: { satz: number; netto_cent: number; steuer_cent: number; brutto_cent: number }[];
  pflichthinweise: string[];
  kleinbetrag: boolean;
  e_rechnung_erforderlich: boolean;
  pdf_pfad: string | null;
  sha256: string | null;
  xml_pfad: string | null;
  auszahlung_id: number | null;
  erstellt_am: string;
};
export type BelegPositionRow = {
  id: number;
  beleg_id: number;
  pos: number;
  beschreibung: string;
  menge: number;
  einzel_brutto_cent: number;
  brutto_cent: number;
  steuersatz: number;
  leistung_von: string | null;
  leistung_bis: string | null;
  referenz: string | null;
};
export type AbzugRow = {
  id: number;
  anbieter_id: string;
  art: "strafgebuehr" | "schaden" | "sonstiges";
  betrag_cent: number;
  grund: string;
  buchung_id: number | null;
  verrechnet_cent: number;
  penalty_id: number | null;
  erstellt_von: string | null;
  erstellt_am: string;
};
export type ProvisionKorrekturRow = {
  id: number;
  anbieter_id: string;
  buchung_id: number | null;
  payout_id: number | null;
  beleg_id: number | null;
  umsatz_cent: number;
  provision_netto_cent: number;
  provision_ust_cent: number;
  rueckforderung_cent: number;
  verrechnet_cent: number;
  quelle: string | null;
  auszahlung_id: number | null;
  erstellt_am: string;
};
export type VerrechnungRow = {
  id: number;
  payout_id: number;
  abzug_id: number | null;
  korrektur_id: number | null;
  betrag_cent: number;
  auszahlung_id: number | null;
  erstellt_am: string;
};
export type AuszahlungRow = {
  id: number;
  anbieter_id: string;
  zeitraum_von: string;
  zeitraum_bis: string;
  umsatz_brutto_cent: number;
  provision_netto_cent: number;
  provision_steuer_cent: number;
  provision_brutto_cent: number;
  gebuehren_cent: number;
  einbehalt_cent: number;
  abzuege_cent: number;
  korrekturen_cent: number;
  vortrag_cent: number;
  auszahlung_cent: number;
  status: "bereit" | "ausgezahlt" | "erledigt" | "vortrag";
  provisionsrechnung_id: number | null;
  abrechnung_id: number | null;
  erstellt_am: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      artists: Table<ArtistRow>;
      availability: Table<{
        artist_id: number;
        day: string;
        slot: string;
        blocked: boolean;
      }>;
      bookings: Table<BookingRow>;
      reviews: Table<ReviewRow>;
      /** Aufrufe je Profil und Tag, ohne Personendaten (0019) */
      provider_views: Table<{ kind: "artist" | "baker" | "deco" | "location"; ref: number; day: string; views: number }>;
      /** Reklamationen (0016) */
      complaints: Table<ComplaintRow>;
      /** Bewertung des Kunden durch den Künstler, verdeckt (0016) */
      guest_reviews: Table<{
        id: number;
        booking_id: number;
        artist_id: number;
        customer: string;
        rating: number;
        body: string | null;
        published_at: string | null;
        created_at: string;
      }>;
      posts: Table<PostRow>;
      post_artists: Table<{ post_id: number; artist_id: number }>;
      post_likes: Table<{ post_id: number; profile_id: string; created_at: string }>;
      post_comments: Table<{
        id: number;
        post_id: number;
        author: string;
        body: string;
        author_name: string | null;
        created_at: string;
      }>;
      verifications: Table<VerificationRow>;
      /** Prüfwert aus der Ausweisprüfung, nur für den Server (0008) */
      notifications_sent: Table<{ key: string; created_at: string }>;
      /** Zähler für SMS-Codes (0010), nur gehashte Werte */
      /** Belegte Zeiten (Reservierung beim Bezahlen oder Buchung), 0012 */
      slot_claims: Table<{
        id: number;
        artist_id: number;
        day: string;
        slot: string;
        hours: number;
        starts_at: string;
        ends_at: string;
        guard: string;
        kind: "hold" | "booking";
        hold_key: string | null;
        expires_at: string | null;
        booking_id: number | null;
        created_at: string;
      }>;
      calendar_feeds: Table<{
        id: number;
        artist_id: number;
        url: string;
        label: string | null;
        last_synced_at: string | null;
        last_error: string | null;
        events_count: number;
        created_at: string;
      }>;
      external_busy: Table<{
        id: number;
        feed_id: number;
        artist_id: number;
        starts_at: string;
        ends_at: string;
        all_day: boolean;
      }>;
      calendar_export: Table<{ artist_id: number; token: string; created_at: string }>;
      orders: Table<{
        id: number;
        customer: string | null;
        stripe_session_id: string | null;
        event_day: string | null;
        total_cents: number;
        status: "pending" | "paid" | "cancelled";
        /** Rabatt aus einem Code, trägt Showly (0014) */
        discount_cents?: number;
        /** Rückbuchung bei der Bank des Kunden (0013) */
        dispute_status?: "open" | "won" | "lost" | null;
        /** Rechnungsempfänger (0021) */
        kunde_name?: string | null;
        kunde_firma?: string | null;
        kunde_ust_id?: string | null;
        kunde_anschrift?: string | null;
        created_at: string;
      }>;
      /** Warenkorb zu einer offenen Zahlung, für den Stripe-Webhook (0013) */
      checkout_drafts: Table<{
        session_id: string;
        customer: string;
        environment: "sandbox" | "live";
        snapshot: unknown;
        hold_key: string | null;
        created_at: string;
      }>;
      /** Provision je Kategorie oder Anbieter (0014) */
      fee_rules: Table<{ id: number; scope: "category" | "artist" | "baker" | "deco" | "location"; ref: string; rate: number; created_at: string }>;
      /** Protokoll aller Aktionen der Verwaltung (0014) */
      admin_audit: Table<{ id: number; actor: string | null; action: string; target: string | null; detail: Record<string, unknown> | null; created_at: string }>;
      /** Belegte Mietartikel je Zeitraum (0013) */
      rental_claims: Table<{
        id: number;
        item_ref: number;
        from_day: string;
        until_day: string;
        qty: number;
        kind: "hold" | "booking";
        hold_key: string | null;
        expires_at: string | null;
        shop_order_id: number | null;
        created_at: string;
      }>;
      /** Bereits verarbeitete Stripe-Ereignisse (0013) */
      stripe_events: Table<{ id: string; type: string; received_at: string }>;
      sub_orders: Table<{
        id: number;
        order_id: number;
        provider_kind: "artist" | "baker" | "deco" | "location" | "showly";
        provider_id: number | null;
        provider_owner: string | null;
        amount_cents: number;
        fee_cents: number;
        payout_cents: number;
        status: "pending" | "paid" | "requested" | "confirmed" | "declined" | "cancelled" | "refunded" | "fulfilled";
        provision_bp?: number | null;
        erstattet_cent?: number;
        created_at: string;
      }>;
      sms_log: Table<{
        id: number;
        kind: "send" | "check";
        phone_hash: string;
        ip_hash: string;
        country: string;
        ok: boolean;
        created_at: string;
      }>;
      identity_fingerprints: Table<{ hash: string; owner: string | null; blocked: boolean; created_at: string }>;
      reports: Table<ReportRow>;
      blocks: Table<{ blocker: string; blocked: string; created_at: string }>;
      penalties: Table<PenaltyRow>;
      vouchers: Table<VoucherRow>;
      payouts: Table<PayoutRow>;
      payout_accounts: Table<PayoutAccountRow>;
      sweet_requests: Table<SweetRequestRow>;
      shop_orders: Table<ShopOrderRow>;
      /** Check-in-Code, nur für den Kunden lesbar */
      booking_codes: Table<{ booking_id: number; code: string }>;
      admin_emails: Table<{ email: string }>;
      providers: Table<ProviderRow>;
      provider_offers: Table<ProviderOfferRow>;
      messages: Table<MessageRow>;
      support_tickets: Table<SupportTicketRow>;
      client_errors: Table<ClientErrorRow>;
      media: Table<MediaRow>;
      rate_limits: Table<{ bucket: string; window_start: string; hits: number }>;
      anbieter: Table<AnbieterRow>;
      nummernkreise: Table<{ schluessel: string; jahr: number; letzte_nummer: number }>;
      belege: Table<BelegRow>;
      beleg_positionen: Table<BelegPositionRow>;
      anbieter_abzuege: Table<AbzugRow>;
      provision_korrekturen: Table<ProvisionKorrekturRow>;
      verrechnungen: Table<VerrechnungRow>;
      auszahlungen: Table<AuszahlungRow>;
      spotlights: Table<SpotlightRow>;
      /** Gebuchte Locations (0024) */
      venue_bookings: Table<VenueBookingRow>;
    };
    Views: {
      artists_public: Table<
        Omit<ArtistRow, "owner" | "published" | "blocked" | "blocked_reason" | "tax_ack_at" | "created_at" | "updated_at">
      >;
      providers_public: Table<Pick<ProviderRow, "id" | "kind" | "data" | "created_at">>;
      provider_offers_public: Table<
        Pick<ProviderOfferRow, "id" | "provider_id" | "kind" | "data" | "price_cents" | "rent_cents" | "direct">
      >;
    };
    Functions: {
      /** Schlüssel des Datenbank-Zeitplans prüfen (0017) */
      bump_view: {
        Args: { p_kind: string; p_ref: number };
        Returns: undefined;
      };
      cron_token_ok: {
        Args: { p_token: string };
        Returns: boolean;
      };
      hit_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_seconds: number };
        Returns: boolean;
      };
      purge_old_data: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      purge_sms_log: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      claim_slots: {
        Args: { p_items: unknown; p_kind: "hold" | "booking"; p_hold_key?: string | null; p_minutes?: number };
        Returns: { ok: boolean; index?: number; reason?: "busy" | "blocked" | "external" | "hours" | "unknown" };
      };
      claim_rentals: {
        Args: { p_items: unknown; p_kind: "hold" | "booking"; p_hold_key?: string | null; p_minutes?: number; p_order?: number | null };
        Returns: { ok: boolean; index?: number; reason?: "busy" };
      };
      release_hold: {
        Args: { p_hold_key: string };
        Returns: number;
      };
      purge_slot_holds: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      beleg_anlegen: { Args: { p: unknown }; Returns: BelegRow };
      beleg_zaehlen: { Args: { p_anbieter: string; p_cent: number; p_buchungen: number }; Returns: AnbieterRow };
      anbieter_jahreswechsel: { Args: Record<string, never>; Returns: number };
      anbieter_praefix: { Args: { p_id: string }; Returns: string };
      spotlight_reservieren: {
        Args: { p: unknown };
        Returns: { id?: number; error?: string };
      };
      venue_reservieren: {
        Args: { p: unknown };
        Returns: { id?: number; error?: string };
      };
      wochenabrechnung_buchen: {
        Args: { p: unknown };
        Returns: { status: "neu" | "vorhanden" | "gesperrt" | "unbekannt"; id?: number; provisionsrechnung_id?: number | null; abrechnung_id?: number };
      };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      verification_status: VerificationStatus;
      report_target: ReportTarget;
      report_status: ReportStatus;
      penalty_reason: PenaltyReason;
      penalty_status: PenaltyStatus;
      payout_status: PayoutStatus;
      sweet_status: SweetStatus;
    };
  };
}

/** Top Act der Woche (0022) */
export type VenueBookingRow = {
  id: number;
  customer: string | null;
  venue_id: number;
  owner: string | null;
  day: string;
  start: string;
  hours: number;
  starts_at: string;
  ends_at: string;
  guests: number;
  pkg: string | null;
  extras: unknown;
  occasion: string | null;
  notes: string | null;
  customer_name: string | null;
  amount_cents: number;
  fee_cents: number;
  payout_cents: number;
  deposit_cents: number;
  deposit_status: "held" | "released" | "kept" | "none";
  status: "hold" | "requested" | "confirmed" | "declined" | "cancelled" | "completed";
  hold_until: string | null;
  paid: boolean;
  stripe_session_id: string | null;
  sub_order_id: number | null;
  policy: unknown;
  requested_at: string | null;
  created_at: string;
};

export type SpotlightRow = {
  id: number;
  owner: string;
  artist_id: number | null;
  city: string;
  city_slug: string;
  name: string;
  cat: string;
  tagline: string;
  link: string | null;
  starts_on: string;
  ends_on: string;
  weeks: number;
  amount_cents: number;
  status: "reserved" | "paid" | "cancelled";
  hold_until: string | null;
  stripe_session_id: string | null;
  created_at: string;
};
