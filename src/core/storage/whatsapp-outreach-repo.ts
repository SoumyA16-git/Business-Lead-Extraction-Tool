import { getDb } from "./db";
import {
  WhatsAppOutreachRecord,
  OutreachTemplate,
  DEFAULT_OUTREACH_TEMPLATES,
} from "../schema/whatsapp-outreach";

/**
 * Persists or updates an outreach record in IndexedDB
 */
export async function saveOutreachRecord(
  record: WhatsAppOutreachRecord
): Promise<void> {
  const db = await getDb();
  await db.put("whatsapp_outreach", record);
}

/**
 * Retrieves a single outreach record by ID
 */
export async function getOutreachById(
  outreachId: string
): Promise<WhatsAppOutreachRecord | undefined> {
  const db = await getDb();
  return db.get("whatsapp_outreach", outreachId);
}

/**
 * Retrieves all outreach records associated with a specific normalized phone number
 */
export async function getOutreachByPhone(
  phone: string
): Promise<WhatsAppOutreachRecord[]> {
  const db = await getDb();
  const tx = db.transaction("whatsapp_outreach", "readonly");
  const index = tx.store.index("phone_normalized");
  return index.getAll(phone);
}

/**
 * Checks whether a normalized phone number has already been messaged successfully or attempted
 */
export async function hasPhoneBeenMessaged(phone: string): Promise<boolean> {
  if (!phone) return false;
  const history = await getOutreachByPhone(phone);
  return history.some((h) => h.status === "sent" || h.status === "pending");
}

/**
 * Returns a Set of all phone numbers that have been successfully messaged across all sessions.
 * Used for fast $O(1)$ duplicate checking during queue formation.
 */
export async function getAllMessagedPhones(): Promise<Set<string>> {
  const db = await getDb();
  const allRecords = await db.getAll("whatsapp_outreach");
  const messaged = new Set<string>();
  for (const r of allRecords) {
    if (r.phone_normalized && r.status === "sent") {
      const cleanDigits = r.phone_normalized.replace(/\D/g, "");
      if (cleanDigits) {
        messaged.add(cleanDigits);
      }
    }
  }
  return messaged;
}

/**
 * Retrieves all outreach records for a specific extraction session
 */
export async function getOutreachBySession(
  sessionId: string
): Promise<WhatsAppOutreachRecord[]> {
  const db = await getDb();
  const tx = db.transaction("whatsapp_outreach", "readonly");
  const index = tx.store.index("session_id");
  return index.getAll(sessionId);
}

/**
 * Retrieves all outreach records across all sessions, sorted newest first
 */
export async function getAllOutreachRecords(): Promise<WhatsAppOutreachRecord[]> {
  const db = await getDb();
  const records = await db.getAll("whatsapp_outreach");
  return records.sort(
    (a, b) =>
      new Date(b.sent_timestamp).getTime() - new Date(a.sent_timestamp).getTime()
  );
}

/**
 * Deletes an outreach record
 */
export async function deleteOutreachRecord(outreachId: string): Promise<void> {
  const db = await getDb();
  await db.delete("whatsapp_outreach", outreachId);
}

/**
 * Retrieves all saved message templates (ensures default template exists)
 */
export async function getOutreachTemplates(): Promise<OutreachTemplate[]> {
  const db = await getDb();
  let templates = await db.getAll("outreach_templates");

  // Ensure all 10 default templates are present in IndexedDB and updated
  for (const defTpl of DEFAULT_OUTREACH_TEMPLATES) {
    const existing = templates.find((t) => t.template_id === defTpl.template_id);
    if (!existing || existing.content !== defTpl.content || existing.title !== defTpl.title) {
      await db.put("outreach_templates", {
        ...defTpl,
        is_default: (defTpl.is_default ? 1 : 0) as any,
      });
    }
  }
  templates = await db.getAll("outreach_templates");

  // Clean up legacy single default template if present
  const oldLegacy = templates.find((t) => t.template_id === "tpl_default_no_website");
  if (oldLegacy) {
    await db.delete("outreach_templates", "tpl_default_no_website");
    templates = templates.filter((t) => t.template_id !== "tpl_default_no_website");
  }

  return templates.sort((a, b) => (a.is_default ? -1 : b.is_default ? 1 : 0));
}

/**
 * Saves or updates a message template
 */
export async function saveOutreachTemplate(
  template: OutreachTemplate
): Promise<void> {
  const db = await getDb();
  await db.put("outreach_templates", template);
}

/**
 * Deletes a message template by ID
 */
export async function deleteOutreachTemplate(templateId: string): Promise<void> {
  const db = await getDb();
  await db.delete("outreach_templates", templateId);
}
