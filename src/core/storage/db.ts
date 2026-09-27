/**
 * IndexedDB Database initialization and schema management
 * Defined in PRD Section 26
 */

import { DBSchema, IDBPDatabase, openDB } from "idb";
import { BusinessRecord } from "../schema/business-record";
import { ExtractionSession, QueueItem } from "../schema/session";
import { MediaRecord } from "../schema/media-record";
import { ReviewRecord } from "../schema/review-record";
import { MediaReviewJob } from "../schema/media-review-job";
import { WhatsAppOutreachRecord, OutreachTemplate, DEFAULT_OUTREACH_TEMPLATE } from "../schema/whatsapp-outreach";
import { LinkedInSession, LinkedInProfileRecord } from "../schema/linkedin-profile";

export interface StoredRecord extends BusinessRecord {
  sessionId: string;
}

export interface LeadExtractionDB extends DBSchema {
  sessions: {
    key: string;
    value: ExtractionSession;
    indexes: {
      updatedAt: string;
      status: string;
    };
  };
  queue_items: {
    key: string;
    value: QueueItem;
    indexes: {
      sessionId: string;
      status: string;
    };
  };
  business_records: {
    key: string;
    value: StoredRecord;
    indexes: {
      sessionId: string;
      placeIdentifier: string;
      normalizedNameAddress: string;
      normalizedNamePhone: string;
      websiteStatus: string;
      extractionStatus: string;
    };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  media_review_jobs: {
    key: string;
    value: MediaReviewJob;
    indexes: {
      businessId: string;
      status: string;
      updatedAt: string;
    };
  };
  media_records: {
    key: string;
    value: MediaRecord;
    indexes: {
      businessId: string;
      reviewId: string;
      sourceContext: string;
      canonicalFingerprint: string;
      extractionStatus: string;
    };
  };
  review_records: {
    key: string;
    value: ReviewRecord;
    indexes: {
      businessId: string;
      rating: number;
      extractionStatus: string;
      reviewFingerprint: string;
    };
  };
  whatsapp_outreach: {
    key: string;
    value: WhatsAppOutreachRecord;
    indexes: {
      phone_normalized: string;
      session_id: string;
      status: string;
      sent_timestamp: string;
    };
  };
  outreach_templates: {
    key: string;
    value: OutreachTemplate;
    indexes: {
      is_default: number;
    };
  };
  linkedin_sessions: {
    key: string;
    value: LinkedInSession;
    indexes: {
      status: string;
      updatedAt: string;
    };
  };
  linkedin_profiles: {
    key: string;
    value: LinkedInProfileRecord;
    indexes: {
      sessionId: string;
      connectionStatus: string;
      websiteStatus: string;
    };
  };
}

const DB_NAME = "lead-extraction-db";
const DB_VERSION = 4;

let dbInstance: IDBPDatabase<LeadExtractionDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<LeadExtractionDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<LeadExtractionDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Sessions store
      if (!db.objectStoreNames.contains("sessions")) {
        const sessions = db.createObjectStore("sessions", { keyPath: "sessionId" });
        sessions.createIndex("updatedAt", "updatedAt");
        sessions.createIndex("status", "status");
      }

      // 2. Queue items store
      if (!db.objectStoreNames.contains("queue_items")) {
        const queue = db.createObjectStore("queue_items", { keyPath: "queueId" });
        queue.createIndex("sessionId", "sessionId");
        queue.createIndex("status", "status");
      }

      // 3. Business records store
      if (!db.objectStoreNames.contains("business_records")) {
        const records = db.createObjectStore("business_records", { keyPath: "record_id" });
        records.createIndex("sessionId", "sessionId");
        records.createIndex("placeIdentifier", "place_identifier");
        records.createIndex("normalizedNameAddress", "normalizedNameAddress");
        records.createIndex("normalizedNamePhone", "normalizedNamePhone");
        records.createIndex("websiteStatus", "website_status");
        records.createIndex("extractionStatus", "extraction_status");
      }

      // 4. Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // 5. Media review jobs store (PRD Addendum §17.2)
      if (!db.objectStoreNames.contains("media_review_jobs")) {
        const jobs = db.createObjectStore("media_review_jobs", { keyPath: "jobId" });
        jobs.createIndex("businessId", "businessId");
        jobs.createIndex("status", "status");
        jobs.createIndex("updatedAt", "updatedAt");
      }

      // 6. Media records store (PRD Addendum §17.2)
      if (!db.objectStoreNames.contains("media_records")) {
        const media = db.createObjectStore("media_records", { keyPath: "media_id" });
        media.createIndex("businessId", "business_id");
        media.createIndex("reviewId", "review_id");
        media.createIndex("sourceContext", "source_context");
        media.createIndex("canonicalFingerprint", "canonicalFingerprint");
        media.createIndex("extractionStatus", "extraction_status");
      }

      // 7. Review records store (PRD Addendum §17.2)
      if (!db.objectStoreNames.contains("review_records")) {
        const reviews = db.createObjectStore("review_records", { keyPath: "review_id" });
        reviews.createIndex("businessId", "business_id");
        reviews.createIndex("rating", "rating");
        reviews.createIndex("extractionStatus", "extraction_status");
        reviews.createIndex("reviewFingerprint", "reviewFingerprint");
      }

      // 8. WhatsApp outreach store
      if (!db.objectStoreNames.contains("whatsapp_outreach")) {
        const outreach = db.createObjectStore("whatsapp_outreach", { keyPath: "outreach_id" });
        outreach.createIndex("phone_normalized", "phone_normalized");
        outreach.createIndex("session_id", "session_id");
        outreach.createIndex("status", "status");
        outreach.createIndex("sent_timestamp", "sent_timestamp");
      }

      // 9. Outreach templates store
      if (!db.objectStoreNames.contains("outreach_templates")) {
        const templates = db.createObjectStore("outreach_templates", { keyPath: "template_id" });
        templates.createIndex("is_default", "is_default");
        templates.put({
          ...DEFAULT_OUTREACH_TEMPLATE,
          is_default: 1 as any,
        });
      }

      // 10. LinkedIn sessions store
      if (!db.objectStoreNames.contains("linkedin_sessions")) {
        const liSessions = db.createObjectStore("linkedin_sessions", { keyPath: "sessionId" });
        liSessions.createIndex("status", "status");
        liSessions.createIndex("updatedAt", "updatedAt");
      }

      // 11. LinkedIn profiles store
      if (!db.objectStoreNames.contains("linkedin_profiles")) {
        const liProfiles = db.createObjectStore("linkedin_profiles", { keyPath: "profileId" });
        liProfiles.createIndex("sessionId", "sessionId");
        liProfiles.createIndex("connectionStatus", "connectionStatus");
        liProfiles.createIndex("websiteStatus", "websiteStatus");
      }
    },
  });

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Clears data object stores (sessions, queue_items, business_records, media/review stores, whatsapp outreach).
 * Strictly preserves user settings and saved templates.
 */
export async function clearEntireDatabase(): Promise<void> {
  const db = await getDb();
  const dataStores = [
    "sessions",
    "queue_items",
    "business_records",
    "media_review_jobs",
    "media_records",
    "review_records",
    "whatsapp_outreach",
  ] as const;
  const storeNames = dataStores.filter((s) => db.objectStoreNames.contains(s));
  const tx = db.transaction(storeNames, "readwrite");
  await Promise.all([
    ...storeNames.map((store) => tx.objectStore(store).clear()),
    tx.done,
  ]);
}

