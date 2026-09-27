/**
 * Schema definitions for WhatsApp Cold Outreach & Duplicate Prevention
 * Defined in PRD: Automated WhatsApp Cold Outreach & Duplicate Prevention Engine
 */

export type OutreachStatus =
  | "pending"
  | "sent"
  | "invalid_number"
  | "failed"
  | "skipped_duplicate";

export interface WhatsAppOutreachRecord {
  outreach_id: string; // UUID v4
  record_id: string; // Reference to BusinessRecord.record_id
  session_id: string; // Originating session ID
  business_name: string;
  phone_normalized: string; // E.164 format (+919876543210) - Primary lookup
  sent_text: string; // Final resolved spintax text sent
  template_id?: string;
  status: OutreachStatus;
  sent_timestamp: string; // ISO 8601 UTC
  error_message?: string;
}

export interface OutreachTemplate {
  template_id: string;
  title: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppCampaignSettings {
  minDelaySeconds: number; // e.g. 20
  maxDelaySeconds: number; // e.g. 45
  batchSizeLimit: number; // e.g. 30
  skipPreviouslyMessaged: boolean; // default: true
  includeSocialOnly: boolean; // default: false
  maxConsecutiveErrors: number; // default: 3
  aiLanguage?: "English" | "Hindi" | "Hinglish";
}

export const DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS: WhatsAppCampaignSettings = {
  minDelaySeconds: 20,
  maxDelaySeconds: 45,
  batchSizeLimit: 30,
  skipPreviouslyMessaged: true,
  includeSocialOnly: false,
  maxConsecutiveErrors: 3,
};

export const DEFAULT_OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    template_id: "tpl_web_1_free_demo",
    title: "1. Simple Free Demo Offer",
    content:
      "{Hi|Hello} {business_name}, I saw your {category} on Google Maps. You don't have a website listed yet. We make simple websites that help local businesses get more customer calls. Can I send you a free sample website we made for your business?",
    is_default: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_2_search_ranking",
    title: "2. More Calls and Customers",
    content:
      "{Hello|Hi} {business_name}, noticed your business on Google Maps without a website. Having a clean website helps customers in {city} find you and call you directly. Would you like to see a quick free demo website we created for you?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_3_customer_trust",
    title: "3. Google Search Free Sample",
    content:
      "{Hey|Hi} {business_name}, I came across your {category} on Maps. Many people in {city} search online before visiting, but you don't have a website link. I made a free sample website for {business_name}. Can I share it with you?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_4_direct_inquiries",
    title: "4. Fast Mobile Website",
    content:
      "{Hi|Hello} {business_name}, saw your listing on Google Maps. We build fast, simple mobile websites for local businesses so customers can easily see your services and call. Would you be open to seeing a free website sample?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_5_competitor_edge",
    title: "5. Free Preview Website",
    content:
      "{Hello|Hi} {business_name}, I was looking for {category} in {city} on Google Maps and noticed you have no website yet. We help local shops and businesses get online easily. Can I send you a free preview website we designed for you?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_6_casual_direct",
    title: "6. Quick Question and Mockup",
    content:
      "{Hey|Hello} {business_name}, quick question — are you looking for a website for your business? We create simple, clean websites to get you more calls from Google. Can I show you a free mockup we prepared for {business_name}?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_7_services_showcase",
    title: "7. Show Services and Contact",
    content:
      "{Hi|Hello} {business_name}, found your {category} on Google Maps. A simple 1-page website showing your services helps new customers trust you faster. Can I send you a quick free sample website to take a look?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_8_short_punchy",
    title: "8. Short and Budget-Friendly",
    content:
      "{Hi|Hello} {business_name}, saw you don't have a website on your Google profile. We make simple, budget-friendly websites for local businesses in {city}. Open to checking out a free demo design for your business?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_9_local_growth",
    title: "9. Direct Calls and Growth",
    content:
      "{Hello|Hi} {business_name}, loved your listing on Google Maps! We help businesses in {city} get more direct calls with a modern website. We already prepared a free website sample for you — can I send the link?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    template_id: "tpl_web_10_concept_preview",
    title: "10. Zero Obligation Preview",
    content:
      "{Hey|Hi} {business_name}, noticed your {category} listing has no website link on Google. I created a quick sample website for {business_name}. It's totally free to view — would you like me to send it over?",
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

export const DEFAULT_OUTREACH_TEMPLATE: OutreachTemplate = DEFAULT_OUTREACH_TEMPLATES[0];
