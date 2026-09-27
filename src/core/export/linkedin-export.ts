/**
 * LinkedIn Profile Export Utilities
 * Exports session profiles to CSV or JSON
 */

import {
  LinkedInSession,
  LinkedInProfileRecord,
} from "../schema/linkedin-profile";

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function escapeCsvField(value: string | undefined | null): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toLinkedInCsv(profiles: LinkedInProfileRecord[]): string {
  const headers = [
    "Name",
    "Headline",
    "Location",
    "Profile URL",
    "Website Status",
    "Found URLs",
    "Connection Status",
    "Extraction Timestamp",
    "Error",
  ];

  const rows = profiles.map((p) => [
    escapeCsvField(p.name),
    escapeCsvField(p.headline),
    escapeCsvField(p.location),
    escapeCsvField(p.profileUrl),
    escapeCsvField(p.websiteStatus),
    escapeCsvField(p.foundUrls.join(" | ")),
    escapeCsvField(p.connectionStatus),
    escapeCsvField(p.extractionTimestamp),
    escapeCsvField(p.error),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ---------------------------------------------------------------------------
// JSON Export
// ---------------------------------------------------------------------------

export function toLinkedInJson(
  session: LinkedInSession,
  profiles: LinkedInProfileRecord[]
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      session: {
        sessionId: session.sessionId,
        platform: session.platform,
        sourceUrl: session.sourceUrl,
        searchQuery: session.searchQuery,
        status: session.status,
        processedCount: session.processedCount,
        connectedCount: session.connectedCount,
        skippedCount: session.skippedCount,
        failedCount: session.failedCount,
        alreadyConnectedCount: session.alreadyConnectedCount,
        pendingCount: session.pendingCount,
        createdAt: session.createdAt,
        completionReason: session.completionReason,
      },
      profiles,
    },
    null,
    2
  );
}
