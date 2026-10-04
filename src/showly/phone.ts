/* Handynummern einheitlich im internationalen Format (E.164), so wie der
 * SMS-Dienst sie braucht: "0151 234 567 89" wird zu "+4915123456789".
 * Ohne Landesvorwahl gilt Deutschland, bei spanischer Oberfläche Spanien. */
export function normalizePhone(raw: string, lang = "de"): string | null {
  let v = raw.trim().replace(/[\s()./-]/g, "");
  if (!v) return null;
  if (v.startsWith("00")) v = "+" + v.slice(2);
  else if (v.startsWith("0")) v = (lang === "es" ? "+34" : "+49") + v.slice(1);
  else if (!v.startsWith("+")) v = (lang === "es" ? "+34" : "+49") + v;
  /* Deutsche Nummern mit (0) nach der Vorwahl: +49 (0) 151 … */
  v = v.replace(/^\+49\s*0/, "+49");
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

/** Für die Anzeige: "+49 151 23456789" statt einer langen Ziffernfolge */
export function prettyPhone(e164: string): string {
  const m = /^\+(49|34|43|41)(\d{3})(\d+)$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Kennung für die Anmeldung im Übungsmodus: E-Mail (klein geschrieben)
 *  oder Handynummer im internationalen Format. */
export function loginId(raw: string, lang = "de"): string | null {
  const v = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return v;
  return /[a-z@]/.test(v) ? null : normalizePhone(v, lang);
}
