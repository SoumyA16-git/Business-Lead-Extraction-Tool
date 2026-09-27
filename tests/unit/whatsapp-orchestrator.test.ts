import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppOrchestrator } from "../../src/core/engine/whatsapp-orchestrator";
import { BusinessRecord } from "../../src/core/schema/business-record";
import { DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS } from "../../src/core/schema/whatsapp-outreach";
import { clearEntireDatabase } from "../../src/core/storage/db";

describe("WhatsAppOrchestrator", () => {
  beforeEach(async () => {
    await clearEntireDatabase();
  });

  const mockLeads: BusinessRecord[] = [
    {
      record_id: "rec_1",
      business_name: "Apex Dentists",
      primary_category: "Dentist",
      secondary_categories: [],
      rating: 4.8,
      review_count: 50,
      price_level: null,
      address: "123 Main St, Miami, FL",
      phone: "+13055550100",
      phone_normalized: "+13055550100",
      website: "",
      website_status: "none",
      social_links: [],
      maps_url: "https://maps.google.com/?cid=1",
      place_identifier: "place_1",
      plus_code: null,
      latitude: null,
      longitude: null,
      opening_hours: null,
      business_status: "operational",
      description: null,
      service_options: [],
      attributes: [],
      extraction_status: "complete",
      extraction_timestamp: new Date().toISOString(),
      missing_fields: ["website"],
      error_fields: [],
      source_platform: "google_maps",
      duplicate_of: null,
    },
    {
      record_id: "rec_2",
      business_name: "Bad Number Spa",
      primary_category: "Spa",
      secondary_categories: [],
      rating: 4.2,
      review_count: 20,
      price_level: null,
      address: "456 Ocean Ave, Miami, FL",
      phone: "+13055550200",
      phone_normalized: "+13055550200",
      website: "",
      website_status: "none",
      social_links: [],
      maps_url: "https://maps.google.com/?cid=2",
      place_identifier: "place_2",
      plus_code: null,
      latitude: null,
      longitude: null,
      opening_hours: null,
      business_status: "operational",
      description: null,
      service_options: [],
      attributes: [],
      extraction_status: "complete",
      extraction_timestamp: new Date().toISOString(),
      missing_fields: ["website"],
      error_fields: [],
      source_platform: "google_maps",
      duplicate_of: null,
    },
  ];

  it("processes leads and records sent status", async () => {
    const navigateSpy = vi.fn().mockResolvedValue(undefined);
    const sendSpy = vi.fn().mockImplementation(async (msg) => {
      if (msg.leadId === "rec_1") {
        return { success: true };
      }
      return { success: false, reason: "invalid_number" };
    });
    const broadcastSpy = vi.fn();

    const orchestrator = new WhatsAppOrchestrator(
      mockLeads,
      "Hi {business_name}",
      "sess_test",
      {
        ...DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      },
      {
        sendToWhatsAppTab: sendSpy,
        navigateWhatsAppTab: navigateSpy,
        broadcastToUI: broadcastSpy,
      }
    );

    await orchestrator.start();

    const progress = orchestrator.getProgress();
    expect(progress.status).toBe("completed");
    expect(progress.sentCount).toBe(1);
    expect(progress.invalidNumberCount).toBe(1);
    expect(progress.processedCount).toBe(2);
    expect(navigateSpy).toHaveBeenCalledTimes(2);
  });

  it("can be stopped early during execution", async () => {
    const navigateSpy = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const sendSpy = vi.fn().mockResolvedValue({ success: true });
    const broadcastSpy = vi.fn();

    const orchestrator = new WhatsAppOrchestrator(
      mockLeads,
      "Hi {business_name}",
      "sess_test",
      {
        ...DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
        minDelaySeconds: 1,
        maxDelaySeconds: 1,
      },
      {
        sendToWhatsAppTab: sendSpy,
        navigateWhatsAppTab: navigateSpy,
        broadcastToUI: broadcastSpy,
      }
    );

    const startPromise = orchestrator.start();
    await new Promise((r) => setTimeout(r, 10));
    orchestrator.stop();
    await startPromise;

    expect(orchestrator.getStatus()).toBe("stopped");
  });

  it("randomly selects messages from templatePool for each lead", async () => {
    const pool = [
      "Template Alpha: {business_name}",
      "Template Beta: {business_name}",
      "Template Gamma: {business_name}",
    ];
    const sentTexts: string[] = [];
    const sendSpy = vi.fn().mockImplementation(async (msg) => {
      sentTexts.push(msg.text);
      return { success: true };
    });

    const orchestrator = new WhatsAppOrchestrator(
      mockLeads,
      "Fallback template",
      "sess_test_pool",
      {
        ...DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      },
      {
        sendToWhatsAppTab: sendSpy,
        navigateWhatsAppTab: vi.fn().mockResolvedValue(undefined),
        broadcastToUI: vi.fn(),
      },
      {
        tabStabilizeDelayMs: 0,
        templatePool: pool,
      }
    );

    await orchestrator.start();

    expect(sentTexts.length).toBe(2);
    // Verify each sent message was generated from one of the templates in the pool
    for (const text of sentTexts) {
      const matched = pool.some((tpl) =>
        text.startsWith(tpl.split(":")[0])
      );
      expect(matched).toBe(true);
    }
  });

  it("does not auto-pause on consecutive failures and completes entire queue", async () => {
    const sendSpy = vi.fn().mockResolvedValue({ success: false, reason: "timeout" });

    const orchestrator = new WhatsAppOrchestrator(
      mockLeads,
      "Hi {business_name}",
      "sess_failures",
      {
        ...DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      },
      {
        sendToWhatsAppTab: sendSpy,
        navigateWhatsAppTab: vi.fn().mockResolvedValue(undefined),
        broadcastToUI: vi.fn(),
      },
      {
        tabStabilizeDelayMs: 0,
      }
    );

    await orchestrator.start();

    const progress = orchestrator.getProgress();
    expect(progress.status).toBe("completed");
    expect(progress.failedCount).toBe(2);
    expect(progress.processedCount).toBe(2);
    expect(progress.errorAlert).toBeUndefined();
  });
});
