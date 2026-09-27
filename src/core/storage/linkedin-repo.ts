/**
 * LinkedIn Storage Repository
 * Mirrors the pattern of sessions-repo.ts and records-repo.ts
 */

import { getDb } from "./db";
import {
  LinkedInProfileRecord,
  LinkedInSession,
} from "../schema/linkedin-profile";

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function saveLinkedInSession(
  session: LinkedInSession
): Promise<void> {
  const db = await getDb();
  session.updatedAt = new Date().toISOString();
  await db.put("linkedin_sessions", session);
}

export async function getLinkedInSession(
  sessionId: string
): Promise<LinkedInSession | undefined> {
  const db = await getDb();
  return db.get("linkedin_sessions", sessionId);
}

export async function getAllLinkedInSessions(): Promise<LinkedInSession[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(
    "linkedin_sessions",
    "updatedAt"
  );
  // Return newest-first
  return all.reverse();
}

export async function deleteLinkedInSession(
  sessionId: string
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["linkedin_sessions", "linkedin_profiles"],
    "readwrite"
  );

  // Delete all profiles belonging to this session
  const profileIndex = tx
    .objectStore("linkedin_profiles")
    .index("sessionId");
  let profileCursor = await profileIndex.openCursor(
    IDBKeyRange.only(sessionId)
  );
  while (profileCursor) {
    await profileCursor.delete();
    profileCursor = await profileCursor.continue();
  }

  await tx.objectStore("linkedin_sessions").delete(sessionId);
  await tx.done;
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

export async function saveLinkedInProfile(
  profile: LinkedInProfileRecord
): Promise<void> {
  const db = await getDb();
  await db.put("linkedin_profiles", profile);
}

export async function getProfilesBySession(
  sessionId: string
): Promise<LinkedInProfileRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("linkedin_profiles", "sessionId", sessionId);
}

export async function getLinkedInProfile(
  profileId: string
): Promise<LinkedInProfileRecord | undefined> {
  const db = await getDb();
  return db.get("linkedin_profiles", profileId);
}
