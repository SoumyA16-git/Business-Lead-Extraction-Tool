# Product Requirement Document (PRD): Automated WhatsApp Cold Outreach & Duplicate Prevention Engine

**Document type:** Implementation-ready PRD Module  
**Module:** WhatsApp Cold Outreach, Spintax Engine, Tab Automation & Duplicate Prevention  
**Relationship to base document:** Extends `business-lead-extraction-tool-prd.md` and `business-lead-extraction-tool-prd-lead-intelligence.md`  
**Status:** Approved Specification  
**Design Standard:** Enterprise B2B, Industrial, High Information Density, Zero Decorative Filler  

---

## 1. Executive Summary & Problem Statement

### 1.1 Business Context
The Business Lead Extraction Tool extracts high-value local business leads from Google Maps. A significant percentage of discovered local businesses operate without a website (`website_status === "none"` or `social_only`). These businesses represent prime prospects for web agencies, freelancers, and marketers offering web design, digital presence setup, and local SEO services.

While the tool already generates normalized phone numbers and direct `wa.me` links, performing cold outreach manually lead-by-lead is repetitive, slow, and prone to duplicate messaging across overlapping search sessions.

### 1.2 Solution Overview
The **WhatsApp Cold Outreach Module** adds an automated, headless outreach campaign runner directly into the Dashboard. It filters businesses lacking websites, dynamically composes personalized cold pitch messages with Spintax rotation, automatically opens and sends messages via a single dedicated WhatsApp Web tab, respects conservative anti-ban safety limits, handles invalid numbers gracefully, and enforces persistent, cross-session duplicate prevention in IndexedDB.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- **Automated Outreach Queue**: One-click campaign dispatch that iterates through businesses without websites from the current session or selected leads.
- **Single-Tab WhatsApp Web Automation**: Automatically controls a single pinned `web.whatsapp.com` tab using a dedicated Manifest V3 content script to load chats, inject personalized text, click Send, and advance without opening hundreds of tabs.
- **Robust Anti-Spam / Anti-Ban Safeguards**: Configurable random delay jitter (20s–45s), batch size capping (default 25–50 leads/run), and automatic halting upon 3 consecutive failures.
- **Dynamic Spintax & Personalization**: Template engine supporting variables (`{business_name}`, `{primary_category}`, `{city}`, `{rating}`, `{review_count}`) and nested Spintax rotation (`{Hi|Hello|Hey}`) to ensure message uniqueness.
- **Global Cross-Session Deduplication**: Normalized phone-indexed history in IndexedDB preventing duplicate messages across past and future extraction sessions, with optional force-resend overrides.
- **Edge-Case Resilience**: Automatic detection and dismissal of WhatsApp's "Phone number shared via url is invalid" dialogs, marking leads as `not_on_whatsapp` and advancing seamlessly.
- **Unified UI Integration**: Dedicated "WhatsApp Outreach" tab in the Dashboard plus a direct "Start Outreach" action above the Businesses Table.

### 2.2 Non-Goals
- Cloud-hosted / headless API gateways (Twilio, WhatsApp Cloud API) requiring business verification or paid tokens. Everything operates locally through the user's logged-in WhatsApp Web account.
- Bulk broadcast blasting (>100 messages/minute) designed to bypass WhatsApp security. The system deliberately operates with human-like conservative pacing.
- Reading or syncing ongoing WhatsApp inbound conversation history.

---

## 3. User Stories & Workflows

### 3.1 Primary User Flow
1. **Extraction Completion**: User completes a Google Maps lead extraction session in the extension.
2. **Dashboard Review**: User opens the Dashboard and navigates to the **WhatsApp Outreach** tab (or clicks "Launch WhatsApp Outreach" on filtered leads in the Businesses table).
3. **Queue Preparation**:
   - System automatically filters leads where `website_status === "none"` (or allows custom filter: include `social_only`, rating tiers).
   - System cross-references normalized phone numbers against IndexedDB `whatsapp_outreach` store and excludes already-messaged contacts by default.
4. **Template Configuration**:
   - User chooses or edits the message template with variables and spintax.
   - User reviews real-time preview of the personalized draft for the first 3 queue items.
5. **Campaign Execution**:
   - User clicks **"Start Campaign"**.
   - Background service worker finds or opens `https://web.whatsapp.com`.
   - Content script on WhatsApp Web verifies authentication (not logged out / no QR screen).
   - Leads are processed sequentially: chat opens, message is dispatched, delivery state is verified, and a random jitter delay (e.g. 25s) executes before next lead.
6. **Monitoring & Control**:
   - Live progress bar, success/fail counters, and audit log update in real time on the Dashboard.
   - User can click **Pause**, **Resume**, or **Emergency Stop** at any time.

---

## 4. Architecture & Technical Stack Integration

The feature adheres to the existing project architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PREACT DASHBOARD (UI LAYER)                       │
│  - "WhatsApp Outreach" Tab & Preact Campaign Component                 │
│  - Template Composer with Live Spintax & Variable Preview             │
│  - Queue Progress Bar, Speed/Safety Sliders, Live Log Feed             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ chrome.runtime.sendMessage
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKGROUND SERVICE WORKER (CORE)                     │
│  - WhatsAppCampaignOrchestrator: Queue state machine (IDLE/RUN/PAUSE)  │
│  - Tab Coordinator: Manages single pinned WhatsApp Web tab             │
│  - Storage Gateway: Reads records, deduplicates, logs sent outreach    │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │ chrome.tabs.sendMessage               │ IndexedDB
                ▼                                        ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ WHATSAPP WEB CONTENT SCRIPT      │  │        INDEXEDDB STORAGE         │
│ - URL: web.whatsapp.com/*        │  │ Store: 'whatsapp_outreach'       │
│ - Dialog detector (invalid num)  │  │ Index: 'phone_normalized' (uniq) │
│ - Input box / Send button click  │  │ Index: 'sessionId', 'status'     │
│ - Auth / QR code monitor         │  │ Store: 'outreach_templates'      │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

---

## 5. Data Model & Schema

### 5.1 IndexedDB Stores

#### Store 1: `whatsapp_outreach`
Tracks all outreach attempts, ensuring cross-session duplicate prevention.

```typescript
export type OutreachStatus =
  | "pending"
  | "sent"
  | "invalid_number"
  | "failed"
  | "skipped_duplicate";

export interface WhatsAppOutreachRecord {
  outreach_id: string;             // UUID v4
  record_id: string;               // Reference to BusinessRecord.record_id
  session_id: string;              // Originating session ID
  business_name: string;
  phone_normalized: string;        // E.164 format (+919876543210) - Primary lookup
  sent_text: string;               // Final resolved spintax text sent
  template_id?: string;
  status: OutreachStatus;
  sent_timestamp: string;          // ISO 8601 UTC
  error_message?: string;
}
```

**Indexes for `whatsapp_outreach`**:
- `by_phone`: `phone_normalized` (Non-unique, for query history)
- `by_session`: `session_id`
- `by_status`: `status`
- `by_timestamp`: `sent_timestamp`

#### Store 2: `outreach_templates`
Stores user-saved spintax templates.

```typescript
export interface OutreachTemplate {
  template_id: string;
  title: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

### 5.2 Default Pitch Template (For Businesses Without Websites)
```
{Hi|Hello|Hey} {business_name}, {I noticed|I was looking at} your listing on Google Maps and saw that you don't have a website listed yet.

We help local {category} businesses in {city} get more direct customer inquiries with modern, fast mobile websites.

Are you currently open to taking on more clients this month? If so, I'd love to share a quick mock-up we made for you.
```

---

## 6. Spintax & Personalization Engine

### 6.1 Variable Replacements
The engine parses and replaces the following tokens safely:
- `{business_name}`: Normalized business name.
- `{category}`: Lowercased primary category (e.g. "dental clinic").
- `{city}`: Extracted city from `address` or fallback to search query location hint.
- `{address}`: Full street address.
- `{rating}`: Star rating formatted to 1 decimal place (e.g. "4.8").
- `{review_count}`: Number of reviews (e.g. "42").

### 6.2 Spintax Resolver
A deterministic/randomized recursive parser evaluates `{variant1|variant2|variant3}` blocks:
```typescript
export function resolveSpintax(template: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  let text = template;
  while (spintaxRegex.test(text)) {
    text = text.replace(spintaxRegex, (_match, group) => {
      const options = group.split("|");
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen.trim();
    });
  }
  return text;
}
```

---

## 7. Headless WhatsApp Web Automation Specifications

### 7.1 Content Script Injection
- Injected into: `https://web.whatsapp.com/*`
- Manifest permissions required:
  - `"tabs"`, `"scripting"`, `"storage"`
  - `host_permissions`: `["https://web.whatsapp.com/*"]`

### 7.2 Dispatch Sequence (Single-Tab Flow)
1. **Navigate**: Service worker calls `chrome.tabs.update(tabId, { url: 'https://web.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(message) })`.
2. **Tab Handshake**: Background awaits content script readiness message (`WHATSAPP_SCRIPT_READY`).
3. **Wait for DOM State**:
   - Content script polls every 500ms (up to 25s timeout).
   - **Case A (Invalid Number Modal)**: WhatsApp displays popup containing `div[data-animate-modal-popup="true"]` with text matching `"Phone number shared via url is invalid"`.
     - *Action*: Content script clicks the modal's `"OK"` button, reports `{ status: "invalid_number" }`, and closes the alert.
   - **Case B (Logged Out / QR Screen)**: Content script detects `canvas[aria-label="Scan me!"]` or `div[data-ref]`.
     - *Action*: Reports `{ status: "auth_required" }`; orchestrator pauses campaign immediately.
   - **Case C (Chat Loaded & Input Ready)**: Content script detects message input box (`footer div[contenteditable="true"]`) populated with draft text.
     - *Action*: Simulates click on Send button (`button span[data-icon="send"]`, `button span[data-icon="wds-ic-send-filled"]` or dispatches synthetic `Enter` key event on input box).
4. **Confirmation**: Content script verifies message bubble rendered in chat within 3000ms.
5. **Cooldown & Jitter**: Service worker receives success acknowledgment, updates IndexedDB, and waits `randomBetween(minDelay, maxDelay)` before loading the next lead.

---

## 8. Anti-Ban & Safety Rules

| Parameter | Default Value | Recommended Boundary | Rationale |
|---|---|---|---|
| **Min Delay Between Messages** | `20 seconds` | >= 15 seconds | Avoids rapid burst flags by WhatsApp bot detection |
| **Max Delay Between Messages** | `45 seconds` | >= 30 seconds | Natural jitter variation mimics human behavior |
| **Invalid Number / Not on WhatsApp** | `Instant Skip (~1.5s)` | 1 – 2 seconds | Dismisses popup and skips immediately without 20-45s wait |
| **Max Batch Size per Run** | `30 leads` | 25 – 50 leads | Prevents daily account throttling |
| **Max Consecutive Errors** | `3 errors` | 2 – 4 errors | Auto-pauses on genuine connection failures (excludes invalid numbers) |
| **Duplicate Message Action** | `Auto-Skip` | Strict Global Skip | Prevents spamming businesses multiple times |

---

## 9. Dashboard UI Specification

### 9.1 New Subnav Tab
- Added to subnav: `<button class="tab-btn" data-tab="whatsapp-outreach">WhatsApp Outreach</button>`

### 9.2 Outreach Dashboard Layout
1. **Target Selection Header**:
   - Filter chips: `No Website Only (default)`, `Include Social-Only`, `Has Valid Phone`.
   - Lead Count Banner: *"24 Eligible Leads Found (6 Skipped as Already Messaged)"*.
2. **Template & Spintax Composer**:
   - Textarea with syntax highlighting / variable insertion buttons (`+ Business Name`, `+ Category`, `+ City`).
   - "Test Spintax" button with instant preview cards showing 3 randomized output variations.
3. **Safety & Throttling Settings Bar**:
   - Sliders: Delay Jitter (`20s - 45s`), Batch Limit (`30`).
   - Checkbox: `Skip previously messaged numbers (Global Deduplication)` (Default: Checked).
4. **Campaign Control & Live Progress**:
   - Actions: `[ Start Campaign ]`, `[ Pause ]`, `[ Stop ]`.
   - Progress bar: `Sent: 12 / 30 (40%) | Skipped: 6 | Failed: 1`.
   - Live Activity Feed: Real-time scrolling table showing timestamp, business name, phone, message snippet, and status badge.

### 9.3 Table Integration in Businesses Tab
- Above the Businesses table, add a primary quick-action button:  
  `[ Send WhatsApp to No-Website Leads (N) ]`  
  Clicking switches to the WhatsApp Outreach tab with those specific leads pre-selected.

---

## 10. File & Code Modifications Plan

1. **`manifest.json` & `scripts/build.js`**:
   - Add `https://web.whatsapp.com/*` to `host_permissions`.
   - Add build entry for `src/content-scripts/whatsapp-web/index.ts` (IIFE).
2. **`src/core/storage/db.ts`**:
   - Upgrade IndexedDB database version.
   - Create `whatsapp_outreach` and `outreach_templates` object stores with indices.
3. **`src/core/storage/whatsapp-outreach-repo.ts` [NEW]**:
   - CRUD functions for outreach records, deduplication query by phone, stats aggregation.
4. **`src/core/outreach/spintax.ts` [NEW]**:
   - Pure functions for Spintax parsing, variable substitution, and preview generation.
5. **`src/core/engine/whatsapp-orchestrator.ts` [NEW]**:
   - State machine for outreach runner: queue management, pause/resume/stop, throttling timers, message dispatch coordination.
6. **`src/content-scripts/whatsapp-web/index.ts` [NEW]**:
   - Content script on WhatsApp Web: dialog detection, input readiness, synthetic send event, status callbacks.
7. **`src/background/service-worker.ts`**:
   - Route `START_WHATSAPP_CAMPAIGN`, `PAUSE_WHATSAPP_CAMPAIGN`, `GET_WHATSAPP_HISTORY` messages.
   - Coordinate WhatsApp Web tab creation/reuse.
8. **`src/ui/dashboard/`**:
   - Add `tab-whatsapp-outreach` in `dashboard.html`.
   - Add Preact `WhatsAppOutreachPanel.tsx` component.
   - Wire table action button in `BusinessesTable.tsx`.
   - Add styles in `dashboard.css`.

---

## 11. Verification & Test Plan

1. **Unit Tests (`tests/unit/spintax.test.ts`)**:
   - Verify variable replacement handles null/undefined values gracefully.
   - Verify recursive spintax expansion parses multi-level braces `{A|{B|C}}`.
2. **Storage & Dedup Tests (`tests/unit/whatsapp-outreach-storage.test.ts`)**:
   - Verify that adding a phone number to `whatsapp_outreach` prevents it from appearing in subsequent campaign queues.
   - Verify "Force re-send" toggle overrides the skip filter correctly.
3. **Orchestration Mock Tests (`tests/unit/whatsapp-orchestrator.test.ts`)**:
   - Simulate runner processing items with mock tab messages.
   - Test pause, resume, emergency stop, and consecutive error tripwires.
4. **End-to-End Manual Verification**:
   - Open Google Maps, extract 5 leads.
   - Launch WhatsApp campaign in dashboard.
   - Verify WhatsApp Web tab opens, loads chat, sends spintax-resolved message, and logs record in dashboard.
