# Business Lead Extraction Tool — Product Requirements Document

**Document type:** Implementation-ready PRD
**Version:** 1.0 (V1 scope: Google Maps)
**Status:** Ready for engineering handoff
**Audience:** Engineering, design, QA, and AI coding agents implementing this system

---

## Table of Contents

1. Executive Summary
2. Product Vision
3. Goals
4. Non-Goals
5. Target Users
6. User Stories
7. Core User Journey
8. Google Maps Extraction Workflow
9. Functional Requirements
10. Data Model
11. Website Classification
12. Missing Data System
13. Duplicate Detection
14. Session Management
15. Export System
16. Responsible Automation
17. UI/UX Specification
18. Extension Popup
19. Extraction Dashboard
20. Business Data Table
21. Design System
22. State Management
23. Error Handling
24. Browser Extension Architecture
25. Platform Adapter Architecture
26. Storage Architecture
27. Security & Privacy
28. Performance
29. Accessibility
30. Internationalization
31. Project Structure
32. Data Flow
33. Testing Strategy
34. Acceptance Criteria
35. Non-Functional Requirements
36. Risks & Mitigations
37. Future Platform Architecture
38. Development Roadmap

---

## 1. Executive Summary

Business Lead Extraction Tool is a Manifest V3 Chromium browser extension that converts a Google Maps business search into a structured, exportable dataset. The user runs a normal Google Maps search, starts an extraction session from the extension, and the extension walks the resulting business list sequentially, opens each business's detail panel, extracts the publicly displayed fields, normalizes them into a fixed schema, classifies web presence (real website vs. social-only vs. none), flags missing data, deduplicates records, and persists everything locally in IndexedDB. The user can pause, resume, or stop at any time without losing data, and can export the session as CSV, JSON, or both.

The system is built as a **core, platform-agnostic extraction engine** with a **Google Maps adapter** as the only platform implementation in V1. All queueing, storage, deduplication, normalization contracts, session management, and export logic live in the core engine and have no knowledge of Google Maps DOM structure. This is the load-bearing architectural decision of the product: it is what allows a Yelp, Justdial, or other directory adapter to be added later by writing a new adapter module only.

The product deliberately excludes anything that resembles anti-detection or platform-security circumvention. It is designed to behave like a careful human user: one action at a time, conservative pacing, visible pauses on unexpected states, and an explicit stop the moment Google Maps presents a verification/challenge screen. This is a compliance boundary, not a suggestion — it constrains architecture (Section 16) and is tested for explicitly (Section 33).

The UI is designed as a dense, precise, enterprise data-tool interface — closer to a compliance dashboard or a database admin panel than a consumer app — with a restrained neutral color system, one accent color, and color-independent status communication throughout.

---

## 2. Product Vision

**What it is:** A local-first, single-user browser extension that turns a Google Maps search result into a clean, structured business dataset a person can immediately use in a CRM, spreadsheet, or outreach tool.

**What it is not:**
- Not a cloud SaaS platform with accounts, billing, or server-side scraping.
- Not a general-purpose web scraper — it works against a defined, adapter-based contract for specific supported platforms.
- Not an automation/bot framework for interacting with Google Maps beyond read-only data collection.
- Not a consumer productivity app — no gamification, no onboarding tours, no marketing chrome inside the tool itself.

**Core product bet:** Lead-generation work built on manually copying data out of Google Maps listings is slow and error-prone; a tool that does this reliably, transparently, and without violating the platform's trust model is valuable on its own, without needing multi-platform breadth on day one. Multi-platform breadth is an architectural requirement (so V1 doesn't have to be re-architected later), not a V1 feature requirement.

**Design ethos:** Every screen should look like it was built by a team shipping a data-operations tool for a paying business customer — dense information, precise states, and zero decorative filler. If a visual element does not help the user understand extraction state, categorize a record, or take an action, it does not belong in the product.

---

## 3. Goals

**Product goals**
- Extract structured business data from a live Google Maps search with no manual copy-paste.
- Guarantee that no already-extracted data is ever lost due to pause, stop, tab close, browser crash, or extension restart.
- Make missing data a visible, queryable, first-class property of every record rather than a silent gap.
- Produce exports that open correctly, with correct encoding and column structure, in Excel, Google Sheets, and LibreOffice on the first try.
- Ship an architecture where adding a second platform is a matter of writing one new adapter module, not touching the queue, storage, dedup, session, export, or UI layers.

**Engineering goals**
- Zero dependency on any runtime outside the browser (no Python, Node, Selenium, ChromeDriver, local server, or desktop companion app).
- Deterministic, testable normalization and classification logic, decoupled from live DOM access so it can be unit tested against fixtures.
- A extraction engine that never lets a single business's failure abort the session.
- A storage layer that scales to realistic session sizes (hundreds of records) without UI jank.

**Business goals**
- Be credibly positionable as a professional B2B data tool a sales team, agency, or freelancer would trust with real client work, not a hobby script wrapped in a UI.

---

## 4. Non-Goals

Explicitly out of scope for this PRD and for V1 engineering work:

- **No CAPTCHA/challenge bypass, fingerprint spoofing, stealth browser automation, proxy rotation, or any anti-detection mechanism.** If Google Maps presents a verification screen, the product's correct behavior is to stop and tell the user — never to work around it.
- **No headless/background scraping without an open, user-controlled tab.** Extraction only runs against a Google Maps tab the user has open and is aware of.
- **No cloud storage or account system in V1.** All data lives in the browser's local storage. There is no login, no server-side database, no telemetry of extracted business data.
- **No additional V1 platforms.** Yelp, Justdial, and others are architecture requirements (Section 25, 37), not V1 deliverables.
- **No CRM/email/outreach integrations in V1.** Export is CSV/JSON only; integrations are a post-V1 roadmap item (Section 38).
- **No scraping of data behind a login wall or data not publicly rendered on the page.** The tool only reads what Google Maps already displays to a signed-out or normal user.
- **No mobile browser support.** Chromium desktop only (Chrome, Edge, Brave, and other Manifest V3–compatible Chromium browsers).
- **No attempt to infer, guess, or fabricate field values.** If a field is not present on the page, it is recorded as missing — never estimated.

---

## 5. Target Users

| Persona | Who they are | Current workflow | Core pain point | What this product changes |
|---|---|---|---|---|
| **Lead-generation professional** | Runs outbound lead lists for clients or their own pipeline, often paid per verified lead | Manually opens dozens of Maps listings per city/niche, copies fields into a spreadsheet by hand | Extremely slow, error-prone copy-paste; inconsistent formatting between rows | Turns a 2–3 hour manual pass into an unattended, pausable extraction session with a clean, consistent schema |
| **Sales development rep (SDR) / sales team** | Builds territory or vertical-specific prospect lists before cold outreach | Uses Maps + LinkedIn manually, or pays for a third-party list broker | Bought lists are stale, generic, and not localized; manual research doesn't scale to quota | Fast, on-demand, localized list generation directly from live Maps data with website/no-website segmentation for messaging strategy |
| **Local-business researcher** | Studies competitive density, service gaps, or market saturation in a geography (e.g., "how many dentists in this city have no website") | Manually samples listings and tallies by hand or in a spreadsheet | Sampling bias, slow iteration across neighborhoods/categories | Full structured extraction of a search result set, with built-in website/social/no-presence segmentation as a first-class stat |
| **Marketing agency (web/SEO/ads)** | Prospects for clients who plausibly need a website, SEO, or ad management (frequently: businesses with no website or social-only presence) | Manually scans Maps for businesses that look like they lack a web presence | No reliable filter for "no website" at scale; manual detection of social-only presence is inconsistent | Website Status classification (`website` / `social_only` / `none`) becomes a direct, exportable targeting filter |
| **Freelancer (VA, researcher, list builder)** | Delivers lead lists or research as a paid service to multiple small clients | Spends billable hours on manual extraction, delivers inconsistent spreadsheets between clients | Time is the product being sold, but most of it is repetitive data entry | Consistent, professional CSV/JSON deliverables produced in a fraction of the time, freeing hours for actual client work |
| **Business-development / market-research team** | Needs geographic or vertical market maps of business presence, density, and category distribution | Manual sampling, purchased datasets that go stale quickly, or ad hoc scripts maintained by one engineer | Purchased data is expensive and non-refreshable; ad hoc scripts break silently and nobody maintains them | Self-serve, repeatable, on-demand extraction tied directly to whatever search Maps currently returns |

Common workflow shape across personas: **define a geography + category → run the search on Google Maps → extract everything that search returns → filter by missing data / website status → export → import into whatever tool consumes the list (CRM, spreadsheet, dialer).** The product's job is to make the middle two steps (extract, structure) fast, reliable, and trustworthy enough to hand off client work built on top of it.

---

## 6. User Stories

Organized by epic. Each is written as `As a <user>, I want <capability>, so that <outcome>.`

**Epic: Extraction control**
- As a lead-gen professional, I want to start extraction directly from a Google Maps search tab, so that I don't need to configure anything before running a job.
- As a sales rep, I want to pause extraction mid-session, so that I can manually inspect a business without losing my place in the queue.
- As a freelancer, I want to stop extraction early and still keep everything extracted so far, so that a change of plan doesn't cost me already-completed work.
- As any user, I want extraction to resume automatically from where it left off after I close and reopen the browser, so that long jobs survive normal browser usage.

**Epic: Data quality and trust**
- As an agency researcher, I want businesses with no phone number to show an empty, clearly-flagged phone field rather than a placeholder like "N/A", so that I can tell the difference between "extracted as empty" and "not yet processed."
- As a market researcher, I want to see, per record, exactly which fields are missing, so that I can decide whether a record is usable for my purpose.
- As a data buyer, I want duplicate businesses (returned twice by Maps due to scrolling/pagination behavior) collapsed into a single record, so that my exported counts are accurate.
- As an agency researcher, I want a business with only an Instagram link to be classified as `social_only`, not treated as having a website, so that my "no website" prospecting list isn't polluted.

**Epic: Export**
- As a freelancer, I want a CSV that opens correctly in Excel with correct encoding and no broken columns, so that I can hand it directly to a client without manual fixing.
- As a developer, I want a JSON export with clear session metadata (counts by status), so that I can pipe it into another tool without re-deriving summary statistics.

**Epic: Session continuity**
- As a user running a 200+ business extraction, I want to see 87/240 progress and have that persist even if the browser restarts, so that I don't have to start the job over.
- As a user, I want a clear signal when a saved session can be resumed vs. when it's stale/should be discarded, so that I don't accidentally resume a week-old job.

**Epic: Compliance and safety**
- As a user, I want extraction to pause automatically and tell me exactly why if Google Maps shows a verification screen, so that I never accidentally trigger platform enforcement against my account.
- As a user, I want a visible, honest processing rate (not artificially fast), so that I trust the tool is behaving like a careful, deliberate agent rather than a scraper bot.

**Epic: Multi-session / dataset management**
- As an agency running multiple client jobs, I want to view past sessions in a dashboard, so that I can re-export or review a completed job without re-running it.
- As any user, I want to filter the extracted business table by status, website presence, and missing fields, so that I can slice the dataset before export without leaving the extension.

---

## 7. Core User Journey

```
1. Install extension (Chrome Web Store)
2. Navigate to Google Maps, run a search
   e.g. "dental clinics in Bhubaneswar"
3. Click the extension icon
   Popup detects: Google Maps tab, active search, N businesses visible
4. Click "Start Extraction"
5. Extension builds the business queue from currently discoverable cards
   (and continues discovering more as the user's result list scrolls/loads)
6. Extension opens each business's detail panel in sequence, extracts fields,
   normalizes, classifies website status, checks for duplicates, saves record
7. Popup shows live progress: X / Y processed, success/partial/failed counts,
   website/social/no-website breakdown
8. User may pause at any time (e.g. to manually look at a listing) and resume
9. If Google Maps shows a verification/challenge screen, extraction
   auto-pauses and tells the user explicitly what happened and what to do
10. Extraction completes (queue exhausted) or user stops manually
11. User opens the review table (popup summary or full dashboard),
    filters by website status / missing fields / extraction status
12. User exports CSV, JSON, or both
13. Files are saved via the browser's normal download mechanism to the
    user's Downloads folder (or chosen folder, per browser download settings)
14. Session remains stored locally and browsable from the dashboard until
    the user clears it
```

At every step, the user should be able to answer, without guessing: *what platform is active, what search is running, how many were found, how many are done, what's happening right now, what failed and why, whether the tool is waiting on me, and where my export went.* This requirement recurs throughout Sections 17–22 as a concrete UI obligation, not a soft principle.

---

## 8. Google Maps Extraction Workflow

### 8.1 Stage-by-stage workflow

```
User opens Google Maps
        |
        v
User performs a search (category + location, e.g. "dental clinics Bhubaneswar")
        |
        v
Content script detects a Maps search-results page
        |
        v
Adapter scans the results panel DOM and discovers business card elements
        |
        v
Core engine builds an ordered Business Queue (one entry per discovered card,
deduplicated at discovery time by DOM position + name+address fingerprint)
        |
        v
User clicks "Start Extraction" in the popup
        |
        v
Engine takes the next QUEUED item -> marks it PROCESSING
        |
        v
Adapter opens that business's detail panel
   (click the card, or navigate the panel's internal state — see 8.4)
        |
        v
Adapter waits for the detail panel to reach a stable, extractable state
        |
        v
Adapter extracts all supported fields from the detail panel DOM
        |
        v
Core engine normalizes raw extracted values into the canonical schema (Section 10)
        |
        v
Core engine runs Website Classification (Section 11)
        |
        v
Core engine computes Missing Fields (Section 12)
        |
        v
Core engine runs Duplicate Detection against already-saved records (Section 13)
        |
        v
   duplicate? --yes--> mark DUPLICATE, optionally merge missing fields into
        |                original, do not create a new primary record
        no
        |
        v
Record persisted to IndexedDB, status set to COMPLETE or PARTIAL
        |
        v
Engine advances to next QUEUED item (conservative delay + jitter, Section 16)
        |
        v
   queue exhausted? --no--> repeat from "take next queued item"
        |
       yes
        |
        v
Session status set to COMPLETED, popup/dashboard updated
        |
        v
User reviews table, filters, exports CSV / JSON
```

### 8.2 What "discovering business cards" means concretely

Google Maps renders search results as a scrollable feed of business cards inside a results panel (a `role="feed"` container in the left panel during a category/keyword search). The adapter:

1. Queries the results panel for card elements using a resilient selector strategy (Section 25.3 — attribute- and structure-based selectors with fallbacks, not brittle single class names, since Google Maps class names are obfuscated and unstable).
2. Extracts, per card, only what's needed to enqueue it: a stable-enough reference (DOM node reference for the live session, plus name + address fingerprint as a fallback identifier), and whatever preview fields are visible on the card itself (name, rating, review count, category, and sometimes address) so the queue UI can show something immediately even before the detail panel is opened.
3. Adds new cards to the queue as they appear. It does not require the user to manually scroll — the adapter incrementally scrolls the results feed itself, at the same conservative pace as detail-panel navigation, and stops scrolling once no new cards appear after N consecutive scroll attempts (configurable, default 3) or once the configured "maximum businesses to process" limit (Section 14) is reached.

### 8.3 Infinite scroll / dynamic loading

Google Maps' results feed loads more cards as it's scrolled, and does not expose a total-count value up front. The adapter treats total business count as **provisional and increasing** until scrolling stops producing new cards. The UI reflects this explicitly:

- While discovery is still adding cards: progress reads `87 / 127+` (a trailing `+` denotes an estimate still growing) rather than a falsely-precise fixed denominator.
- Once three consecutive scroll attempts produce zero new cards, the denominator is finalized and the `+` is dropped.
- If the user has set a maximum businesses limit lower than the eventual total, discovery stops early at that limit intentionally, and the UI states this ("Stopped at configured limit of 100").

### 8.4 Opening the business detail panel

Two situations, both supported:

- **List view → detail view navigation**: clicking a business card in the results feed replaces (or opens alongside, depending on Maps' current layout) the results list with a detail panel for that business. The adapter simulates this via a genuine `click()` dispatch on the card element — no synthetic network requests, no calling internal Maps JS APIs directly.
- **Returning to the list**: after extraction, the adapter must navigate back to the results feed to process the next card. It does this via Maps' own "Back" control (the panel's back arrow) rather than `history.back()`, because Maps' internal state management does not always align cleanly with browser history entries. `history.back()` is used only as a documented fallback if the back control cannot be located, with a stricter post-navigation state check.

### 8.5 Detail panel dynamic content

The detail panel loads sections asynchronously (hours, reviews, attributes can lag behind the header). The adapter does not extract on a fixed timer. It uses a **stability check**: poll the panel's key anchor elements (name heading, address block) at a short interval (default 400 ms) until two consecutive polls return identical content, or until a maximum wait (default 6 seconds) is reached. If the maximum wait is hit without stability, the adapter extracts whatever is present and marks any field it could not confirm as present in `error_fields` (not `missing_fields` — see Section 12.3 for the distinction) with status `PARTIAL`.

### 8.6 Edge cases (explicit handling)

| Edge case | Required behavior |
|---|---|
| Search results load dynamically / lazily | Treated as provisional discovery (8.3); queue grows as cards appear |
| Infinite scroll needed to reveal more cards | Adapter scrolls the results feed itself at conservative pace; stops per 8.3 rules |
| Detail panel changes structure mid-extraction (Maps ships a UI update) | Selector strategy uses layered fallbacks (Section 25.3); if all fallbacks fail for a required field, that field is added to `error_fields`, not fabricated; if the panel is unrecognizable as a business detail panel at all, the business is marked `FAILED` with `error_fields: ["panel_unrecognized"]` and the engine moves on |
| Missing fields (no phone, no hours, no rating, etc.) | Recorded as empty string / null / empty array per field type, added to `missing_fields`; extraction status is `COMPLETE` if only optional fields are missing, `PARTIAL` if the business defines a field as present but extraction couldn't confirm its value (see 8.5) |
| Business has no website | `website: ""`, `website_status: "none"` unless social links are found (then `"social_only"`) |
| Business has only social links (Instagram/Facebook/etc.) | `website_status: "social_only"`, all discovered social URLs placed in `social_links`, `website` remains `""` — see Section 11 |
| Closed business (permanently closed) | `business_status: "closed_permanently"`; extraction still proceeds for all other available fields; **not** treated as an error |
| Temporarily closed / temporarily unavailable | `business_status: "temporarily_closed"`; same as above — extraction continues normally |
| Duplicate business (same business appears twice in the result set, common after scroll-position shifts) | Detected per Section 13 identifier chain; second occurrence marked `DUPLICATE`, not exported as a separate row by default |
| Extraction failure on a single business | Recorded as `FAILED` with populated `error_fields`; engine logs the failure and **continues to the next queued item** — one failure never halts the session |
| User navigates the Maps tab away from the search/detail context manually while extraction is running | Engine detects the URL/DOM context no longer matches an expected Maps state, auto-pauses, and surfaces "Extraction paused — the Google Maps tab navigated away from the expected page. Return to the search results to resume." |
| User manually interacts with the page during extraction (e.g. clicks a different business) | Same handling as above: the engine detects the mismatch between expected and actual panel content on its next stability check and pauses rather than extracting the wrong business under the wrong queue slot |
| Google Maps ships a UI/DOM structure change | Layered selector fallback strategy (25.3) absorbs minor changes; if the adapter's page-structure fingerprint check fails entirely, the session pauses with an explicit "Unexpected page structure" state (Section 31) rather than silently extracting garbage |
| Verification / challenge screen (e.g. "unusual traffic" / CAPTCHA-style interstitial) | Detected via the adapter's `detectVerification()` check (Section 25); extraction **stops immediately**, session status becomes `PAUSED` with reason `verification_required`, and the UI instructs the user to resolve it manually in the tab before resuming — engine never attempts to interact with the challenge in any way |
| Network instability (page fails to load a panel, request stalls) | Treated as a retryable error (Section 23); one retry with backoff, then `FAILED` with `error_fields: ["network_timeout"]` if the retry also fails |
| Extension restarted (e.g. Chrome updates/reloads the extension) | Service worker reloads active session state from IndexedDB on wake; popup shows "Resume available session?" rather than auto-resuming (Section 14.4) |
| Browser restarted | Same as above — session state is durable in IndexedDB independent of the service worker's lifecycle; resuming requires the user to have the relevant Maps search open again, since content-script/tab context does not survive a browser restart |

---

## 9. Functional Requirements

Numbered, testable requirements. Each maps to acceptance criteria in Section 34.

| ID | Requirement |
|---|---|
| FR-1 | The extension shall detect when the active tab is a Google Maps search-results page and reflect this in the popup within 1 second of the popup opening. |
| FR-2 | The extension shall discover business cards from the current search results and construct an ordered queue without requiring manual user scrolling. |
| FR-3 | The user shall be able to start extraction only when at least one business has been discovered. |
| FR-4 | The engine shall process exactly one business at a time (no concurrent detail-panel operations). |
| FR-5 | The engine shall extract all fields defined in Section 10 that are present on the detail panel, and shall never fabricate a value for a field that is absent. |
| FR-6 | The engine shall classify website presence per the rules in Section 11 for every processed business. |
| FR-7 | The engine shall compute and persist `missing_fields` for every processed business per Section 12. |
| FR-8 | The engine shall run duplicate detection against previously saved records in the current session before persisting a new record. |
| FR-9 | The user shall be able to pause extraction at any point; pausing shall take effect after the current business finishes processing (no mid-extraction interruption of a single business). |
| FR-10 | The user shall be able to resume a paused session, continuing from the next unprocessed queue item. |
| FR-11 | The user shall be able to stop extraction; stopping preserves all records already saved and marks the session `STOPPED` rather than discarding data. |
| FR-12 | The user shall be able to retry only the businesses currently marked `FAILED` without reprocessing successful records. |
| FR-13 | The user shall be able to export the current session as CSV, JSON, or both, at any time — including mid-extraction (exporting a snapshot of progress so far). |
| FR-14 | The extension shall detect a verification/challenge state and pause extraction automatically, without any attempt to resolve it. |
| FR-15 | Session state (queue, processed records, failed records, settings snapshot) shall be persisted such that a browser or extension restart does not lose progress. |
| FR-16 | The dashboard business table shall support sorting, text search, status filtering, website-status filtering, and missing-field filtering, applied client-side against the current session's stored records. |
| FR-17 | The extension shall function immediately after installation with no configuration, external account, or additional software required. |

---

## 10. Data Model

### 10.1 Canonical business record schema

| Field | Type | Classification | Notes |
|---|---|---|---|
| `record_id` | `string` (UUID v4) | Derived | Internal identifier, generated at extraction time; not platform data |
| `business_name` | `string` | Required | Primary listing name as displayed |
| `primary_category` | `string` | Required | First/primary category shown on the listing |
| `secondary_categories` | `string[]` | Optional | Additional categories, when Maps displays more than one |
| `rating` | `number \| null` | Optional | e.g. `4.3`; `null` if no rating shown (a business with zero reviews has no rating, distinct from a `0` rating, which does not occur on Maps) |
| `review_count` | `integer \| null` | Optional | `null` if not shown; `0` is a valid, distinct value from `null` |
| `price_level` | `"$" \| "$$" \| "$$$" \| "$$$$" \| null` | Optional | Only present when Maps displays a price indicator |
| `address` | `string` | Required (best-effort) | Full formatted address as displayed |
| `phone` | `string` | Optional | Normalized to E.164 where a country context is confidently inferable, otherwise stored as displayed with whitespace normalized |
| `website` | `string` (URL) | Optional / Derived | Empty string if `website_status` is `social_only` or `none` — see Section 11 |
| `website_status` | `"website" \| "social_only" \| "none"` | Derived | See Section 11 |
| `social_links` | `string[]` | Optional / Derived | Populated only when social profile URLs are present |
| `maps_url` | `string` (URL) | Required | Platform-specific | Canonical Google Maps URL for the listing |
| `place_identifier` | `string \| null` | Derived | Platform-specific | Internal dedup key extracted from the Maps URL/DOM (Section 13.2); not included in default export, available via export settings |
| `plus_code` | `string \| null` | Optional | Platform-specific | Google's Plus Code, when displayed |
| `latitude` | `number \| null` | Derived | Parsed from the canonical Maps URL or embedded map data |
| `longitude` | `number \| null` | Derived | Same source as latitude |
| `opening_hours` | `{ day: string; hours: string }[] \| null` | Optional | `null` if hours are not displayed at all; an empty array is not used — either hours exist (array with 1–7 entries) or the field is `null` |
| `business_status` | `"operational" \| "closed_temporarily" \| "closed_permanently" \| "unknown"` | Optional / Derived | `"unknown"` only if Maps shows no status indicator at all (default assumption is `"operational"` when the listing renders normally with no closure banner) |
| `description` | `string \| null` | Optional | Editorial description snippet, when present |
| `service_options` | `string[]` | Optional | Platform-specific | e.g. `["Dine-in", "Takeout", "Delivery"]`, when shown |
| `attributes` | `string[]` | Optional | Platform-specific | e.g. `["Wheelchair accessible entrance", "Free Wi-Fi"]`, when shown |
| `extraction_status` | `"complete" \| "partial" \| "failed" \| "skipped" \| "duplicate"` | Derived | See Section 20 |
| `extraction_timestamp` | `string` (ISO 8601, UTC) | Derived | Set when the record is persisted |
| `missing_fields` | `string[]` | Derived | Field names confirmed absent from the source page — see Section 12 |
| `error_fields` | `string[]` | Derived | Field names that could not be confirmed due to an extraction error (distinct from confirmed-absent — Section 12.3) |
| `source_platform` | `"google_maps"` | Required / Platform-specific | Constant in V1; becomes meaningful once additional adapters exist |
| `duplicate_of` | `string \| null` | Derived | Set only on records marked `duplicate`; references the `record_id` of the retained original |

### 10.2 Example record (JSON)

```json
{
  "record_id": "6f1c2a9e-2b41-4b9e-8b3e-2d9a7cbb2e10",
  "business_name": "Bhubaneswar Smile Dental Clinic",
  "primary_category": "Dental clinic",
  "secondary_categories": ["Cosmetic dentist"],
  "rating": 4.6,
  "review_count": 212,
  "price_level": null,
  "address": "Plot 14, Jaydev Vihar, Bhubaneswar, Odisha 751013",
  "phone": "+91 90XX XXXXXX",
  "website": "",
  "website_status": "social_only",
  "social_links": ["https://instagram.com/smiledentalbbsr"],
  "maps_url": "https://www.google.com/maps/place/Bhubaneswar+Smile+Dental+Clinic/@20.296,85.824,17z/...",
  "place_identifier": "0x3a1909f3c1e2a1a3:0x7b2c9e1f4d3a8b60",
  "plus_code": "7MJP+3C Bhubaneswar",
  "latitude": 20.296,
  "longitude": 85.824,
  "opening_hours": [
    { "day": "Monday", "hours": "10:00 AM – 8:00 PM" },
    { "day": "Tuesday", "hours": "10:00 AM – 8:00 PM" }
  ],
  "business_status": "operational",
  "description": null,
  "service_options": [],
  "attributes": ["Wheelchair accessible entrance"],
  "extraction_status": "complete",
  "extraction_timestamp": "2026-09-09T06:12:41.204Z",
  "missing_fields": ["price_level", "description"],
  "error_fields": [],
  "source_platform": "google_maps",
  "duplicate_of": null
}
```

### 10.3 Field classification summary

- **Required**: `business_name`, `primary_category`, `address`, `maps_url`, `source_platform` — extraction is considered failed (not merely partial) if any of these cannot be obtained, since without them the record has no reliable business identity.
- **Optional**: everything that Google Maps may or may not display depending on the listing (`rating`, `review_count`, `price_level`, `phone`, `website`, `social_links`, `plus_code`, `opening_hours`, `description`, `service_options`, `attributes`).
- **Derived**: computed by the engine rather than copied directly from the page (`website_status`, `place_identifier`, `latitude`/`longitude`, `extraction_status`, `extraction_timestamp`, `missing_fields`, `error_fields`, `duplicate_of`, `record_id`).
- **Platform-specific**: fields whose meaning or presence is tied to how Google Maps specifically models data (`maps_url`, `place_identifier`, `plus_code`, `service_options`, `attributes`, `source_platform`). A future adapter is not obligated to populate fields that don't apply to its platform (e.g. Yelp has no Plus Code); it leaves them `null`/empty and they appear in `missing_fields` only if the core schema marks them expected for that platform (Section 26.4 addresses adapter-declared schema subsets).

---

## 11. Website Classification

### 11.1 Purpose

Sales and marketing use cases depend on correctly distinguishing "this business has a real website" from "this business only has a social media presence." Treating an Instagram link as a website would corrupt exactly the segment (no-website prospects) that agencies and freelancers most want to target. This classification must be deterministic and centrally defined, not left to ad hoc string checks scattered across the codebase.

### 11.2 Output contract

```json
// Real website
{ "website": "https://example.com", "website_status": "website", "social_links": [] }

// Social-only presence
{ "website": "", "website_status": "social_only", "social_links": ["https://instagram.com/example"] }

// No web presence of any kind
{ "website": "", "website_status": "none", "social_links": [] }
```

### 11.3 Classification algorithm

1. Collect every outbound URL the detail panel exposes as a "website"-type link (Maps typically renders exactly one "Website" button, but the classifier is written to handle any URL found in that slot, plus any additional profile links Maps surfaces separately).
2. Normalize each URL (Section 13.3 URL normalization rules — lowercase host, strip default ports, strip tracking query parameters, strip trailing slash).
3. Check the normalized host against a maintained **social/aggregator domain list** (data, not scattered logic — see 11.4).
4. If the host matches the social/aggregator list: the URL goes into `social_links`, `website` stays `""`.
5. If the host does not match the list and the URL is a syntactically valid absolute HTTP(S) URL: it is treated as the real website; `website_status = "website"`.
6. If no website-slot URL exists at all, but one or more social profile links are discoverable elsewhere on the panel (Maps sometimes exposes social icons separately from the main website button): `website_status = "social_only"`, populate `social_links`.
7. If neither exists: `website_status = "none"`.

This order matters: a business can have **both** a website-slot URL that happens to be a social profile **and** no other links — step 4 correctly reclassifies that case as `social_only` rather than `website`, which a naive "is there a URL in the website field" check would get wrong.

### 11.4 Social/aggregator domain list (data-driven, not hardcoded logic)

Maintained as a static, versioned config module so it can be updated without touching classifier logic:

```ts
// src/core/classification/social-domains.ts
export const SOCIAL_DOMAINS: readonly string[] = [
  "facebook.com", "instagram.com", "twitter.com", "x.com",
  "linkedin.com", "tiktok.com", "youtube.com", "youtu.be",
  "pinterest.com", "threads.net", "wa.me", "whatsapp.com",
  "snapchat.com", "telegram.me", "t.me",
];

// Link-in-bio aggregators are classified as social_only as well —
// they are not a business's own website, they are a social presence hub.
export const AGGREGATOR_DOMAINS: readonly string[] = [
  "linktr.ee", "beacons.ai", "bio.link", "linkin.bio", "campsite.bio",
];
```

`social_only` is set whenever the matched host is in either list. Keeping the two lists separate (rather than merging them) is intentional: a future version may want to report aggregator usage as a distinct sub-signal without changing the exported `website_status` contract — this is a documented extension point, not a V1 requirement.

### 11.5 Edge cases

| Case | Resolution |
|---|---|
| Website URL is a Google-owned redirect wrapper (Maps sometimes wraps outbound links) | Classifier resolves to the final target host for comparison purposes without following the redirect over the network — Maps exposes the true target host in the link's own attributes/text in the vast majority of cases; if only a redirect wrapper is available with no visible target, the raw wrapper URL is stored and flagged in `error_fields: ["website_unresolved_redirect"]` rather than guessed |
| Business links to a Facebook Page used *as* their primary web presence | Still `social_only` — a Facebook Page is not the business's own website regardless of how complete it is |
| Business has a website that itself lives on a social-adjacent platform (e.g. a Linktree-style page that is genuinely their storefront) | Aggregator domains are always `social_only` per 11.4 — this is a deliberate simplification documented here so it isn't "rediscovered" as a bug later |
| No URL found at all, but a phone-only listing with a WhatsApp click-to-chat link | `wa.me` is in the social domain list, so this is `social_only`, not `website` |
| Multiple real (non-social) links found | Not expected from a single Maps listing (Maps exposes one website slot); if an adapter update surfaces more than one, the first is used as `website` and the rest are logged to `error_fields: ["multiple_website_candidates"]` for review rather than silently dropped |

---

## 12. Missing Data System

### 12.1 Purpose

A missing field is meaningful business intelligence (e.g., "no phone listed" is itself a data point), not a defect to be hidden. Missing data must be represented consistently and losslessly across every layer of the system.

### 12.2 Representation rules by layer

| Layer | Representation |
|---|---|
| Internal record (IndexedDB) | Missing string fields: `""`. Missing numeric fields: `null`. Missing array fields: `[]`. Never a placeholder string. |
| `missing_fields` array | Contains the exact schema field name (e.g. `"phone"`, `"website"`, `"rating"`) for every field confirmed absent on the source page. |
| Dashboard table | Empty cell rendered with a subtle warning treatment (Section 9/20) — a thin left border in the warning-red tint plus a small "missing" glyph in the cell, never color alone (Section 27). |
| CSV export | Empty cell (`,,`) by default. A settings toggle allows the user to substitute a literal token (default off) — see 12.4. |
| JSON export | `""` / `null` / `[]` per the same rules as the internal record — JSON export is a direct, faithful serialization of the canonical record, not a display transform. |
| Statistics (popup/dashboard counters) | Missing-field counts are aggregated per field across the session (e.g. "38 records missing phone") and surfaced in the Website Analysis / Missing Data views (Sections 18–19). |

### 12.3 Missing vs. error — an important distinction

- **Missing (`missing_fields`)**: the engine successfully loaded and read the relevant part of the page, and the field is confirmed not present (e.g., the listing genuinely has no phone number displayed).
- **Error (`error_fields`)**: the engine could not confirm the field's state at all — a selector failed, the panel didn't stabilize in time, or a required DOM region didn't render. This is a data-collection failure, not a fact about the business, and is treated differently: it can trigger a retry (Section 23), while a confirmed-missing field never does (there is nothing to retry — the business simply doesn't have that field).

This distinction is enforced in code by having two separate normalizer outputs (`missing` and `unconfirmed`) that are never merged into one array before persistence.

### 12.4 Export-format missing-value setting

Default: empty cell / `""` / `null` as specified above. The export settings panel (Section 14) exposes one toggle: **"Represent missing values as:"** with options `Empty` (default) and `Custom placeholder` (free-text input, e.g. user types `N/A`). This is the *only* place a placeholder string is ever introduced, and it is applied strictly at export-serialization time — the underlying stored record is never mutated to hold a placeholder.

---

## 13. Duplicate Detection

### 13.1 Purpose

Google Maps' scrollable feed can surface the same business twice (scroll position drift, ads/promoted repeats, or the same business appearing under two nearby searches within one session). Exporting duplicates undermines list quality and, for paid lead lists, directly costs the user money (duplicate = paid-for-twice).

### 13.2 Identifier priority chain

Checked in order; the first identifier both records share is used as the match:

1. **Platform place identifier** — extracted from the canonical Maps URL. Google Maps place URLs embed a stable hex pair (commonly of the form `0x<hex>:0x<hex>`) inside the `data=` URL parameter or the `!1s...` segment; the adapter extracts this pair via a documented parsing routine (Section 25.3) rather than treating the whole URL as opaque.
2. **Canonical business URL** — the normalized `website` value, when `website_status === "website"` for both records (social/aggregator links are explicitly excluded from this check, since many unrelated businesses can share the same platform-provided social handle format).
3. **Canonical Maps URL** — the normalized `maps_url` (see 13.3) when a place identifier could not be extracted.
4. **Name + address** — normalized business name plus normalized address.
5. **Name + phone** — normalized business name plus normalized phone, used as a last resort when address text differs slightly between two appearances of the same business (e.g. suite number present in one, absent in the other).

If none of the five match, the records are treated as distinct businesses, even if they seem similar — the system never guesses a duplicate off a single weak partial-text similarity heuristic, to avoid incorrectly collapsing two different businesses with generically similar names (a real risk with common business names like "City Dental Clinic").

### 13.3 Normalization requirements

```ts
// src/core/dedup/normalize.ts

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")   // strip punctuation, keep unicode letters/numbers
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddress(address: string): string {
  const abbreviations: Record<string, string> = {
    "st": "street", "rd": "road", "ave": "avenue", "blvd": "boulevard",
    "ln": "lane", "dr": "drive", "apt": "apartment", "fl": "floor",
  };
  let out = address.normalize("NFKC").toLowerCase().replace(/[.,]/g, "");
  out = out.replace(/\b(\w+)\b/g, (w) => abbreviations[w] ?? w);
  return out.replace(/\s+/g, " ").trim();
}

export function normalizePhone(phone: string, defaultCountry = "IN"): string {
  const digits = phone.replace(/[^\d+]/g, "");
  // E.164-style normalization; falls back to digits-only if country
  // context cannot be confidently inferred (no assumption is made
  // silently — see adapter-level country hint in Section 25).
  return digits.startsWith("+") ? digits : `+${countryCallingCode(defaultCountry)}${digits.replace(/^0+/, "")}`;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    u.search = "";
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
```

- **Case normalization**: all comparisons are case-insensitive after lowercasing.
- **Whitespace normalization**: collapse repeated whitespace, trim edges, before any comparison.
- **Phone normalization**: digits-only comparison after best-effort E.164 formatting; a phone match never crosses country-code ambiguity silently — if country cannot be inferred, digit-suffix matching (last 8–10 digits) is used instead of a full E.164 compare, to avoid false negatives from missing country codes.
- **URL normalization**: strip protocol, `www.`, query string, hash, and trailing slash before comparing hosts + paths.
- **Address normalization**: lowercase, strip punctuation, expand common abbreviations via a maintained lookup table (extensible, not hardcoded inline at each call site).

### 13.4 What happens when a duplicate is detected

1. The new (later-discovered) record is **not** inserted as a separate primary record.
2. A **fill-gaps merge** is applied: any field that is empty/null/`[]` on the original record and non-empty on the duplicate is copied onto the original. Fields already populated on the original are never overwritten (the first-seen value wins on conflict — this is a documented, deterministic policy, not silent overwriting).
3. The original's `missing_fields` is recomputed after the merge.
4. The duplicate occurrence is logged (count + timestamp) on the original record for transparency, and a `DUPLICATE`-status shadow entry is kept in storage (for audit/debugging) but is **excluded from CSV/JSON export by default**. An export setting ("Include duplicate records") allows including them explicitly, tagged with `duplicate_of` pointing at the retained record.

---

## 14. Session Management

### 14.1 Purpose

Extraction jobs can run long (hundreds of businesses) and must survive normal interruptions: closing a tab, closing the browser, an extension reload after a Chrome update. Session state is the durable source of truth, independent of the service worker's ephemeral lifecycle.

### 14.2 Session state shape

```ts
interface ExtractionSession {
  sessionId: string;               // UUID v4
  platform: "google_maps";
  sourceUrl: string;                // the Maps search URL at session start
  searchContext: {
    query: string | null;           // parsed search box text, when available
    locationHint: string | null;
  };
  status: "idle" | "detecting" | "queued" | "running" | "paused" | "completed" | "stopped" | "failed";
  pauseReason: "user" | "verification_required" | "unexpected_page_state" | "error_threshold" | null;
  createdAt: string;                // ISO 8601
  updatedAt: string;
  queue: QueueItem[];               // ordered; see 14.3
  processedCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  duplicateCount: number;
  settingsSnapshot: ExtractionSettings;   // Section 14 settings, frozen at session start
}

interface QueueItem {
  queueId: string;
  discoveryIndex: number;           // order discovered, stable sort key
  status: "queued" | "processing" | "complete" | "partial" | "failed" | "skipped" | "duplicate";
  recordId: string | null;          // set once a business_records entry exists
  retryCount: number;
  lastError: string | null;
  cardFingerprint: string;          // name+address hash, fallback identifier if DOM ref is gone
}
```

### 14.3 Storage technology and rationale

**IndexedDB** is the primary store for session state, the queue, and all business records.

- Sessions and records are structured, relational-ish data (a session has many queue items; queue items reference records) that benefit from IndexedDB's object stores + indexes, rather than being serialized as one JSON blob.
- IndexedDB has no practical size ceiling comparable to `chrome.storage.local`'s default quota, which matters once a session reaches hundreds of records with full field sets.
- IndexedDB supports indexed lookups (e.g. by `place_identifier`, by normalized name+address) needed for O(log n) duplicate-detection queries instead of a linear scan per new record as the session grows.
- IndexedDB transactions provide atomicity for the "write record + update queue item + update session counters" operation, preventing partial-write corruption if the service worker is terminated mid-write.

**`chrome.storage.local`** is used only for small, simple, non-relational data: user settings/preferences (Section 14 below) and a lightweight pointer (`{ activeSessionId }`) so the popup can cheaply check "is there an active session" without opening an IndexedDB connection on every popup open.

### 14.4 Recovery flow (not silent auto-resume)

1. On service worker startup (extension install/update/reload, or browser start), the worker reads `chrome.storage.local` for `activeSessionId`.
2. If present, it loads the session summary from IndexedDB.
3. It does **not** automatically resume extraction — tab/content-script context from before the restart no longer exists.
4. The next time the popup opens on a matching Google Maps tab (same `sourceUrl` origin/search context), it surfaces: *"A previous session for this search is 87/240 complete. Resume or start a new session?"*
5. If the user's current Maps tab context doesn't match any recoverable session, the popup instead shows the session as browsable history in the dashboard (Section 19) without offering inline resume.
6. A session older than a configurable staleness window (default 14 days) is visually marked "stale" in the dashboard and requires explicit confirmation before resuming, since the underlying Maps listings may have changed.

---

## 15. Export System

### 15.1 CSV specification

- **Encoding**: UTF-8 with a leading BOM (`\uFEFF`). The BOM is required for Excel on Windows to reliably auto-detect UTF-8; Google Sheets and LibreOffice both handle the BOM transparently, so a single file format serves all three targets without per-tool variants.
- **Line endings**: CRLF (`\r\n`) per RFC 4180, for maximum compatibility with Excel.
- **Field escaping**: any field containing a comma, double quote, or line break is wrapped in double quotes; internal double quotes are escaped by doubling (`"` → `""`). Fields with no special characters are left unquoted (smaller file size, still fully RFC 4180–valid).
- **Array fields** (`secondary_categories`, `social_links`, `service_options`, `attributes`, `missing_fields`, `error_fields`) are serialized as a single cell with `; ` (semicolon-space) as the internal delimiter, so they never collide with the CSV's own comma delimiter.
- **Empty cells**: per Section 12, empty by default; optionally a user-configured placeholder token.
- **Timestamps**: ISO 8601 UTC (`2026-09-09T06:12:41.204Z`) in the raw export for unambiguous machine parsing; the dashboard preview separately renders a locale-formatted version for human readability, but the exported value itself is never locale-dependent.

**Exact column order:**

```
extraction_status, business_name, primary_category, secondary_categories,
rating, review_count, price_level, phone, website, website_status,
social_links, address, latitude, longitude, plus_code, maps_url,
business_status, opening_hours, description, service_options, attributes,
missing_fields, error_fields, extraction_timestamp, source_platform
```

`record_id`, `place_identifier`, and `duplicate_of` are omitted from the default CSV (they are internal/debug fields) but can be included via an export-settings checkbox ("Include internal identifiers") for users who want to cross-reference exports against the JSON output or re-import into their own systems.

**CSV escaping implementation:**

```ts
// src/core/export/csv.ts
function escapeCsvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function serializeArrayField(values: string[]): string {
  return values.join("; ");
}

export function toCsv(records: BusinessRecord[], columns: string[], missingToken = ""): string {
  const header = columns.join(",");
  const rows = records.map((r) =>
    columns
      .map((col) => {
        const raw = getField(r, col);           // handles arrays vs scalars vs null
        const display = raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0)
          ? missingToken
          : Array.isArray(raw)
          ? serializeArrayField(raw)
          : String(raw);
        return escapeCsvField(display);
      })
      .join(",")
  );
  return "\uFEFF" + [header, ...rows].join("\r\n");
}
```

### 15.2 JSON export specification

```json
{
  "export_metadata": {
    "export_timestamp": "2026-09-09T06:20:11.532Z",
    "source_platform": "google_maps",
    "search_context": {
      "query": "dental clinics in Bhubaneswar",
      "source_url": "https://www.google.com/maps/search/dental+clinics+bhubaneswar/"
    },
    "total_records": 127,
    "successful_records": 81,
    "partial_records": 4,
    "failed_records": 2,
    "duplicate_records_excluded": 5,
    "tool_version": "1.0.0"
  },
  "businesses": [
    {
      "record_id": "6f1c2a9e-2b41-4b9e-8b3e-2d9a7cbb2e10",
      "business_name": "Bhubaneswar Smile Dental Clinic",
      "primary_category": "Dental clinic",
      "secondary_categories": ["Cosmetic dentist"],
      "rating": 4.6,
      "review_count": 212,
      "price_level": null,
      "address": "Plot 14, Jaydev Vihar, Bhubaneswar, Odisha 751013",
      "phone": "+91 90XX XXXXXX",
      "website": "",
      "website_status": "social_only",
      "social_links": ["https://instagram.com/smiledentalbbsr"],
      "maps_url": "https://www.google.com/maps/place/Bhubaneswar+Smile+Dental+Clinic/@20.296,85.824,17z/...",
      "plus_code": "7MJP+3C Bhubaneswar",
      "latitude": 20.296,
      "longitude": 85.824,
      "opening_hours": [{ "day": "Monday", "hours": "10:00 AM – 8:00 PM" }],
      "business_status": "operational",
      "description": null,
      "service_options": [],
      "attributes": ["Wheelchair accessible entrance"],
      "extraction_status": "complete",
      "extraction_timestamp": "2026-09-09T06:12:41.204Z",
      "missing_fields": ["price_level", "description"],
      "error_fields": [],
      "source_platform": "google_maps"
    }
  ]
}
```

JSON export is a faithful, complete serialization of the canonical record — no display-layer transforms, no placeholder substitution (the missing-value placeholder setting, Section 12.4, applies to CSV only; JSON consumers are expected to be programmatic and should receive unambiguous `""`/`null`/`[]`).

### 15.3 Export controls

- **Export CSV**, **Export JSON**, **Export CSV + JSON** (produces both files in one action) are available from both the popup and the dashboard.
- Exporting is non-destructive and repeatable — it can be run again at any time against the current state of the session, including mid-extraction (producing a snapshot of progress so far) or after completion.
- File naming: `business-leads_{sanitized-search-query}_{yyyyMMdd-HHmm}.csv` / `.json`, generated client-side and handed to `chrome.downloads.download()`.

---

## 16. Responsible Automation

### 16.1 Principles

The extraction engine behaves like a deliberate, singular human user reading listings one at a time — never like a high-throughput bot. This is enforced structurally, not left to a configurable-but-defaults-to-fast setting:

- **User-initiated only.** Extraction never starts without an explicit "Start Extraction" click. There is no scheduled/background extraction in V1.
- **Sequential processing.** Exactly one business open/extracted at a time; no parallel tabs, no parallel panel requests.
- **Conservative, jittered timing.** Default delay between finishing one business and opening the next: **3.5–6 seconds**, randomized within that band (uniform jitter) rather than a fixed interval, to avoid a mechanically regular cadence. This range is a configurable setting (Section 14) with an enforced floor of 2.5 seconds — the UI does not allow configuring a faster floor, by design.
- **Exponential backoff after errors.** After a failed extraction attempt: wait `base_delay * 2^retry_count` (base 4s, capped at 60s) before the retry, and after 3 consecutive failures across different businesses, auto-pause the whole session with reason `error_threshold` rather than continuing to hammer a possibly-degraded page state.
- **Abnormal page-state detection.** Every stage checks that the DOM matches an expected shape before proceeding (Section 8.5, 25.3); mismatches pause rather than force through.
- **Verification/challenge detection → hard stop.** Described fully in 16.2.
- **User intervention, then resume.** Whenever the engine pauses for a reason requiring the user to act on the actual page (verification, unexpected navigation, unexpected structure), resuming is a manual action the user takes only after they've addressed the underlying page state.

### 16.2 Verification/challenge detection

```ts
// src/adapters/google-maps/verification.ts
export function detectVerification(doc: Document): boolean {
  // Heuristics only — structural/text signals of an interstitial verification
  // or "unusual traffic" page, never an attempt to interpret or solve one.
  const bodyText = doc.body?.innerText?.toLowerCase() ?? "";
  const knownSignals = [
    "unusual traffic",
    "verify you are a human",
    "confirm you're not a robot",
  ];
  const hasSignalText = knownSignals.some((s) => bodyText.includes(s));
  const hasChallengeFrame = !!doc.querySelector('iframe[src*="recaptcha"], iframe[title*="challenge"]');
  return hasSignalText || hasChallengeFrame;
}
```

When `detectVerification()` returns `true` at any check point:

1. Extraction stops immediately (does not finish "just this one business" — it stops before any further page interaction).
2. Session status → `paused`, `pauseReason: "verification_required"`.
3. Popup and dashboard show a dedicated, unmissable state (Section 31): *"Google Maps is requesting verification. The extension has stopped and will not attempt to bypass this. Please complete any verification manually in the tab, then resume."*
4. No retry, no backoff-and-continue — this is a hard stop requiring explicit human resume, distinct from every other pausable state.

### 16.3 Explicitly excluded mechanisms

CAPTCHA solving (manual or automated), fingerprint spoofing or randomization, proxy rotation, stealth request headers/injection, anti-detection browser automation frameworks, and any automated verification circumvention are not implemented, not configurable, and not accepted as future feature requests within this architecture — they are a hard boundary of the product, called out again in Non-Goals (Section 4) and tested against directly (Section 34).

---

## 17. UI/UX Specification

### 17.1 Visual direction

The product should read as an operations tool a data team relies on daily — closer to a network monitoring console or a compliance/audit dashboard than a marketing SaaS product. Concretely:

- **Density over whitespace.** Every screen should show meaningful information, not generous padding for its own sake.
- **Precision over decoration.** No gradients, no glassmorphism, no floating shapes, no large rounded cards, no drop shadows beyond a single subtle utility shadow for floating elements (tooltips/menus).
- **One accent color**, used sparingly for primary actions and active/selected states only — never as a background wash across large areas.
- **Status communicated by shape + label + color together**, never color alone (Section 29).
- **Typography carries hierarchy**, not size-for-size's-sake — a restrained type scale (Section 21.2) applied consistently rather than one-off font sizes per screen.
- **No animation beyond functional transitions** (progress bar fill, panel open/close at ~150ms ease) — no bouncing, no celebratory motion, no skeleton shimmer effects that don't correspond to real loading state.
- **No emojis, no emoji-style icons, anywhere** — in UI copy, button labels, notifications, tooltips, empty states, or documentation. All icons are line-style, single-weight SVG icons (Section 21.7).

### 17.2 Interaction principles

- Every destructive or state-changing action (Stop, Clear Session) requires a single confirmation step — not a multi-step modal wizard, but never a silent one-click destructive action either.
- Every disabled control has a reason communicated on hover/focus (tooltip), never a silently disabled button.
- The system never hides "why" — every paused/failed/error state includes a plain-language reason and, where applicable, a next action (Section 23, 31).
- Keyboard operability is a baseline requirement, not an accessibility add-on bolted on later (Section 29).

---

## 18. Extension Popup

### 18.1 Dimensions and structure

- **Width:** 380px (fixed).
- **Height:** 560px default, expandable to 600px max when the Website Analysis panel is showing all three categories; internal scroll only within the (rare) case of a long error list, never on the primary stats view.
- **Layout (top to bottom):**

```
┌──────────────────────────────────────────┐
│ HEADER                                     │  40px, app name (small caps, 12px,
│ BUSINESS LEAD EXTRACTION TOOL              │  letter-spaced), settings gear icon
├──────────────────────────────────────────┤
│ PLATFORM / CONTEXT BAR                     │  28px, "Google Maps" pill (neutral,
│ [Google Maps]  Search detected             │  not accent-colored) + detection dot
├──────────────────────────────────────────┤
│ SEARCH CONTEXT                             │
│ "dental clinics in bhubaneswar"            │  14px medium, truncated with ellipsis,
│ 127 businesses detected                    │  full text on hover tooltip
├──────────────────────────────────────────┤
│ PROGRESS                                   │
│ 87 / 127                    [progress bar] │  progress bar: 4px height, accent fill
│                                             │  on neutral track, no gradient
│ Successful   81      Partial   4           │  three-column stat row, 12px labels,
│ Failed        2      Duplicate 5           │  16px medium numerals, tabular-nums
├──────────────────────────────────────────┤
│ EXTRACTION CONTROLS                        │
│ [ Start Extraction ]  (primary, full-width)│  36px height when idle
│  — or, while running —                     │
│ [ Pause ]        [ Stop ]                  │  two 50%-width secondary buttons
├──────────────────────────────────────────┤
│ WEBSITE ANALYSIS                           │
│ Website        61   ▓▓▓▓▓▓▓▓░░░░░░░       │  horizontal stacked bar, 3 segments,
│ Social Only    38   ▓▓▓▓▓░░░░░░░░░░░       │  neutral palette (not red/green/amber
│ No Website     28   ▓▓▓░░░░░░░░░░░░░       │  — this is a distribution, not a
│                                             │  status), numeric counts always shown
├──────────────────────────────────────────┤
│ EXPORT                                     │
│ [ Export CSV ]      [ Export JSON ]        │  two 50%-width secondary buttons
│ [ Open Full Dashboard ]                    │  tertiary/link-style, full width
├──────────────────────────────────────────┤
│ SESSION STATUS FOOTER                      │  24px, 11px text, e.g.
│ Session started 06:04 UTC · Auto-saved     │  "Session started 06:04 UTC · Auto-saved"
└──────────────────────────────────────────┘
```

### 18.2 Typography hierarchy (popup-specific)

| Element | Size | Weight | Color |
|---|---|---|---|
| App title (header) | 12px | 600, letter-spacing 0.04em, uppercase | `text-secondary` |
| Search query | 14px | 500 | `text-primary` |
| Detected count | 12px | 400 | `text-secondary` |
| Progress fraction (87 / 127) | 18px | 600, tabular-nums | `text-primary` |
| Stat labels (Successful, Partial…) | 12px | 400 | `text-secondary` |
| Stat numerals | 16px | 600, tabular-nums | status color (see 20) |
| Button labels | 13px | 500 | per button variant (21.5) |
| Footer text | 11px | 400 | `text-tertiary` |

### 18.3 Button hierarchy

- **Primary** (`Start Extraction`, and `Resume` when paused): accent-filled, white text, used for exactly one action at a time — the single next expected step.
- **Secondary** (`Pause`, `Stop`, `Export CSV`, `Export JSON`): neutral outline/background, dark text — used for available-but-not-the-single-next-step actions.
- **Tertiary/link** (`Open Full Dashboard`, `Retry Failed`, `Clear Session`): no border/fill, accent-colored text, used for navigational or low-frequency actions.
- **Destructive confirmation** (`Stop` confirmation, `Clear Session` confirmation): secondary-style button but with error-red text/border, shown only inside the confirmation step, never as the resting state of a normal control.

### 18.4 States

| State | Popup behavior |
|---|---|
| No Google Maps tab active | Context bar reads "No Google Maps tab detected"; everything below is replaced by a single centered message + "Open Google Maps" link (Section 31) |
| Maps open, no search yet | "Open a search on Google Maps to begin"; Start Extraction disabled with tooltip explaining why |
| Search detected, businesses discovered, not yet started | Full layout shown, Start Extraction enabled |
| Running | Pause/Stop shown in place of Start; progress bar animates; stat numbers update live via the message-passing layer (Section 24.4) |
| Paused (user) | Banner: "Paused" with `[ Resume ]` primary button replacing Pause/Stop row (Stop remains available as a secondary action beneath it) |
| Paused (verification) | Distinct high-emphasis banner (Section 31.7) — not the same visual treatment as a user-initiated pause, since it demands different user action |
| Completed | Progress bar full, "Extraction complete" label, Start Extraction row replaced by `[ Export CSV ] [ Export JSON ]` promoted to primary/secondary emphasis |
| Error/session load failure | Compact inline error banner at the top of the popup with a "Retry" link; does not block viewing whatever data is available |

Hover/focus/disabled states follow the design-system button spec in Section 21.5.

---

## 19. Extraction Dashboard

Opened via `chrome.tabs.create({ url: "dashboard.html" })` from the popup's "Open Full Dashboard" link, or from the extension's own management surface. A full-page, resizable, desktop-oriented view for reviewing and managing sessions in depth.

### 19.1 Navigation structure

```
┌────────────────────────────────────────────────────────────────┐
│ BUSINESS LEAD EXTRACTION TOOL          [Session: dental-bbsr-01▾]│
├────────────────────────────────────────────────────────────────┤
│ Overview | Businesses | Missing Data | Website Analysis |        │
│ Errors | Export                                                  │
├────────────────────────────────────────────────────────────────┤
│                     (active tab content)                         │
└────────────────────────────────────────────────────────────────┘
```

- **Overview** — session summary cards (total, successful, partial, failed, duplicate; started/updated timestamps; source search; current status) plus a compact activity log of the last N processed businesses.
- **Businesses** — the full data table (Section 20) with sorting/filtering/search.
- **Missing Data** — per-field missing counts as a sortable list (e.g. "Phone — 38 missing (30%)"), each row expandable to the filtered business list for that field.
- **Website Analysis** — the website/social/none breakdown at full size (stacked bar + counts + percentages), with one-click "Filter table to this segment" actions that jump to the Businesses tab pre-filtered.
- **Errors** — every `FAILED`/`PARTIAL` record with its `error_fields`, grouped by error type, each with a `Retry` action.
- **Export** — the export controls (Section 15.3) plus export-settings toggles (missing-value placeholder, include internal identifiers, include duplicates).

### 19.2 Session switcher

The header's session dropdown lists all locally stored sessions (most recent first), each labeled by search query + date, with stale sessions (Section 14.4) visually de-emphasized. Switching sessions re-renders the entire dashboard against the selected session's data — the dashboard never mixes records from two sessions in one view.

---

## 20. Business Data Table

A compact, enterprise-style table — not a card list. Fixed header, dense rows, horizontal scroll for overflow rather than wrapping that breaks row height consistency.

### 20.1 Columns (in order)

| Column | Width | Notes |
|---|---|---|
| Status | 88px | Status chip (Section 20.2) |
| Business Name | flex, min 200px | Primary text, 13px medium |
| Category | 140px | Primary category only; secondary categories in row-expand detail |
| Rating | 64px, right-aligned | Tabular numerals; empty-state treatment if `null` |
| Reviews | 64px, right-aligned | Tabular numerals |
| Phone | 140px | Empty-state treatment if missing |
| Website | 180px | Truncated URL, external-link icon, or empty-state treatment |
| Website Status | 96px | Small neutral badge: `Website` / `Social Only` / `None` |
| Address | flex, min 220px | Truncated with tooltip for full text |
| Extraction Time | 120px | Relative time (e.g. "2m ago") with absolute timestamp on hover |

Row height: 36px. Header height: 32px, sticky on vertical scroll.

### 20.2 Status chip treatment (see also Section 20 of core status system, Section 22)

Each chip = small colored dot/icon + label, 11px text, in a low-emphasis tinted pill — never a solid color fill, to keep the table calm at high row counts.

### 20.3 Missing-value cell treatment

An empty required-context cell (e.g. missing Phone) renders as:
- A 2px left-inset border in the warning-red tint (`--color-error-border`), confined to that cell, not the full row.
- A small "missing" indicator glyph (a minus-in-circle line icon, 12px) at the start of the cell, followed by no text (the cell is genuinely empty of data).
- A tooltip on hover: "Not listed on the source page."

This satisfies the requirement to not rely on color alone: shape (bordered cell + glyph) plus text (tooltip) both independently communicate the missing state.

### 20.4 Interactions

- **Sorting**: click any column header to sort; second click reverses; a small chevron icon indicates current sort direction. Sortable columns: Status, Business Name, Category, Rating, Reviews, Extraction Time.
- **Search**: a single text input above the table filters across Business Name, Category, Address, and Phone (client-side substring match, debounced 150ms).
- **Status filter**: multi-select chip group — `All, Complete, Partial, Failed, Skipped, Duplicate`.
- **Website-status filter**: multi-select chip group — `Website, Social Only, None`.
- **Missing-field filter**: dropdown of schema field names; selecting one filters to records where that field appears in `missing_fields`.
- **Row expand**: clicking a row expands an inline detail panel below it showing every schema field (including ones not shown as columns — secondary categories, opening hours, attributes, service options, social links, missing/error field lists) without navigating away from the table.
- Filters combine with AND logic; the active filter set is shown as a summary chip row above the table with a one-click "Clear filters."

---

## 21. Design System

### 21.1 Color tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-app` | `#F5F6F8` | Page/app background |
| `--color-bg-surface` | `#FFFFFF` | Cards, table, popup body |
| `--color-border` | `#D8DBE0` | Default borders, dividers |
| `--color-border-strong` | `#B9BEC7` | Input borders on focus-adjacent states |
| `--color-text-primary` | `#14161A` | Primary text |
| `--color-text-secondary` | `#565B66` | Secondary text, labels |
| `--color-text-tertiary` | `#8A8F99` | Placeholder, disabled, footnotes |
| `--color-accent` | `#2955A8` | Primary actions, active states, focus rings |
| `--color-accent-hover` | `#1F4483` | Primary action hover |
| `--color-accent-tint` | `#EAF0FA` | Accent background tint (selected rows, active tab underline area) |
| `--color-success` | `#1C7C3C` | Success text/icon |
| `--color-success-tint` | `#E8F5EC` | Success background tint |
| `--color-error` | `#B3261E` | Error/missing/critical text/icon |
| `--color-error-tint` | `#FBEAE9` | Error background tint |
| `--color-warning` | `#A15C00` | Warning/partial text/icon |
| `--color-warning-tint` | `#FCF1DF` | Warning background tint |
| `--color-neutral-status` | `#565B66` | Queued/paused/skipped status |
| `--color-neutral-status-tint` | `#EEEFF1` | Neutral status background tint |

Accent is used **only** for primary buttons, active tab/filter indicators, focus rings, and links — never as a large background fill. Red/green/amber are reserved strictly for their defined semantic meanings (error/missing/critical, success/complete, warning/partial) and are never used decoratively elsewhere in the UI.

### 21.2 Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` — system fonts only, no bundled webfont, to avoid extra network requests inside an extension context and to match the native OS feel of a utility tool.
- **Numeric/tabular data** (rating, review count, coordinates, progress fractions): `font-variant-numeric: tabular-nums` applied globally to numeric table cells and stat displays, so columns of numbers align.
- **Monospace** (`ui-monospace, SFMono-Regular, Consolas, monospace`): used only for the internal `record_id`/`place_identifier` values when shown (row-expand detail), never for regular business data.

| Token | Size | Weight | Line height |
|---|---|---|---|
| `--text-micro` | 11px | 400 | 1.4 |
| `--text-caption` | 12px | 400 | 1.4 |
| `--text-body` | 13px | 400 | 1.5 |
| `--text-body-medium` | 13px | 500 | 1.5 |
| `--text-emphasis` | 14px | 500 | 1.4 |
| `--text-title` | 16px | 600 | 1.3 |
| `--text-page-title` | 18px | 600 | 1.3 |

### 21.3 Spacing scale

4px base grid: `4, 8, 12, 16, 24, 32, 40` (tokens `--space-1` through `--space-7`). No arbitrary one-off pixel values in component styling.

### 21.4 Radius and borders

- `--radius-sm: 2px` — chips/badges.
- `--radius-md: 4px` — buttons, inputs, cards, table container.
- `--radius-none: 0` — table cells/rows.
- Border width: `1px` solid, using `--color-border`; no border-image, no multi-layer borders.

### 21.5 Shadows

A single utility shadow, used only for floating/overlaid elements (dropdown menus, tooltips, the export confirmation toast) — never for resting cards, buttons, or table rows:

```css
--shadow-float: 0 2px 6px rgba(20, 22, 26, 0.12);
```

### 21.6 Buttons

| Size | Height | Padding (H) | Font |
|---|---|---|---|
| Default | 32px | 12px | `--text-body-medium` |
| Compact (table row actions) | 28px | 8px | `--text-caption` |
| Primary CTA (popup) | 36px | 16px | `--text-emphasis` |

States: `default`, `hover` (8% darken for filled, tint background for outline), `active/pressed` (12% darken), `focus-visible` (2px accent outline offset 1px — keyboard-only, not on mouse click), `disabled` (`--color-text-tertiary` text, `--color-border` fill/outline, `cursor: not-allowed`, tooltip explaining why on hover/focus).

### 21.7 Icons

- **Library:** a single line-icon set in the Feather/Lucide style — 1.5px stroke, no fill, 24×24 native grid.
- **Sizes used:** 16px (inline with text, table cell glyphs), 20px (buttons, header actions).
- Icons are never purely decorative — every icon in the product maps to a specific status or action (e.g. a warning-triangle icon appears only in warning-tint contexts, a check-circle only in success contexts). No icon is used twice with two different meanings within the product.

### 21.8 Inputs

Height 32px, `1px solid --color-border`, `4px` radius, `12px` horizontal padding, focus state = `1px solid --color-accent` + `2px` accent-tint outer glow (not a heavy box-shadow).

### 21.9 Tables

Row height 36px, header 32px, `1px` bottom border per row (`--color-border`, not zebra-striping — zebra striping is avoided as visually noisy at high density; hover state uses a subtle `--color-bg-app` row background instead to indicate the interactive row under the cursor).

### 21.10 Tooltips

Dark-neutral background (`#14161A`), white text, `--text-micro`, `4px` radius, `--shadow-float`, 4px offset from trigger, 150ms fade, appears after a 400ms hover delay (not instant, to avoid flicker while scanning).

### 21.11 Toasts

Bottom-right, single toast at a time (queued if multiple), 4px radius, `--shadow-float`, auto-dismiss after 4s for success/info, persistent (manual dismiss) for error toasts. Used for transient confirmations only ("Export complete — 2 files saved") — never for state that also needs to persist in the UI (that always lives in the popup/dashboard's actual state display, not just a toast that disappears).

### 21.12 Modals

Reserved for exactly two cases in V1: the Stop confirmation and the Clear Session confirmation. Centered, max-width 400px, `--shadow-float`, no backdrop blur (a flat `rgba(20,22,26,0.4)` scrim), title + one sentence of consequence + two buttons (`Cancel` secondary, action button in the relevant semantic color).

### 21.13 Empty states

Centered icon (24px, `--color-text-tertiary`) + one-line message (`--text-body`) + one action link/button where applicable. No illustrations, no multi-paragraph copy.

### 21.14 Loading states

Inline, minimal: a 16px spinner (a simple rotating arc, not a branded animation) next to the relevant control, or a thin indeterminate bar at the top of the dashboard content area during data loads. No full-screen loading takeovers except the very first popup paint before initial state resolves (capped at a 200ms minimum-display to avoid a flash).

---

## 22. State Management

### 22.1 Single source of truth

The **service worker** owns the authoritative in-memory extraction state for the currently running session (mirrored to IndexedDB on every meaningful transition). The popup and dashboard are **stateless views** that render whatever state they're given — they never independently compute extraction progress or hold state that could drift from the service worker's.

### 22.2 State machine (session status)

```
        start()                 pause()
  idle ────────► running ◄─────────────► paused
                   │  ▲                     │
        error/     │  │ resume()            │ stop()
     threshold     │  └─────────────────────┤
        exceeded   ▼                        ▼
             paused(error_threshold)     stopped
                   │
        verification
        detected
                   ▼
        paused(verification_required)

  running ──queue exhausted──► completed
```

Valid transitions are enforced by a single reducer function (`applySessionAction`) shared between the service worker's own processing loop and any UI-triggered action — there is exactly one code path that can change `session.status`, preventing UI and engine from ever disagreeing about what state the session is in.

### 22.3 UI state derivation

Popup/dashboard state is derived purely as a function of `(session, records, uiFilters)` — no popup-local state persists across popup close/reopen except transient UI-only state like "which filter dropdown is open," which is intentionally not persisted since the popup is not meant to be a long-lived surface.

### 22.4 Message-passing synchronization

- Service worker → popup/dashboard: on every session state change, the worker calls `chrome.runtime.sendMessage({ type: "SESSION_UPDATED", session })`; open popup/dashboard instances listen via `chrome.runtime.onMessage` and re-render.
- If no popup/dashboard is open, updates are simply persisted (IndexedDB) and picked up on next open via an initial `GET_SESSION_STATE` request — the worker never assumes a listener is present.
- Content script → service worker: extraction-stage events (`BUSINESS_EXTRACTED`, `VERIFICATION_DETECTED`, `PAGE_STATE_MISMATCH`) are sent via `chrome.runtime.sendMessage` from the content script and drive the reducer in 22.2.

---

## 23. Error Handling

### 23.1 Principle

No single business's failure may terminate the session. The engine always attempts to advance the queue after handling any per-item error.

### 23.2 Error taxonomy

| Category | Definition | Example | Engine behavior |
|---|---|---|---|
| **Recoverable** | Transient condition likely to resolve on its own | Panel briefly didn't render before the stability check timed out | Log to `error_fields`, mark `PARTIAL` if some data was captured, `FAILED` if none was, continue to next item |
| **Retryable** | Recoverable, and specifically eligible for automatic retry within the same session | Network timeout loading a detail panel | One automatic retry with backoff (Section 16.1); if it fails again, treated as recoverable-but-exhausted → `FAILED`, available for manual `Retry Failed` later |
| **Non-recoverable (per-item)** | The business itself cannot be processed regardless of retry | Detail panel structure entirely unrecognized as a business listing | Marked `FAILED` immediately, no automatic retry (manual retry still available, since a page refresh or later attempt may succeed) |
| **User-action-required** | The *session*, not just one item, cannot proceed without the user doing something on the actual page | Unexpected navigation away from Maps search/detail context | Session auto-pauses (`pauseReason: "unexpected_page_state"`); current in-flight item is marked `FAILED` if it was mid-extraction |
| **Verification** | Platform-presented challenge/verification screen | "Verify you're not a robot" interstitial | Hard stop per Section 16.2 — distinct handling, no retry logic applies at all |

### 23.3 Example error record

```json
{
  "extraction_status": "partial",
  "error_fields": ["phone"],
  "missing_fields": ["price_level"]
}
```

Here, `phone` is an *error* (the engine expected to find it and couldn't confirm its state — retryable) while `price_level` is *missing* (confirmed absent — not retryable, not an error).

### 23.4 Session-level error threshold

If 3 consecutive queue items result in `FAILED` status, the engine treats this as a signal that something systemic has changed (page structure, network, account-level issue) rather than continuing to fail through the rest of the queue. The session auto-pauses with `pauseReason: "error_threshold"` and the UI states plainly: *"3 consecutive businesses failed to extract. Extraction has been paused so you can check the Google Maps tab before continuing."* This threshold is configurable in advanced settings (default 3, range 2–10).

---

## 24. Browser Extension Architecture

### 24.1 Manifest (V3)

```json
{
  "manifest_version": 3,
  "name": "Business Lead Extraction Tool",
  "version": "1.0.0",
  "description": "Extract structured business data from supported map and directory platforms.",
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.google.com/maps/*", "https://maps.google.com/*"],
      "js": ["content-scripts/google-maps/index.js"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage", "downloads", "unlimitedStorage"],
  "host_permissions": ["https://www.google.com/maps/*", "https://maps.google.com/*"],
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Permission justification:**

| Permission | Why it's needed |
|---|---|
| `storage` | Persist user settings and the lightweight active-session pointer via `chrome.storage.local`. |
| `unlimitedStorage` | Lift the default storage quota so IndexedDB can comfortably hold large sessions (hundreds of full business records) without hitting browser-imposed caps. |
| `downloads` | Required to programmatically save CSV/JSON export files via `chrome.downloads.download()`. |
| `host_permissions` (Google Maps only) | Scopes content-script execution and any programmatic access strictly to Google Maps pages — no broad `<all_urls>` access, and no unrelated site can be affected. |

Deliberately **not requested**: `tabs` (not needed — the content script + `activeTab`-scoped popup interaction cover everything required; the extension does not need to enumerate or read unrelated tabs), `scripting` (content scripts are declared statically in the manifest rather than injected programmatically, since the target site is known in advance), `webRequest`/`webRequestBlocking` (no network interception is performed), and any broad host permission beyond Google Maps.

### 24.2 Component responsibilities

| Component | Responsibility |
|---|---|
| **Content script** (`content-scripts/google-maps/`) | Runs in the Google Maps page context. Hosts the Google Maps adapter (Section 25). Performs all DOM reads/interactions. Sends structured events to the service worker; never makes extraction decisions itself beyond what the adapter contract defines. |
| **Service worker** (`background/`) | Owns session state and the state machine (Section 22). Runs the core extraction engine's orchestration loop (advance queue, apply timing/backoff rules, invoke normalization/classification/dedup, write to IndexedDB). Relays state to popup/dashboard. |
| **Popup** (`popup/`) | Lightweight, stateless view (Section 22.3) for at-a-glance status and primary controls. |
| **Dashboard** (`dashboard/`) | Full-page view for table review, filtering, per-record detail, and export settings. |
| **Options page** (`options/`) | Global settings not tied to a single session: default processing-speed band, default retry limit, default duplicate-handling policy, default missing-value export behavior (Section 14). |
| **IndexedDB layer** (`core/storage/`) | Thin, typed wrapper around IndexedDB (object stores, indexes, transactions) — Section 26. |

### 24.3 Why the content script is "dumb" and the engine is "smart"

The content script only exposes the platform adapter's defined operations (discover, open, extract-raw, detect-completion, detect-verification, detect-navigation). All normalization, classification, deduplication, session bookkeeping, and export logic live in the service worker / core engine, which has **zero DOM dependencies** and is fully unit-testable against fixture data (Section 33). This is the enforcement mechanism for the platform-independence requirement in Section 2/25 — it is not just a stated intention, it is a hard module boundary with no DOM API imports permitted in `src/core/**`.

### 24.4 Message-passing contract

```ts
// src/shared/messages.ts
type ContentToWorker =
  | { type: "SEARCH_PAGE_DETECTED"; sourceUrl: string; searchContext: SearchContext }
  | { type: "BUSINESS_CARDS_DISCOVERED"; cards: RawCard[] }
  | { type: "BUSINESS_RAW_EXTRACTED"; queueId: string; raw: RawBusinessData }
  | { type: "VERIFICATION_DETECTED" }
  | { type: "PAGE_STATE_MISMATCH"; expected: string; actual: string }
  | { type: "NAVIGATION_CHANGED"; url: string };

type WorkerToContent =
  | { type: "OPEN_BUSINESS"; queueId: string; cardRef: string }
  | { type: "SCROLL_RESULTS_FEED" }
  | { type: "NAVIGATE_BACK_TO_RESULTS" };

type WorkerToUI =
  | { type: "SESSION_UPDATED"; session: ExtractionSession }
  | { type: "RECORD_SAVED"; record: BusinessRecord };

type UIToWorker =
  | { type: "START_EXTRACTION" }
  | { type: "PAUSE_EXTRACTION" }
  | { type: "RESUME_EXTRACTION" }
  | { type: "STOP_EXTRACTION" }
  | { type: "RETRY_FAILED" }
  | { type: "CLEAR_SESSION" }
  | { type: "EXPORT"; format: "csv" | "json" | "both" };
```

Every message is validated against its expected shape at the receiving end (Section 27.5) before being acted on — messages are never trusted purely by `type` string without shape validation, since a malformed or unexpected payload should fail safely (logged, ignored) rather than throwing deep inside the reducer.

---

## 25. Platform Adapter Architecture

### 25.1 Purpose

Google Maps–specific logic must never leak into the core extraction engine, the queue, storage, deduplication, session management, export, or UI. The adapter is the single seam where platform knowledge lives.

### 25.2 Adapter interface

```ts
// src/core/adapters/platform-adapter.ts
export interface PlatformAdapter {
  readonly platformId: string;                 // e.g. "google_maps"

  /** Is the current page this platform at all? */
  detectPlatform(doc: Document, url: string): boolean;

  /** Is the current page a search-results page this adapter can enumerate? */
  detectSearchPage(doc: Document, url: string): SearchContext | null;

  /** Enumerate currently-visible business cards; called repeatedly as the
   *  results feed is scrolled by discoverMore(). */
  discoverBusinesses(doc: Document): RawCard[];

  /** Trigger further discovery (e.g. scroll) and report whether new cards
   *  appeared; returns false when discovery is exhausted. */
  discoverMore(doc: Document): Promise<boolean>;

  /** Navigate into a business's detail view. */
  openBusiness(card: RawCard): Promise<void>;

  /** Read raw, unnormalized field values from the currently-open detail view. */
  extractBusiness(doc: Document): Promise<RawBusinessData>;

  /** Normalize this platform's raw shape into the canonical schema
   *  (Section 10). Platform-specific parsing (e.g. Maps URL coordinate/
   *  place-id extraction) lives here — the OUTPUT is platform-agnostic. */
  normalizeBusiness(raw: RawBusinessData): Partial<BusinessRecord>;

  /** Produce the best available dedup identifier for a raw/normalized
   *  business, used by the core dedup engine's priority chain (Section 13). */
  getBusinessIdentifier(record: Partial<BusinessRecord>): BusinessIdentifier;

  /** Has this business's detail view finished rendering enough to extract? */
  detectCompletion(doc: Document): boolean;

  /** Is the platform presenting a verification/challenge state? */
  detectVerification(doc: Document): boolean;

  /** Navigate back to the results context after processing one business. */
  returnToResults(): Promise<void>;

  /** Did the page context change unexpectedly (manual navigation, etc.)? */
  detectUnexpectedNavigation(doc: Document, url: string, expected: SearchContext): boolean;
}
```

The exact method names above are a recommendation, not a rigid mandate (per the source spec) — but the **shape of the boundary** is mandatory: discovery, opening, raw extraction, normalization, identifier derivation, completion/verification/navigation detection must each be independently implementable per platform, and the core engine must call only these interface methods, never platform-specific helpers directly.

### 25.3 Selector resilience strategy (Google Maps adapter internals)

Google Maps ships frequent, unannounced DOM/class-name changes. The adapter never depends on a single brittle selector for a required field. Each field extractor is defined as an **ordered list of candidate strategies**, tried in order until one succeeds:

```ts
// src/adapters/google-maps/extractors/name.ts
const NAME_STRATEGIES: Array<(doc: Document) => string | null> = [
  (doc) => doc.querySelector('h1[class*="fontHeadlineLarge"]')?.textContent?.trim() ?? null,
  (doc) => doc.querySelector('div[role="main"] h1')?.textContent?.trim() ?? null,
  (doc) => doc.querySelector('[data-attrid="title"]')?.textContent?.trim() ?? null,
];

export function extractName(doc: Document): { value: string | null; strategyUsed: number } {
  for (let i = 0; i < NAME_STRATEGIES.length; i++) {
    const value = NAME_STRATEGIES[i](doc);
    if (value) return { value, strategyUsed: i };
  }
  return { value: null, strategyUsed: -1 };
}
```

`strategyUsed` is logged (not shown to the end user) so the team can see, in aggregate across sessions, when a previously-reliable strategy (index 0) starts failing more often and a fallback (index 1+) is taking over — an early warning signal that Maps has changed and the adapter needs an update, without waiting for full extraction failures to surface the problem.

### 25.4 Place identifier extraction (used by dedup, Section 13.2)

```ts
// src/adapters/google-maps/extractors/place-identifier.ts
export function extractPlaceIdentifier(mapsUrl: string): string | null {
  const hexPairMatch = mapsUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (hexPairMatch) return hexPairMatch[1];
  const dataParamMatch = mapsUrl.match(/[?&]data=.*?(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return dataParamMatch ? dataParamMatch[1] : null;
}

export function extractCoordinates(mapsUrl: string): { lat: number | null; lng: number | null } {
  const match = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return match ? { lat: parseFloat(match[1]), lng: parseFloat(match[2]) } : { lat: null, lng: null };
}
```

---

## 26. Storage Architecture

### 26.1 IndexedDB database design

Database: `lead-extraction-db`, versioned schema with migrations handled via `onupgradeneeded`.

| Object store | Key path | Indexes | Purpose |
|---|---|---|---|
| `sessions` | `sessionId` | `updatedAt`, `status` | One entry per extraction session (Section 14.2) |
| `queue_items` | `queueId` | `sessionId`, `status` | Queue entries for a session; queried by `sessionId` when rendering progress, by `status` for retry-failed operations |
| `business_records` | `recordId` | `sessionId`, `placeIdentifier`, `normalizedNameAddress`, `normalizedNamePhone`, `websiteStatus`, `extractionStatus` | Canonical business records; the identifier/name/phone indexes back the dedup priority chain (13.2) with O(log n) lookups instead of a full scan per new record |
| `settings` | `key` | — | Small key-value store for user preferences mirrored from `chrome.storage.local` for use inside the service worker's IndexedDB transactions when needed |

### 26.2 Wrapper (using the lightweight `idb` library for ergonomics over raw IndexedDB callbacks)

```ts
// src/core/storage/db.ts
import { openDB, DBSchema } from "idb";

interface LeadExtractionDB extends DBSchema {
  sessions: { key: string; value: ExtractionSession; indexes: { updatedAt: string; status: string } };
  queue_items: { key: string; value: QueueItem; indexes: { sessionId: string; status: string } };
  business_records: {
    key: string;
    value: BusinessRecord;
    indexes: {
      sessionId: string;
      placeIdentifier: string;
      normalizedNameAddress: string;
      normalizedNamePhone: string;
      websiteStatus: string;
      extractionStatus: string;
    };
  };
}

export async function getDb() {
  return openDB<LeadExtractionDB>("lead-extraction-db", 1, {
    upgrade(db) {
      const sessions = db.createObjectStore("sessions", { keyPath: "sessionId" });
      sessions.createIndex("updatedAt", "updatedAt");
      sessions.createIndex("status", "status");

      const queue = db.createObjectStore("queue_items", { keyPath: "queueId" });
      queue.createIndex("sessionId", "sessionId");
      queue.createIndex("status", "status");

      const records = db.createObjectStore("business_records", { keyPath: "record_id" });
      records.createIndex("sessionId", "sessionId");
      records.createIndex("placeIdentifier", "place_identifier");
      records.createIndex("normalizedNameAddress", "normalizedNameAddress");
      records.createIndex("normalizedNamePhone", "normalizedNamePhone");
      records.createIndex("websiteStatus", "website_status");
      records.createIndex("extractionStatus", "extraction_status");
    },
  });
}
```

Writing a processed business is a single IndexedDB transaction spanning `business_records` (insert/merge) + `queue_items` (status update) + `sessions` (counter update), so a service-worker termination mid-write cannot leave the queue and the record store disagreeing about a business's state.

### 26.3 `chrome.storage.local` usage

Reserved for: `{ activeSessionId: string | null }` (cheap popup-open check) and the user's global settings object (Section 14/24.2's options page). Never used for business record data — this keeps `chrome.storage.local` small and fast, and keeps the one large, indexable dataset entirely in IndexedDB.

### 26.4 Adapter-declared schema subsets (forward-looking, not a V1 requirement to implement)

Each adapter declares which canonical fields it can ever populate (`supportedFields: (keyof BusinessRecord)[]`). The core `missing_fields` computation only ever considers a field "missing" if the active adapter declares it supported — this is what allows a future Yelp adapter (no Plus Code concept) to avoid every single record showing a spurious `"plus_code"` missing-field flag.

---

## 27. Security & Privacy

### 27.1 Local-first commitment

No extracted business data leaves the browser by default. There is no telemetry endpoint, no analytics SDK reporting business data, and no background network call that transmits session contents. The only outbound network activity the extension performs is the user's own browsing on Google Maps and the standard Chrome Web Store update-check mechanism — nothing initiated by this product's own code sends data anywhere.

### 27.2 Data isolation

All data is scoped to the local browser profile via IndexedDB/`chrome.storage.local`, which are already origin/profile-isolated by the browser. No shared storage across browser profiles, no sync storage (`chrome.storage.sync` is deliberately not used, since it would replicate data to the user's Google account across devices — an explicit non-goal without the user's informed, explicit opt-in, which V1 does not offer).

### 27.3 Export handling

Exports are written via `chrome.downloads.download()` to the user's own filesystem, subject to the browser's normal download prompts/settings. The extension does not read back or re-upload exported files.

### 27.4 Sensitive information considerations

The product only extracts information a business itself has chosen to publicly display on Google Maps (name, category, public contact info, public hours). It does not extract or infer anything about private individuals, does not attempt to identify business owners, and does not extract review content or reviewer identities (reviews are explicitly out of scope for extraction — only the aggregate `rating`/`review_count` are captured).

### 27.5 Content-script and message-passing security

- **DOM parsing safety**: the content script reads `textContent`/attribute values only — it never uses `innerHTML` to *write* untrusted page content into extension-controlled surfaces, preventing any injected/malicious page content from executing in extension contexts.
- **XSS protection**: all extracted text rendered in the popup/dashboard is inserted via safe DOM APIs (`textContent`, or a templating layer that auto-escapes) — never via `innerHTML` with unsanitized business data (a business name or description is untrusted, page-controlled input from the extension's perspective, even though it originates from Google's own rendered page).
- **Message validation**: every message received by the service worker (Section 24.4) is validated against a runtime schema (e.g. a lightweight `zod` schema per message type) before its payload is used; unrecognized `type` values or shape-mismatched payloads are logged and dropped rather than processed.
- **Sender verification**: the service worker checks `sender.id === chrome.runtime.id` and, for content-script messages, `sender.tab` presence, before acting on a message — this is standard MV3 hygiene against any other extension or unexpected sender.
- **Content Security Policy**: the manifest's implicit MV3 CSP (no remote code execution, no inline scripts) is left at its strict default — no `unsafe-eval`, no loading of remotely-hosted scripts.

---

## 28. Performance

### 28.1 Targets

| Scenario | Requirement |
|---|---|
| Large result sets (hundreds of businesses) | Queue construction and discovery must not block the Maps page's own responsiveness; discovery batches DOM reads and yields to the event loop between batches. |
| Long extraction sessions (multi-hour, due to conservative pacing) | Service worker must tolerate MV3's ephemeral lifecycle — state is checkpointed to IndexedDB after every business, not held only in memory, so a worker suspension between businesses loses no progress (the next wake picks up the in-progress queue item cleanly). |
| IndexedDB storage at scale | Writes are batched per-business (one transaction per business, not one transaction per field) to keep write volume proportional to businesses processed, not to field count. |
| UI responsiveness during extraction | Popup/dashboard rendering is driven by discrete `SESSION_UPDATED` messages, not polling; the dashboard table uses row virtualization once record count exceeds ~150 rows, so DOM node count stays bounded regardless of session size. |
| Memory usage | The service worker holds only the active session's queue and counters in memory — full business record bodies are read from IndexedDB on demand for UI display, not kept resident for the whole session. |
| Export generation | CSV/JSON serialization streams over an IndexedDB cursor rather than loading all records into memory at once via a single `getAll()`, so export of very large sessions doesn't spike memory. |

### 28.2 Responsiveness principle

Nothing the user does in the popup/dashboard (opening a tab, applying a filter, sorting) should ever be blocked waiting on the extraction engine's own timing loop — the UI and the engine communicate asynchronously via messages, never via a shared synchronous call stack.

---

## 29. Accessibility

- **Keyboard navigation**: every interactive element (buttons, filter chips, table sort headers, session switcher, table row expand) is reachable and operable via `Tab`/`Shift+Tab` and `Enter`/`Space`, with a logical tab order matching visual layout.
- **Focus states**: a visible `2px` accent focus outline (offset 1px) on all interactive elements when focused via keyboard (`:focus-visible`, not on mouse click, to avoid visual noise for mouse users while still fully supporting keyboard users).
- **Contrast**: all text/background pairs in Section 21.1 meet WCAG AA (4.5:1 for body text, 3:1 for large text/icons) — verified against the specific hex pairs defined, not left to "looks fine."
- **Screen-reader labels**: icon-only buttons (e.g. settings gear, table sort chevrons) carry `aria-label` describing the action, not just the icon name (e.g. `aria-label="Open extraction settings"`, not `aria-label="gear icon"`).
- **Tooltips**: supplement, never replace, visible text for anything essential to understanding a control — a disabled button's reason is available via `aria-describedby` pointing at the same text shown in the visual tooltip, so screen-reader users get the same explanation.
- **Color-independent status communication**: every status (Section 20/31) pairs its color with a distinct icon shape and a text label — never color alone. This is verified explicitly in QA (Section 33) by checking every status treatment in grayscale.
- **Accessible tables**: the business table uses proper `<table>` semantics with `<th scope="col">` headers, `aria-sort` on sortable columns, and row-expand detail panels use `aria-expanded`/`aria-controls` on the trigger.
- **Accessible buttons**: all buttons are real `<button>` elements (never a styled `<div>` with a click handler), ensuring native keyboard and screen-reader behavior for free.

---

## 30. Internationalization

V1 ships English-only UI, but is architected for future localization from day one:

- All UI copy lives in `chrome.i18n`-compatible message catalogs (`_locales/en/messages.json`), referenced in code via `chrome.i18n.getMessage("start_extraction_button")` — never as inline hardcoded strings in components.
- Date/number formatting uses `Intl.DateTimeFormat`/`Intl.NumberFormat` rather than manual string construction, so a future locale change doesn't require rewriting formatting logic.
- Business data itself (names, addresses, categories) is Unicode-safe end to end — normalization functions (Section 13.3) explicitly use Unicode-aware regex (`\p{L}`, `\p{N}` with the `u` flag) rather than ASCII-only character classes, so non-Latin business names (Hindi, Odia, Arabic, CJK, etc.) are never mangled during normalization or dedup comparison.
- Adding a language post-V1 means adding a new `_locales/<lang>/messages.json` file — no component code changes required, since no component contains hardcoded UI text.

---

## 31. UI States

Each state below defines: **Visual state**, **Message**, **Available actions**.

| State | Visual state | Message | Available actions |
|---|---|---|---|
| Initial (fresh install) | Popup shows neutral empty-state icon | "Open Google Maps and run a search to begin." | `Open Google Maps` (opens a new tab) |
| No Google Maps detected | Context bar shows neutral/gray dot | "No Google Maps tab detected." | `Open Google Maps` |
| Search detected, no businesses yet discovered | Loading spinner in place of stats | "Detecting businesses..." | none (brief, automatic) |
| Businesses detected, ready to extract | Full stats layout, count shown | "127 businesses detected." | `Start Extraction` (primary, enabled) |
| Extraction running | Progress bar animating, live counters | "Processing 88 of 127+..." | `Pause`, `Stop` |
| Paused (user) | Amber-tinted banner | "Extraction paused." | `Resume`, `Stop` |
| Paused (verification) | Red-tinted, higher-emphasis banner, distinct icon | "Google Maps requires verification. Extraction has stopped and will not attempt to bypass this. Resolve it in the tab, then resume." | `Resume` (only enabled once the adapter re-checks and confirms the challenge is gone), `Stop` |
| Completed | Green-tinted summary banner, progress bar full | "Extraction complete — 81 successful, 4 partial, 2 failed, 5 duplicates." | `Export CSV`, `Export JSON`, `Open Full Dashboard` |
| Partial completion (stopped before queue exhausted) | Neutral summary banner | "Extraction stopped at 87 of 127. Progress has been saved." | `Resume`, `Export CSV`, `Export JSON` |
| Failed extraction (session-level, e.g. error threshold) | Red-tinted banner | "Extraction paused after repeated failures. Check the Google Maps tab, then resume." | `Resume`, `Retry Failed`, `Stop` |
| No results | Neutral empty-state icon | "This search returned no businesses." | `Open Google Maps` (to run a new search) |
| No business cards detected (page present but adapter can't parse it) | Neutral empty-state icon, distinct from "no results" | "Businesses couldn't be identified on this page. Google Maps may have changed its layout." | `Report issue` (opens feedback path), `Retry detection` |
| Exporting | Inline spinner on the relevant export button, button disabled during operation | "Preparing export..." | none (brief) |
| Export complete | Toast (Section 21.11) | "Export complete — leads.csv saved to Downloads." | dismiss (auto) |
| Storage error | Red inline banner at top of popup/dashboard | "Unable to save session data. Check available disk space." | `Retry` |
| Unexpected page structure | Red-tinted banner, distinct icon from verification state | "Extraction paused — the page structure didn't match what was expected." | `Resume` (re-attempts detection), `Stop` |

---

## 32. User Experience Details

Throughout every state above, the interface answers, without the user needing to ask:

- **What platform is active** — the platform pill in the popup header/context bar, always visible.
- **What search is being processed** — the search query line, always visible while a session exists.
- **How many businesses were detected** — the count (with `+` while still growing, Section 8.3).
- **How many were processed** — the `X / Y` progress fraction.
- **What is currently being processed** — the dashboard's Overview activity log shows the business currently in the `processing` state by name.
- **What failed and why** — the Errors tab (Section 19.1) and per-row `error_fields`.
- **Whether extraction is paused** — the paused banner, always distinguishing pause reason (user vs. verification vs. error threshold vs. unexpected state) rather than a single generic "paused" label.
- **Whether user action is required** — pause states that need the user to act on the actual Maps tab are visually distinct (red-tinted, explicit instruction) from a simple user-initiated pause (amber-tinted, no external action needed beyond clicking Resume).
- **Where exported files are generated** — the export-complete toast names the exact filename and confirms it was saved to the browser's Downloads location.

---

## 33. Technical Requirements

### 33.1 Language and framework evaluation

| Option | Verdict | Reasoning |
|---|---|---|
| Vanilla JavaScript | Rejected as primary | No type safety across the adapter interface (Section 25.2) and message contracts (Section 24.4), where shape correctness matters most; a typo in a message `type` string would fail silently at runtime instead of at build time. |
| **TypeScript** | **Selected** | Enforces the adapter interface contract, the message-passing contract, and the canonical schema at compile time — directly reduces the risk category this product cares most about (silently wrong or malformed data). No runtime cost; compiles to plain JS. |
| React (for popup/dashboard) | Rejected for the popup, optional for the dashboard | The popup is small and largely a direct render of a flat state object — a full component framework adds bundle size and a build-complexity tax without solving a real problem at that scale. |
| Web Components | Selected for shared UI primitives | Status chips, buttons, and the data table row are implemented as small, framework-free custom elements shared between popup and dashboard, avoiding both a heavy framework dependency and copy-pasted markup/logic between the two surfaces. |
| **Preact** (for the dashboard table specifically) | **Selected, dashboard only** | The dashboard's business table has enough interactive state (sort, multi-filter, search, row-expand, virtualization) that a small (~3KB) reactive rendering layer measurably reduces implementation risk and code volume compared to hand-rolled DOM diffing, without the bundle cost of full React. The popup remains framework-free. |
| IndexedDB | Selected | Per Section 14.3/26 — the only viable option for the data volume and query patterns this product needs. |
| `chrome.storage.local` | Selected, narrow scope | Per Section 26.3 — settings and a lightweight pointer only. |
| `chrome.storage.sync` | Rejected | Would replicate business data to the user's Google account across devices without explicit opt-in — conflicts with the local-first privacy commitment (Section 27.1). |

**Summary:** TypeScript throughout; Web Components for shared, framework-free UI primitives; Preact specifically for the dashboard's data table interactivity; IndexedDB as the system of record; `chrome.storage.local` for settings only. This is the simplest stack that reliably supports the product's actual complexity (a typed adapter boundary, a stateful queue engine, and one genuinely interactive data table) without adopting a framework anywhere it isn't earning its cost.

### 33.2 Build tooling

- **Bundler:** Vite, using its native Chrome-extension-friendly multi-entry build (separate entry points for `service-worker`, `content-script`, `popup`, `dashboard`, `options`).
- **Testing:** Vitest for unit/integration tests (Section 33 below), Playwright for end-to-end tests driving a real loaded extension against fixture HTML pages standing in for Google Maps' DOM shape.
- **Linting/formatting:** ESLint + Prettier, with a repo-level rule forbidding DOM global references (`document`, `window.location` outside an explicitly allow-listed adapter directory) inside `src/core/**`, mechanically enforcing the platform-independence boundary from Section 25.1 rather than relying on code review alone.

---

## 34. Project Structure

```
src/
  core/                          # platform-agnostic — no DOM API access permitted here
    adapters/
      platform-adapter.ts        # PlatformAdapter interface (25.2)
      registry.ts                # adapter lookup by platformId
    engine/
      queue.ts                   # queue construction, ordering, item lifecycle
      orchestrator.ts            # main processing loop, timing/backoff (16.1)
      state-machine.ts           # session status reducer (22.2)
    classification/
      social-domains.ts          # Section 11.4
      website-classifier.ts      # Section 11.3
    dedup/
      normalize.ts               # Section 13.3
      identifier-chain.ts        # Section 13.2
      merge.ts                   # fill-gaps merge (13.4)
    missing-data/
      compute-missing.ts         # Section 12
    storage/
      db.ts                      # IndexedDB wrapper (26.2)
      sessions-repo.ts
      records-repo.ts
      queue-repo.ts
    export/
      csv.ts                     # Section 15.1
      json.ts                    # Section 15.2
    schema/
      business-record.ts         # canonical schema types (Section 10)
      session.ts                 # Section 14.2
  adapters/
    google-maps/
      index.ts                   # implements PlatformAdapter
      extractors/
        name.ts
        address.ts
        phone.ts
        website.ts
        rating.ts
        hours.ts
        place-identifier.ts      # Section 25.4
      selectors/
        candidates.ts            # layered selector strategy config (25.3)
      verification.ts            # Section 16.2
      navigation.ts               # returnToResults, detectUnexpectedNavigation
  content-scripts/
    google-maps/
      index.ts                   # thin bootstrap wiring the adapter to messaging
  background/
    service-worker.ts            # entry point, message routing, orchestrator wiring
  ui/
    popup/
      popup.html
      popup.ts
      components/                # Web Components: stat-row, progress-bar, button variants
    dashboard/
      dashboard.html
      dashboard.ts
      views/
        overview.ts
        businesses-table.ts      # Preact component (33.1)
        missing-data.ts
        website-analysis.ts
        errors.ts
        export-panel.ts
    options/
      options.html
      options.ts
    shared-components/
      status-chip.ts
      icon.ts
      tooltip.ts
      modal.ts
      toast.ts
  shared/
    messages.ts                  # Section 24.4 message contract
    settings.ts                  # ExtractionSettings type + defaults
    constants.ts
  utils/
    time.ts                      # jitter/backoff helpers
    text.ts                      # truncation, sanitization helpers
_locales/
  en/
    messages.json                # Section 30
public/
  icons/
manifest.json
tests/
  unit/
  integration/
  e2e/
  fixtures/
    google-maps/                 # saved DOM fixtures for adapter tests
```

The `core/` vs `adapters/` split is the single most important structural decision in the codebase: `core/` never imports from `adapters/google-maps/`, only from `core/adapters/platform-adapter.ts` (the interface). This is what makes Section 37 (adding a future platform) a bounded, low-risk change.

---

## 35. Data Flow

### 35.1 End-to-end flow

```
Google Maps DOM
      │  (read by adapter's DOM queries)
      ▼
Content Script  ──(hosts)──  Google Maps Adapter
      │  chrome.runtime.sendMessage(ContentToWorker)
      ▼
Service Worker
      │  routes message → Orchestrator
      ▼
Extraction Engine (orchestrator + queue + state machine)
      │  raw extracted data
      ▼
Normalizer (adapter.normalizeBusiness + core schema validation)
      │
      ▼
Website Classifier ──► website_status, social_links
      │
      ▼
Missing-Data Computation ──► missing_fields, error_fields
      │
      ▼
Deduplication Engine ──► identifier chain (13.2) against business_records index
      │
   duplicate?──yes──► fill-gaps merge into existing record
      │no
      ▼
IndexedDB (business_records, queue_items, sessions — single transaction)
      │  chrome.runtime.sendMessage(WorkerToUI: SESSION_UPDATED)
      ▼
Popup / Dashboard UI  (re-render from message payload)
      │  user clicks Export
      ▼
Export Engine (streams IndexedDB cursor → CSV/JSON serializer)
      │  chrome.downloads.download()
      ▼
CSV / JSON file on disk
```

### 35.2 Message-passing sequence (single business, happy path)

1. Service worker sends `WorkerToContent: { type: "OPEN_BUSINESS", queueId, cardRef }`.
2. Content script's adapter calls `openBusiness(card)`, waits for `detectCompletion(doc)` to return true (stability check, Section 8.5).
3. Content script calls `extractBusiness(doc)`, gets raw data.
4. Content script sends `ContentToWorker: { type: "BUSINESS_RAW_EXTRACTED", queueId, raw }`.
5. Service worker's orchestrator runs normalize → classify → missing-data → dedup → persist (35.1 steps).
6. Service worker sends `WorkerToUI: { type: "RECORD_SAVED", record }` and `{ type: "SESSION_UPDATED", session }`.
7. Service worker waits the jittered delay (Section 16.1), then sends `WorkerToContent: { type: "NAVIGATE_BACK_TO_RESULTS" }` followed by the next `OPEN_BUSINESS` for the next queue item.

---

## 36. Testing Strategy

| Test type | Tooling | Coverage focus |
|---|---|---|
| **Unit tests** | Vitest | Pure `core/` logic: classification (11), missing-data computation (12), normalization/dedup functions (13.3), CSV/JSON serialization (15), state-machine transitions (22.2) — all runnable with zero DOM/browser dependency. |
| **DOM parser / extractor tests** | Vitest + JSDOM, fixture HTML | Each field extractor (25.3) tested against multiple saved fixture snapshots of real (anonymized) Google Maps detail-panel HTML, including at least one "layout variant" fixture per field to validate fallback strategies actually engage correctly. |
| **Adapter tests** | Vitest + JSDOM | Full `GoogleMapsAdapter` contract: `detectPlatform`, `detectSearchPage`, `discoverBusinesses`, `detectVerification`, `detectUnexpectedNavigation` against fixtures representing each documented edge case (Section 8.6). |
| **Deduplication tests** | Vitest | Identifier-chain priority ordering (13.2) with crafted pairs designed to test each fallback tier independently; normalization edge cases (unicode names, abbreviation expansion, phone formats). |
| **CSV/JSON export tests** | Vitest | RFC 4180 escaping correctness (embedded commas, quotes, newlines, unicode names), BOM presence, column order stability, missing-value placeholder toggle behavior, round-trip parse test using a standard CSV parser library to confirm real-world compatibility. |
| **Session recovery tests** | Vitest + fake IndexedDB (`fake-indexeddb`) | Simulated service-worker restart mid-session: verify queue/session state reloads correctly and no record is duplicated or lost across the simulated restart boundary. |
| **Integration tests** | Vitest | Full orchestrator loop against a mocked adapter (no real DOM), verifying queue advancement, pause/resume/stop semantics, error-threshold auto-pause (23.4), and verification-triggered hard stop (16.2) all produce the correct session state transitions. |
| **UI tests** | Playwright (extension-loaded mode) | Popup and dashboard rendering against seeded IndexedDB fixtures: correct stat counts, correct filter behavior, correct empty/loading/error state rendering, keyboard navigation paths (29). |
| **Error handling tests** | Vitest | Every taxonomy category in Section 23.2 exercised with a scenario that must NOT halt the overall session (except the two categories that are explicitly designed to pause the session — error-threshold and verification). |
| **Browser compatibility tests** | Manual + Playwright | Verified on Chrome, Edge, and Brave (all Chromium/MV3-compatible); explicit check that `chrome.*` APIs used have no Manifest V3 deprecated/restricted usage. |

### 36.1 Representative test cases (missing fields and dynamic pages)

- A business detail fixture with no phone number at all → assert `phone: ""`, `missing_fields` includes `"phone"`, `error_fields` does not.
- A business detail fixture where the phone DOM region is present but the stability check times out before content settles → assert `error_fields` includes `"phone"`, `missing_fields` does not, `extraction_status: "partial"`.
- A business fixture with an Instagram-only link in the website slot → assert `website: ""`, `website_status: "social_only"`, `social_links` populated.
- A fixture representing infinite-scroll discovery where the same business appears in two scroll batches at different DOM positions → assert only one `business_records` entry exists after dedup.
- A fixture simulating a "verify you're not a robot" interstitial → assert the orchestrator transitions to `paused`/`verification_required` and issues zero further `OPEN_BUSINESS` messages until an explicit `RESUME_EXTRACTION` action.
- A simulated service-worker restart between business 40 and business 41 of a 100-item queue → assert on reload the session reports `processedCount: 40` and the next processed item is queue index 41, not a re-processing of 1–40.

---

## 37. Acceptance Criteria

Written as Given/When/Then for key scenarios; full traceability back to Section 9's FR IDs.

**AC-1 (FR-1, FR-2, FR-3)**
Given the user has a Google Maps search-results page open with at least one business visible,
When the user opens the extension popup,
Then the popup shows the detected search query, a business count, and an enabled "Start Extraction" button within 1 second.

**AC-2 (FR-4, FR-5)**
Given extraction is running,
When the engine processes a business,
Then exactly one detail panel is open at any given time, and every field present on that panel that maps to the canonical schema is extracted without any fabricated values for absent fields.

**AC-3 (FR-6)**
Given a business whose only outbound link is a Facebook page,
When that business is processed,
Then the resulting record has `website: ""`, `website_status: "social_only"`, and the Facebook URL present in `social_links`.

**AC-4 (FR-7)**
Given a business with no listed price level,
When that business is processed,
Then `price_level: null` and `"price_level"` appears in `missing_fields`.

**AC-5 (FR-8, Section 13)**
Given two discovered cards that resolve to the same Google Maps place identifier,
When the second one is processed,
Then no second primary record is created, and any field empty on the first record is filled from the second per the fill-gaps merge policy.

**AC-6 (FR-9, FR-10)**
Given extraction is running on business 50 of 120,
When the user clicks Pause,
Then business 50 finishes processing normally, no business 51 processing begins, and the session status becomes `paused`; clicking Resume afterward continues at business 51.

**AC-7 (FR-11)**
Given extraction is running and has completed 50 of 120 businesses,
When the user clicks Stop and confirms,
Then the session status becomes `stopped`, and all 50 previously-saved records remain fully intact and exportable.

**AC-8 (FR-12)**
Given a session with 6 `FAILED` records among 120 total,
When the user clicks "Retry Failed,"
Then only those 6 queue items are reprocessed; the other 114 are untouched.

**AC-9 (FR-13, Section 15)**
Given a completed session,
When the user clicks "Export CSV,"
Then a UTF-8 (BOM) CSV file with the exact column order from Section 15.1 is downloaded, opens without column misalignment in Excel/Sheets/LibreOffice, and every missing field renders as an empty cell (absent an explicit placeholder setting).

**AC-10 (FR-14, Section 16.2)**
Given the Google Maps tab shows a verification/challenge interstitial at any point during extraction,
When the adapter's next `detectVerification()` check runs,
Then extraction stops immediately, session status becomes `paused` with `pauseReason: "verification_required"`, and no further page interaction is attempted by the extension until the user manually resumes.

**AC-11 (FR-15, Section 14.4)**
Given a running session is interrupted by a full browser restart at 87/240,
When the user reopens the browser and the extension,
Then the dashboard/popup reports the session at exactly 87/240 with no duplicated or lost records, and offers a manual resume path once the matching Maps search is reopened.

**AC-12 (FR-16, Section 20)**
Given a session with a mix of complete, partial, failed, and duplicate records,
When the user applies the "Website Status: Social Only" filter on the dashboard table,
Then only records with `website_status: "social_only"` are shown, and the filter chip row reflects the active filter with a one-click clear option.

**AC-13 (FR-17)**
Given a fresh installation of the extension with no prior configuration,
When the user opens Google Maps and starts extraction for the first time,
Then the full extraction workflow functions correctly with zero required setup steps, external accounts, or additional software installations.

**AC-14 (Section 23.1)**
Given one business in the middle of the queue fails extraction entirely,
When the engine encounters this failure,
Then that business is marked `FAILED` with populated `error_fields`, and the engine proceeds to the next queued business without pausing or stopping the session.

---

## 38. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Reliability** | No single business's extraction failure may crash the session, the service worker, or corrupt already-saved records (Section 23.1). Session state must be durable across service-worker suspension, extension reload, and browser restart (Section 14). |
| **Performance** | UI must remain responsive (no blocked interactions) throughout an active extraction session regardless of session size (Section 28). Export generation must not require holding the full record set in memory (28.1). |
| **Security** | No remote code execution paths (strict MV3 CSP); all cross-context messages validated before use (27.5); minimal permission surface (24.1). |
| **Privacy** | No extracted business data transmitted off-device by default; no use of `chrome.storage.sync` (27.1–27.2). |
| **Maintainability** | Platform-specific logic is fully isolated in `adapters/google-maps/` with zero imports from `core/` into adapter internals and vice versa in the wrong direction (34); layered selector strategies (25.3) reduce single-point-of-failure risk from upstream Google Maps DOM changes. |
| **Scalability** (of architecture, not of V1 platform count) | A second/third platform adapter can be added without modifying the queue, storage, dedup, session, export, or UI layers (Section 37). |
| **Accessibility** | WCAG AA contrast compliance, full keyboard operability, and color-independent status communication across all UI surfaces (Section 29). |
| **Browser compatibility** | Fully functional on any current Manifest V3–compatible Chromium browser (Chrome, Edge, Brave) without browser-specific code branches beyond standard `chrome.*` API usage. |
| **Data integrity** | Deduplication and normalization are deterministic and centrally implemented (Sections 11, 13) — never duplicated ad hoc in multiple call sites with potential drift. Export output is byte-for-byte reproducible from the same stored session state. |
| **Recoverability** | Session recovery (Section 14.4) never silently loses or double-counts records across a restart boundary; recovery correctness is directly covered by dedicated tests (Section 36). |

---

## 39. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Google Maps changes its DOM structure/class names (frequent, unannounced) | Extraction silently degrades or fails broadly | Layered selector-strategy architecture (25.3) with fallback logging to surface degradation early; "Unexpected page structure" pause state (31) fails loudly rather than silently extracting wrong/empty data; adapter is isolated so a fix touches only `adapters/google-maps/`. |
| Extraction pace perceived as "too slow" by users used to scraper tools | User dissatisfaction, pressure to loosen timing defaults | Timing floor (Section 16.1) is a deliberate product boundary tied directly to the compliance stance (Section 2/16.3), not an arbitrary technical limitation — documented clearly in-product (progress messaging) so the "why" is visible, not just the constraint. |
| Manifest V3 service-worker termination between messages causes a lost in-flight step | A business could be double-processed or skipped around a termination boundary | Every state transition is checkpointed to IndexedDB in the same transaction as the data it affects (26.2); orchestrator resumes from persisted queue-item status, not from in-memory assumptions, on every wake. |
| A future platform's data model doesn't map cleanly onto the canonical schema (e.g., a directory with materially different fields) | Pressure to special-case the schema per platform, eroding the core/adapter boundary | Adapter-declared `supportedFields` (26.4) and `Partial<BusinessRecord>` normalization output (25.2) allow a platform to legitimately not populate fields that don't apply to it, without requiring schema changes or platform-specific branches in `core/`. |
| User exports a very large session and the file doesn't open correctly in a target spreadsheet tool | Direct product-trust failure at the exact moment of "handing off the deliverable" | CSV spec (15.1) is written and tested (36) against RFC 4180 plus explicit round-trip parsing tests using a standard library, not just "looks right when opened once locally." |
| Users request scraping features that cross the compliance boundary (CAPTCHA bypass, faster/parallel extraction, proxy support) | Roadmap pressure to compromise the responsible-automation design | The boundary is documented as a hard architectural constraint in this PRD (Sections 2, 4, 16.3), not a configurable default — any such request is a rejection, not a backlog item. |

---

## 40. Future Platform Architecture

### 40.1 Adding a new adapter (e.g., Yelp)

A future engineer implements `YelpAdapter implements PlatformAdapter` (Section 25.2) covering:

1. `detectPlatform` / `detectSearchPage` — Yelp-specific URL/DOM signatures.
2. `discoverBusinesses` / `discoverMore` — Yelp's own results-list DOM shape and pagination/scroll behavior.
3. `openBusiness` / `returnToResults` — Yelp's navigation pattern (which may differ structurally from Maps — e.g., a full page navigation rather than an in-place panel).
4. `extractBusiness` — Yelp's field DOM locations, using the same layered-selector-strategy pattern (25.3) for resilience.
5. `normalizeBusiness` — maps Yelp's raw fields onto the canonical schema (Section 10), declaring `supportedFields` (26.4) accurately (e.g., Yelp has no Plus Code; Yelp has its own review-tag/attribute system that maps onto `attributes`).
6. `getBusinessIdentifier` — Yelp's own business-ID/URL slug as the top-priority identifier, following the same tiered-fallback pattern as 13.2.
7. `detectCompletion` / `detectVerification` / `detectUnexpectedNavigation` — Yelp's own stability and anti-bot-interstitial signatures.

### 40.2 What must NOT change to add this adapter

- `core/engine/**` (queue, orchestrator, state machine) — platform-agnostic by construction.
- `core/storage/**` (IndexedDB schema/repos) — `source_platform` is already a first-class field (Section 10.1); a new value doesn't require a schema migration.
- `core/export/**` (CSV/JSON serializers) — operate on the canonical schema regardless of source platform.
- `core/dedup/**` — the identifier-priority-chain pattern (13.2) is already designed to be adapter-supplied via `getBusinessIdentifier`, not hardcoded to Google Maps' place-identifier format.
- `ui/dashboard/**`, `ui/popup/**` — render `source_platform` as a value (e.g. a platform pill showing "Yelp" instead of "Google Maps") without any Yelp-specific branching in UI code, since the canonical schema is what the UI consumes.

### 40.3 Multi-platform session considerations (beyond V1)

The schema and session model already support `source_platform` per record, so a longer-term (post-V1, not committed here) evolution toward "one session spanning multiple platforms for the same search" is architecturally reachable without a schema rewrite — but V1 sessions remain single-platform by design, and this PRD does not commit engineering effort toward multi-platform sessions beyond ensuring the schema doesn't block it later.

### 40.4 Adapter registry

```ts
// src/core/adapters/registry.ts
const registry = new Map<string, PlatformAdapter>();

export function registerAdapter(adapter: PlatformAdapter) {
  registry.set(adapter.platformId, adapter);
}

export function detectActiveAdapter(doc: Document, url: string): PlatformAdapter | null {
  for (const adapter of registry.values()) {
    if (adapter.detectPlatform(doc, url)) return adapter;
  }
  return null;
}
```

V1 registers exactly one adapter (`google_maps`). Adding a second is one `registerAdapter()` call plus the new adapter module — no changes to the detection/dispatch logic itself.

---

## 41. Development Roadmap

### V1 (this PRD's scope)
- Google Maps adapter (full extraction workflow, Section 8).
- Core engine: queue, orchestrator, state machine, timing/backoff (Sections 16, 22–23).
- Canonical schema, website classification, missing-data system, deduplication (Sections 10–13).
- IndexedDB storage, session persistence/recovery (Section 14, 26).
- CSV and JSON export (Section 15).
- Popup (Section 18) and full dashboard (Sections 19–20).
- Verification/challenge detection and hard-stop behavior (Section 16.2).
- Accessibility baseline (Section 29), i18n-ready string architecture (Section 30) with English only.

### V1.1
- Export-settings refinements based on real usage: additional CSV delimiter options for locales that use `;` as the field separator (common where `,` is a decimal separator), a saved "default export settings" preference.
- Session management quality-of-life: rename sessions, manually merge two sessions from the same search run at different times, bulk-delete stale sessions from the dashboard.
- Adapter selector-strategy telemetry review process (using the `strategyUsed` logging from Section 25.3) to proactively patch the Google Maps adapter ahead of user-visible breakage.
- Table performance refinement for very large sessions (1,000+ records) beyond the V1 virtualization threshold.

### V2
- Second platform adapter shipped (candidate: Yelp or Justdial, decided based on user demand signal gathered post-V1) — validates the adapter architecture in production, not just in design.
- Cross-session search/filter (find a business across all locally stored sessions, not just within one).
- Optional CRM-friendly export presets (e.g., a column mapping preset for common CRM import formats) — still local export, no live integration.

### Future Platform Expansion
- Additional adapters (Justdial, other regional/vertical business directories) added incrementally per the process in Section 40.
- Adapter-declared field-subset UI treatment refined (e.g., dashboard hides irrelevant columns per active platform rather than showing empty columns for fields that platform never supports).
- Continued enforcement of the responsible-automation boundary (Section 16) as a non-negotiable constraint for every new adapter — no future platform adapter is permitted to introduce anti-detection or challenge-bypass behavior; this PRD's Section 2/16.3 boundary applies identically to all current and future adapters.

---

*End of document.*
