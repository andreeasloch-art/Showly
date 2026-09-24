/* Typen zur Datenbank.
 *
 * Von Hand geschrieben, passend zu supabase/migrations/0001_showly_grundlage.sql.
 * Sobald das Supabase-Projekt steht, lässt sich diese Datei erzeugen mit:
 *   npx supabase gen types typescript --project-id <kennung> > src/lib/database.types.ts
 * Dann bleibt sie automatisch im Takt mit dem Schema. */

export type UserRole = "customer" | "artist" | "planner" | "admin";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
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
  created_at: string;
  updated_at: string;
}

export type BookingRow = {
  id: number;
  customer: string;
  artist_id: number;
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
    };
  };
}
