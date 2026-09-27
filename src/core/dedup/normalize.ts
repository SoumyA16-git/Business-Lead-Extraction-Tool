/**
 * Text, URL, Phone, and Address Normalization
 * Defined in PRD Section 13.3
 */

/**
 * Unicode-aware name normalization
 */
export function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "") // strip punctuation, keep unicode letters, marks (matras/accents), and numbers
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Address normalization with common street abbreviation expansion
 */
export function normalizeAddress(address: string): string {
  if (!address) return "";
  const abbreviations: Record<string, string> = {
    st: "street",
    rd: "road",
    ave: "avenue",
    blvd: "boulevard",
    ln: "lane",
    dr: "drive",
    apt: "apartment",
    fl: "floor",
    ct: "court",
    sq: "square",
    hwy: "highway",
  };
  let out = address.normalize("NFKC").toLowerCase().replace(/[.,#]/g, " ");
  out = out.replace(/\b(\w+)\b/g, (w) => abbreviations[w] ?? w);
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes phone number: strips non-digit characters except leading +,
 * and returns canonical digits.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned;
}

/**
 * Extracts digit-only suffix (last 10 digits) for fuzzy phone matching across country code formats
 */
export function getPhoneSuffix(phone: string, minLength = 8): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < minLength) return "";
  return digits.slice(-10);
}

/**
 * URL normalization: strips protocol, www, queries, hashes, trailing slashes
 */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const trimmed = url.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    u.search = "";
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
