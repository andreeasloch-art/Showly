/* Startphase ohne Provision: bis wann gilt sie für den angemeldeten
 * Anbieter (Künstler, Konditorei, Deko, Kostüme)? (showly/feeRules.ts, AGB § 21 Abs. 1) */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";

export const myStartPhase = createServerFn({ method: "POST" }).handler(async (): Promise<{ until: string | null }> => {
  let ctx;
  try {
    ctx = await requireUser();
  } catch {
    return { until: null };
  }
  /* Künstler, Konditoren, Deko- und Kostümanbieter: es zählt das erste Konto */
  const db = adminClient();
  const [a, p] = await Promise.all([
    db.from("artists").select("created_at").eq("owner", ctx.user.id).order("created_at").limit(1).maybeSingle(),
    db.from("providers").select("created_at").eq("owner", ctx.user.id).order("created_at").limit(1).maybeSingle(),
  ]);
  const since = [a.data?.created_at, p.data?.created_at].filter((x): x is string => !!x).sort()[0];
  if (!since) return { until: null };
  const { inStartPhase, startFreeUntil } = await import("@/showly/feeRules");
  return { until: inStartPhase(since) ? startFreeUntil(since).toISOString().slice(0, 10) : null };
});
