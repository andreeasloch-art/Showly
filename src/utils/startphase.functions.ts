/* Startphase ohne Provision: bis wann gilt sie für den angemeldeten
 * Künstler? (showly/feeRules.ts, AGB § 21 Abs. 1) */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";

export const myStartPhase = createServerFn({ method: "POST" }).handler(async (): Promise<{ until: string | null }> => {
  let ctx;
  try {
    ctx = await requireUser();
  } catch {
    return { until: null };
  }
  const { data } = await adminClient().from("artists").select("created_at").eq("owner", ctx.user.id).order("created_at").limit(1).maybeSingle();
  if (!data?.created_at) return { until: null };
  const { inStartPhase, startFreeUntil } = await import("@/showly/feeRules");
  return { until: inStartPhase(data.created_at) ? startFreeUntil(data.created_at).toISOString().slice(0, 10) : null };
});
