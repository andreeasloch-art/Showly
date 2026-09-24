/* Typen zur Datenbank.
 *
 * Von Hand geschrieben, passend zu supabase/migrations/0001_showly_grundlage.sql
 * und 0002_anfragen_konto_meldungen.sql.
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
  | "declined";
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
    };
  };
}
