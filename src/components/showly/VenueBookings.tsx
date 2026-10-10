/* Location-Buchungen in der Übersicht: Kunden sehen ihre Buchungen (Adresse
 * nach Zusage), Anbieter ihre Anfragen und Buchungen mit Zusage/Absage und
 * „Schaden melden“ (Kaution). Ohne Datenbank die Buchungen aus dem Browser. */
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { findVenue } from "@/showly/venues";
import type { VenueBookingView } from "@/utils/venue.functions";
import { venueBg } from "./Venue";

const ST: Record<string, string> = {
  requested: "Wartet auf Zusage",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  declined: "Abgelehnt, Geld zurück",
  cancelled: "Storniert",
  pending: "Offen",
};

export function VenueBookings() {
  const { session, venueBookings, fmt, fmtDate, toast } = useShowly();
  const cloud = !!session?.backend;
  const [rows, setRows] = useState<VenueBookingView[] | null>(null);
  const [damage, setDamage] = useState<{ id: number; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!cloud) return;
    const { myVenueBookings } = await import("@/utils/venue.functions");
    setRows(await myVenueBookings().catch(() => []));
  }, [cloud]);
  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: number, accept: boolean) {
    const { respondVenue } = await import("@/utils/venue.functions");
    const r = await respondVenue({ data: { id, accept } }).catch(() => ({ error: "Hat nicht geklappt" }));
    toast("error" in r ? r.error : accept ? "Zugesagt. Der Kunde bekommt die Adresse." : "Abgelehnt. Der Kunde bekommt sein Geld zurück.");
    void load();
  }
  async function sendDamage() {
    if (!damage) return;
    const { reportVenueDamage } = await import("@/utils/venue.functions");
    const r = await reportVenueDamage({ data: damage }).catch(() => ({ error: "Hat nicht geklappt" }));
    toast("error" in r ? r.error : "Danke. Die Kaution bleibt gehalten, Showly meldet sich innerhalb von 2 Werktagen.");
    setDamage(null);
    void load();
  }

  /* Ohne Datenbank: Buchungen aus diesem Browser */
  const list: VenueBookingView[] =
    rows ??
    venueBookings.map((b) => {
      const v = findVenue(b.venueId);
      return {
        id: b.id,
        venueId: b.venueId,
        venueName: v?.name ?? "Location",
        day: b.dateISO,
        start: b.start,
        hours: b.hours,
        guests: b.guests,
        pkg: b.pkg ?? null,
        occasion: null,
        notes: null,
        amount: b.amount,
        payout: 0,
        deposit: b.deposit,
        depositStatus: b.deposit > 0 ? "held" : "none",
        status: b.status,
        address: null,
        customer: null,
        role: "customer" as const,
      };
    });
  const today = new Date().toISOString().slice(0, 10);

  if (!list.length)
    return (
      <div className="empty-state">
        <div className="ic">
          <Icon name="venue" />
        </div>
        <h3>Noch keine Location gebucht</h3>
        <p>Indoor-Spielplatz, Saal oder Restaurant: Finde den passenden Ort für deine Feier.</p>
        <Link className="btn-primary" to="/locations">
          Locations finden
        </Link>
      </div>
    );

  return (
    <div className="vn-bookings">
      {list.map((b) => {
        const v = findVenue(b.venueId);
        return (
          <article key={b.id} className={"vn-bk " + b.status}>
            <span className="vn-bk-img" style={v ? venueBg(v) : undefined} />
            <div className="vn-bk-body">
              <div className="vn-bk-top">
                <b>{b.venueName}</b>
                <span className={"vn-bk-st " + b.status}>{ST[b.status] ?? b.status}</span>
              </div>
              <small>
                {fmtDate(b.day)} · {b.start} Uhr · {b.hours} Std. · {b.guests} Gäste
                {b.role === "owner" && b.customer ? ` · ${b.customer}` : ""}
              </small>
              {b.occasion && <small>{b.occasion}</small>}
              {b.notes && <small className="co-wish">„{b.notes}“</small>}
              {b.address && (
                <small className="vn-bk-addr">
                  <Icon name="pin" /> {b.address}
                </small>
              )}
              <div className="vn-bk-sum">
                <span>{b.role === "owner" ? `Auszahlung ${fmt(b.payout)}` : fmt(b.amount)}</span>
                {b.deposit > 0 && (
                  <span>
                    Kaution {fmt(b.deposit)}
                    {b.depositStatus === "released" ? " · zurückgezahlt" : b.depositStatus === "kept" ? " · Schaden gemeldet" : ""}
                  </span>
                )}
              </div>
              {b.role === "owner" && b.status === "requested" && (
                <div className="vn-bk-actions">
                  <button className="dash26-mini" onClick={() => void respond(b.id, true)}>
                    <Icon name="check" /> Zusagen
                  </button>
                  <button className="dash26-mini outline" onClick={() => void respond(b.id, false)}>
                    Ablehnen
                  </button>
                </div>
              )}
              {b.role === "owner" && b.status === "confirmed" && b.depositStatus === "held" && b.day <= today && (
                <div className="vn-bk-actions">
                  {damage?.id === b.id ? (
                    <>
                      <textarea
                        rows={3}
                        placeholder="Was ist beschädigt? Bitte Fotos per Support nachreichen."
                        value={damage.text}
                        onChange={(e) => setDamage({ id: b.id, text: e.target.value })}
                      />
                      <button className="dash26-mini" onClick={() => void sendDamage()}>
                        Schaden melden
                      </button>
                    </>
                  ) : (
                    <button className="dash26-mini outline" onClick={() => setDamage({ id: b.id, text: "" })}>
                      Schaden melden (Kaution halten)
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
