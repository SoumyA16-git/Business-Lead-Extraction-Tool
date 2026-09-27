/**
 * Country-Aware Phone Number Normalization and WhatsApp Link Generator
 * Supports international numbering plans, trunk prefix stripping, and metadata tracking.
 */

export interface CountryInfo {
  iso: string;
  callingCode: string;
  name: string;
  nationalNumberLengths: number[];
  trunkPrefix?: string;
}

export const COUNTRY_REGISTRY: CountryInfo[] = [
  { iso: "IN", callingCode: "+91", name: "India", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "US", callingCode: "+1", name: "United States", nationalNumberLengths: [10], trunkPrefix: "1" },
  { iso: "CA", callingCode: "+1", name: "Canada", nationalNumberLengths: [10], trunkPrefix: "1" },
  { iso: "GB", callingCode: "+44", name: "United Kingdom", nationalNumberLengths: [9, 10, 11], trunkPrefix: "0" },
  { iso: "AE", callingCode: "+971", name: "United Arab Emirates", nationalNumberLengths: [8, 9], trunkPrefix: "0" },
  { iso: "AU", callingCode: "+61", name: "Australia", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SG", callingCode: "+65", name: "Singapore", nationalNumberLengths: [8] },
  { iso: "MY", callingCode: "+60", name: "Malaysia", nationalNumberLengths: [9, 10], trunkPrefix: "0" },
  { iso: "DE", callingCode: "+49", name: "Germany", nationalNumberLengths: [10, 11], trunkPrefix: "0" },
  { iso: "FR", callingCode: "+33", name: "France", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "IT", callingCode: "+39", name: "Italy", nationalNumberLengths: [9, 10] },
  { iso: "ES", callingCode: "+34", name: "Spain", nationalNumberLengths: [9] },
  { iso: "BR", callingCode: "+55", name: "Brazil", nationalNumberLengths: [10, 11], trunkPrefix: "0" },
  { iso: "ZA", callingCode: "+27", name: "South Africa", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SA", callingCode: "+966", name: "Saudi Arabia", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "EG", callingCode: "+20", name: "Egypt", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "PK", callingCode: "+92", name: "Pakistan", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "BD", callingCode: "+880", name: "Bangladesh", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "LK", callingCode: "+94", name: "Sri Lanka", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "NP", callingCode: "+977", name: "Nepal", nationalNumberLengths: [10] },
  { iso: "NZ", callingCode: "+64", name: "New Zealand", nationalNumberLengths: [8, 9], trunkPrefix: "0" },
  { iso: "ID", callingCode: "+62", name: "Indonesia", nationalNumberLengths: [9, 10, 11], trunkPrefix: "0" },
  { iso: "PH", callingCode: "+63", name: "Philippines", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "TH", callingCode: "+66", name: "Thailand", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "VN", callingCode: "+84", name: "Vietnam", nationalNumberLengths: [9, 10], trunkPrefix: "0" },
  { iso: "JP", callingCode: "+81", name: "Japan", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "CN", callingCode: "+86", name: "China", nationalNumberLengths: [11], trunkPrefix: "0" },
  { iso: "RU", callingCode: "+7", name: "Russia", nationalNumberLengths: [10], trunkPrefix: "8" },
  { iso: "NL", callingCode: "+31", name: "Netherlands", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "CH", callingCode: "+41", name: "Switzerland", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SE", callingCode: "+46", name: "Sweden", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "NO", callingCode: "+47", name: "Norway", nationalNumberLengths: [8] },
  { iso: "DK", callingCode: "+45", name: "Denmark", nationalNumberLengths: [8] },
  { iso: "IE", callingCode: "+353", name: "Ireland", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "MX", callingCode: "+52", name: "Mexico", nationalNumberLengths: [10] },
];

export interface PhoneNormalizationContext {
  address?: string | null;
  searchContextQuery?: string | null;
  defaultCountry?: string;
}

export interface PhoneNormalizationResult {
  phone_raw: string;
  phone_normalized: string;
  phone_country: string;
  phone_country_calling_code: string;
  phone_country_source:
    | "phone_prefix"
    | "tel_uri"
    | "business_address"
    | "search_context"
    | "default"
    | "unknown";
  phone_status: "valid" | "invalid" | "unknown" | "partial";
  whatsapp_link: string;
}

/**
 * Detects the country calling code and ISO code from explicit prefix, address, or search context.
 */
export function detectCountryContext(
  rawPhone: string | null | undefined,
  context?: PhoneNormalizationContext
): {
  country: CountryInfo | null;
  source: PhoneNormalizationResult["phone_country_source"];
} {
  const phone = rawPhone ? rawPhone.trim() : "";

  // 1. Check explicit international prefix in phone (e.g. +91, +44, +1, +971)
  if (phone.startsWith("+") || phone.startsWith("00")) {
    const cleanDigits = phone.replace(/^[+0]+/, "");
    // Match against longest calling codes first (e.g. +971, +880 before +9, +8)
    const sorted = [...COUNTRY_REGISTRY].sort(
      (a, b) => b.callingCode.length - a.callingCode.length
    );
    for (const c of sorted) {
      const codeDigits = c.callingCode.replace("+", "");
      if (cleanDigits.startsWith(codeDigits)) {
        return { country: c, source: "phone_prefix" };
      }
    }
  }

  // 2. Check tel: URI or explicit tel prefix
  if (/^tel:\s*\+/i.test(phone)) {
    const cleanDigits = phone.replace(/^tel:\s*\+/i, "");
    const sorted = [...COUNTRY_REGISTRY].sort(
      (a, b) => b.callingCode.length - a.callingCode.length
    );
    for (const c of sorted) {
      const codeDigits = c.callingCode.replace("+", "");
      if (cleanDigits.startsWith(codeDigits)) {
        return { country: c, source: "tel_uri" };
      }
    }
  }

  // 3. Check address country keywords
  const address = context?.address ? context.address.toLowerCase() : "";
  if (address) {
    if (/\b(india|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|noida|gurgaon|gurugram|odisha|bhubaneswar|kerala|punjab|gujarat|maharashtra|rajasthan|karnataka|tamil nadu|uttar pradesh)\b/i.test(address) || /\b\d{6}\b/.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "IN");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(united states|usa|u\.s\.a\.|u\.s\.|california|texas|florida|new york|washington|illinois|georgia|virginia|ohio|alaska|nevada|arizona)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "US");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(united kingdom|uk|u\.k\.|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|liverpool)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "GB");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(united arab emirates|uae|u\.a\.e\.|dubai|abu dhabi|sharjah|ajman|ras al khaimah|fujairah)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "AE");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(australia|sydney|melbourne|brisbane|perth|adelaide)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "AU");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(singapore)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "SG");
      if (c) return { country: c, source: "business_address" };
    }
    if (/\b(canada|toronto|vancouver|montreal|ottawa|calgary)\b/i.test(address)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "CA");
      if (c) return { country: c, source: "business_address" };
    }
  }

  // 4. Check search context query
  const query = context?.searchContextQuery ? context.searchContextQuery.toLowerCase() : "";
  if (query) {
    if (/\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|noida|gurgaon|gurugram|bhubaneswar|india)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "IN");
      if (c) return { country: c, source: "search_context" };
    }
    if (/\b(dubai|abu dhabi|sharjah|uae)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "AE");
      if (c) return { country: c, source: "search_context" };
    }
    if (/\b(london|manchester|birmingham|uk|england)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "GB");
      if (c) return { country: c, source: "search_context" };
    }
    if (/\b(new york|los angeles|chicago|houston|miami|usa|california|texas)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "US");
      if (c) return { country: c, source: "search_context" };
    }
    if (/\b(sydney|melbourne|brisbane|australia)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "AU");
      if (c) return { country: c, source: "search_context" };
    }
    if (/\b(singapore)\b/i.test(query)) {
      const c = COUNTRY_REGISTRY.find((x) => x.iso === "SG");
      if (c) return { country: c, source: "search_context" };
    }
  }

  // 5. Configured default country (e.g. IN)
  const defaultIso = context?.defaultCountry || "IN";
  const def = COUNTRY_REGISTRY.find((x) => x.iso.toUpperCase() === defaultIso.toUpperCase());
  if (def) {
    return { country: def, source: "default" };
  }

  return { country: null, source: "unknown" };
}

/**
 * Generates a valid WhatsApp deep link (https://wa.me/<digits_without_plus>)
 */
export function generateWhatsAppLink(phoneNormalized: string | null | undefined): string {
  if (!phoneNormalized || !phoneNormalized.startsWith("+")) {
    return "";
  }
  const digits = phoneNormalized.replace(/\D/g, "");
  // WhatsApp international format must have at least 8 digits
  if (digits.length < 8) {
    return "";
  }
  return `https://wa.me/${digits}`;
}

/**
 * Normalizes phone numbers in a country-aware manner without adding incorrect leading zeros.
 */
export function normalizePhone(
  rawPhone: string | null | undefined,
  context?: PhoneNormalizationContext
): PhoneNormalizationResult {
  const result: PhoneNormalizationResult = {
    phone_raw: rawPhone ? rawPhone.trim() : "",
    phone_normalized: "",
    phone_country: "",
    phone_country_calling_code: "",
    phone_country_source: "unknown",
    phone_status: "unknown",
    whatsapp_link: "",
  };

  if (!rawPhone || !rawPhone.trim()) {
    result.phone_status = "unknown";
    return result;
  }

  const raw = rawPhone.trim();
  result.phone_raw = raw;

  // Extract all digits from input
  const allDigits = raw.replace(/\D/g, "");
  if (allDigits.length < 6 || allDigits.length > 16) {
    result.phone_status = "invalid";
    return result;
  }

  // Detect country context
  const { country, source } = detectCountryContext(raw, context);
  if (country) {
    result.phone_country = country.iso;
    result.phone_country_calling_code = country.callingCode;
    result.phone_country_source = source;
  }

  const callingDigits = country ? country.callingCode.replace("+", "") : "";

  let nationalNumber = "";
  let finalCallingCode = country ? country.callingCode : "";

  if (raw.startsWith("+") || raw.startsWith("00")) {
    // Input explicitly started with international prefix
    const cleanDigits = raw.startsWith("+") ? raw.slice(1).replace(/\D/g, "") : raw.replace(/^00/, "").replace(/\D/g, "");

    // Check if cleanDigits starts with callingDigits
    if (callingDigits && cleanDigits.startsWith(callingDigits)) {
      let rest = cleanDigits.slice(callingDigits.length);
      // Strip trunk prefix if present after country code (e.g. +91 09876543210 -> strip 0)
      if (country?.trunkPrefix && rest.startsWith(country.trunkPrefix)) {
        rest = rest.slice(country.trunkPrefix.length);
      }
      nationalNumber = rest;
    } else {
      // Find matching country from prefix
      const sorted = [...COUNTRY_REGISTRY].sort(
        (a, b) => b.callingCode.length - a.callingCode.length
      );
      let matchedCountry: CountryInfo | null = null;
      for (const c of sorted) {
        const cDigits = c.callingCode.replace("+", "");
        if (cleanDigits.startsWith(cDigits)) {
          matchedCountry = c;
          finalCallingCode = c.callingCode;
          result.phone_country = c.iso;
          result.phone_country_calling_code = c.callingCode;
          result.phone_country_source = "phone_prefix";
          let rest = cleanDigits.slice(cDigits.length);
          if (c.trunkPrefix && rest.startsWith(c.trunkPrefix)) {
            rest = rest.slice(c.trunkPrefix.length);
          }
          nationalNumber = rest;
          break;
        }
      }
      if (!matchedCountry) {
        // Unmatched international number
        nationalNumber = cleanDigits;
        finalCallingCode = "+";
      }
    }
  } else {
    // Input without explicit '+' prefix
    if (country) {
      if (callingDigits && allDigits.startsWith(callingDigits) && allDigits.length === callingDigits.length + 10) {
        // Case: country code was typed without '+' (e.g. '91 9876543210' -> 12 digits)
        nationalNumber = allDigits.slice(callingDigits.length);
      } else if (country.trunkPrefix && allDigits.startsWith(country.trunkPrefix)) {
        // Case: National number with trunk prefix (e.g. '09876543210' in India or '020 7946 0958' in UK)
        const stripped = allDigits.slice(country.trunkPrefix.length);
        if (country.nationalNumberLengths.includes(stripped.length)) {
          nationalNumber = stripped;
        } else {
          nationalNumber = allDigits;
        }
      } else {
        nationalNumber = allDigits;
      }
    } else {
      nationalNumber = allDigits;
    }
  }

  // Validate national number length against country rules
  if (country) {
    if (country.nationalNumberLengths.includes(nationalNumber.length)) {
      result.phone_status = "valid";
      result.phone_normalized = `${finalCallingCode}${nationalNumber}`;
      result.whatsapp_link = generateWhatsAppLink(result.phone_normalized);
    } else if (nationalNumber.length >= 7 && nationalNumber.length <= 12) {
      result.phone_status = "partial";
      result.phone_normalized = `${finalCallingCode}${nationalNumber}`;
      result.whatsapp_link = generateWhatsAppLink(result.phone_normalized);
    } else {
      result.phone_status = "invalid";
    }
  } else {
    if (nationalNumber.length >= 8 && nationalNumber.length <= 15) {
      result.phone_status = "partial";
      result.phone_normalized = `+${nationalNumber}`;
      result.whatsapp_link = generateWhatsAppLink(result.phone_normalized);
    } else {
      result.phone_status = "invalid";
    }
  }

  return result;
}
