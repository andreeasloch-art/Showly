# Löschkonzept – was wird wann gelöscht?

Automatisch im täglichen Lauf (`/api/taeglich`, `purge_old_data`,
`purge_slot_holds`), sonst bei Kontolöschung.

| Daten | Frist | Wie |
|---|---|---|
| Konto, Profil, Beiträge, Bewertungen, Fotos | sofort bei Kontolöschung | „Konto löschen“ im Konto |
| Eventadresse, Anlass, Wünsche (inkl. Angaben zu Kindern) | mit der Buchung 10 Jahre, nach Kontolöschung ohne Personenbezug | Kunde: Kontolöschung; Anbieter löschen eigene Kopien 30 Tage nach dem Event (AGB § 20 Abs. 6) |
| Chat-Nachrichten | 24 Monate | automatisch |
| Hilfe-Anfragen | 24 Monate nach Erledigung | automatisch |
| Fehlerprotokoll | 90 Tage | automatisch |
| Missbrauchszähler | 2 Tage | automatisch |
| SMS-Zähler | 30 Tage | automatisch |
| Reservierungen an der Kasse | 15 Minuten | automatisch |
| Warenkorb-Entwurf einer offenen Zahlung | 2 Tage | automatisch |
| Belegungen von Mietartikeln | 30 Tage nach Mietende | automatisch |
| Termine aus externen Kalendern | 1 Tag nach Ende | automatisch |
| Buchungs- und Zahlungsbelege | 10 Jahre (§ 147 AO, § 257 HGB) | danach manuell/Job |

Grundsatz Datensparsamkeit: Anbieter sehen nur, was sie für den Auftrag
brauchen (Name, Termin, Ort, Wünsche); E-Mail und Telefon des Kunden erst nach
der Zusage, Zahlungsdaten nie.
