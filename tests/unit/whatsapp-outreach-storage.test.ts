import { describe, it, expect, beforeEach } from "vitest";
import {
  saveOutreachRecord,
  getOutreachByPhone,
  hasPhoneBeenMessaged,
  getAllMessagedPhones,
  saveOutreachTemplate,
  getOutreachTemplates,
} from "../../src/core/storage/whatsapp-outreach-repo";
import { clearEntireDatabase } from "../../src/core/storage/db";
import { WhatsAppOutreachRecord } from "../../src/core/schema/whatsapp-outreach";

describe("WhatsApp Outreach Storage and Deduplication", () => {
  beforeEach(async () => {
    await clearEntireDatabase();
  });

  it("saves and retrieves outreach records by phone", async () => {
    const record: WhatsAppOutreachRecord = {
      outreach_id: "outreach_1",
      record_id: "biz_1",
      session_id: "sess_1",
      business_name: "Test Business",
      phone_normalized: "+919876543210",
      sent_text: "Hello Test Business",
      status: "sent",
      sent_timestamp: new Date().toISOString(),
    };

    await saveOutreachRecord(record);
    const byPhone = await getOutreachByPhone("+919876543210");
    expect(byPhone.length).toBe(1);
    expect(byPhone[0].business_name).toBe("Test Business");
    expect(byPhone[0].status).toBe("sent");
  });

  it("checks if phone has been messaged correctly", async () => {
    expect(await hasPhoneBeenMessaged("+919876543210")).toBe(false);

    const record: WhatsAppOutreachRecord = {
      outreach_id: "outreach_1",
      record_id: "biz_1",
      session_id: "sess_1",
      business_name: "Test Business",
      phone_normalized: "+919876543210",
      sent_text: "Hello Test Business",
      status: "sent",
      sent_timestamp: new Date().toISOString(),
    };
    await saveOutreachRecord(record);

    expect(await hasPhoneBeenMessaged("+919876543210")).toBe(true);
  });

  it("collects all messaged phones across multiple sessions", async () => {
    await saveOutreachRecord({
      outreach_id: "outreach_1",
      record_id: "biz_1",
      session_id: "sess_1",
      business_name: "Business A",
      phone_normalized: "+12025550100",
      sent_text: "Hi",
      status: "sent",
      sent_timestamp: new Date().toISOString(),
    });

    await saveOutreachRecord({
      outreach_id: "outreach_2",
      record_id: "biz_2",
      session_id: "sess_2",
      business_name: "Business B",
      phone_normalized: "+12025550200",
      sent_text: "Hi",
      status: "failed", // failed does not count as successfully messaged
      sent_timestamp: new Date().toISOString(),
    });

    await saveOutreachRecord({
      outreach_id: "outreach_3",
      record_id: "biz_3",
      session_id: "sess_3",
      business_name: "Business C",
      phone_normalized: "+12025550300",
      sent_text: "Hi",
      status: "sent",
      sent_timestamp: new Date().toISOString(),
    });

    const messaged = await getAllMessagedPhones();
    expect(messaged.has("+12025550100")).toBe(true);
    expect(messaged.has("+12025550200")).toBe(false);
    expect(messaged.has("+12025550300")).toBe(true);
    expect(messaged.size).toBe(2);
  });

  it("persists and retrieves templates", async () => {
    const templates = await getOutreachTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(1);

    await saveOutreachTemplate({
      template_id: "tpl_custom_1",
      title: "Custom Offer",
      content: "Custom text for {business_name}",
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const updated = await getOutreachTemplates();
    expect(updated.some((t) => t.template_id === "tpl_custom_1")).toBe(true);
  });
});
