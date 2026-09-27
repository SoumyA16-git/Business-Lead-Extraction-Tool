/**
 * Place Identifier & Coordinate Extractor from Google Maps URLs
 * Defined in PRD Section 25.4
 */

export function extractPlaceIdentifier(mapsUrl: string): string | null {
  if (!mapsUrl) return null;
  // Look for !1s0x...:0x... pattern
  const hexPairMatch = mapsUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (hexPairMatch) return hexPairMatch[1];

  // Look for data param hex pair
  const dataParamMatch = mapsUrl.match(/[?&]data=.*?(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (dataParamMatch) return dataParamMatch[1];

  // Look for ftid param hex pair
  const ftidMatch = mapsUrl.match(/[?&]ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (ftidMatch) return ftidMatch[1];

  // Look for 0x...:0x... anywhere in URL
  const anyHexMatch = mapsUrl.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (anyHexMatch) return anyHexMatch[1];

  // Look for ChIJ place id: e.g. !19sChIJ...
  const chijMatch = mapsUrl.match(/!19s(ChIJ[0-9a-zA-Z_-]+)/i);
  if (chijMatch) return chijMatch[1];

  return null;
}

export function extractCoordinates(mapsUrl: string): { lat: number | null; lng: number | null } {
  if (!mapsUrl) return { lat: null, lng: null };

  // 1. Check @lat,lng format
  const atMatch = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 2. Check !3d<lat>!4d<lng> data format (common in place URLs)
  const dataCoordMatch = mapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataCoordMatch) {
    const lat = parseFloat(dataCoordMatch[1]);
    const lng = parseFloat(dataCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 3. Check ll=<lat>,<lng> query param
  const llMatch = mapsUrl.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  return { lat: null, lng: null };
}

export function extractPlusCode(doc: Document): string | null {
  const plusBtn =
    doc.querySelector('button[data-item-id*="oloc"]') ||
    doc.querySelector('button[aria-label*="Plus code" i]') ||
    doc.querySelector('[data-tooltip*="Plus code" i]');
  if (plusBtn) {
    const text = plusBtn.textContent?.trim() || "";
    // Plus codes typically look like 7MJP+3C City
    const match = text.match(/[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(\s+.+)?/i);
    if (match) return match[0].trim();
    if (text) return text;
  }
  return null;
}
