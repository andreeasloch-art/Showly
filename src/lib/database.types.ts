/* Typen zur Datenbank.
 *
 * Von Hand geschrieben, passend zu supabase/migrations/0001_showly_grundlage.sql,
 * 0002_anfragen_konto_meldungen.sql und 0003_buchungsablauf_geld.sql.
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
export type SweetStatus = "sent" | "confirmed" | "declined" | "booked" | "cancelled";
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

export type ArtistRow = {
  id: number;
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
  verified: boolean;
  superhost: boolean;
  published: boolean;
  rating: number;
  review_count: number;
  events_count: number;
  response_time: LText | Record<string, never>;
  response_rate: string | null;
  instant_book: boolean;
  created_at: string;
  updated_at: string;
}

export type BookingRow = {
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
  booking_id: number;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  reserve_cents: number;
  reserve_until: string | null;
  payout_on: string;
  status: PayoutStatus;
  stripe_transfer_id: string | null;
  created_at: string;
}

export type PayoutAccountRow = {
  profile_id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  updated_at: string;
}

export type SweetRequestRow = {
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
  status: SweetStatus;
  stripe_session_id: string | null;
  created_at: string;
}

export type ShopOrderRow = {
  id: number;
  customer: string | null;
  items: { shopId: number; mode: "rent" | "buy"; qty: number; price_cents: number }[];
  total_cents: number;
  status: "pending" | "paid" | "shipped" | "returned" | "cancelled";
  ship_to: string | null;
  stripe_session_id: string | null;
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
  created_at: string;
}

export type PostRow = {
  id: number;
  author: string;
  body: string;
  city: string | null;
  media: MediaRefRow[];
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
      posts: Table<PostRow>;
      post_artists: Table<{ post_id: number; artist_id: number }>;
      post_likes: Table<{ post_id: number; profile_id: string; created_at: string }>;
      post_comments: Table<{
        id: number;
        post_id: number;
        author: string;
        body: string;
        created_at: string;
      }>;
      verifications: Table<VerificationRow>;
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
    };
    Views: {
      artists_public: Table<Omit<ArtistRow, "owner" | "published" | "created_at" | "updated_at">>;
    };
    Functions: Record<string, never>;
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
