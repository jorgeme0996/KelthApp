import { parsePhoneNumberFromString } from "libphonenumber-js";

// Normalizes a phone number to E.164 (e.g. "+525512345678"). Returns null if
// the input can't be parsed as a valid number. Defaults to Mexico since
// that's the only market this app currently serves.
export function toE164(raw: string, defaultCountry: "MX" = "MX"): string | null {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}
