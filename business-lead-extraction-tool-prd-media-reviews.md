# Business Lead Extraction Tool — PRD Addendum

## Feature Module: Business Media & Reviews Extraction (Google Maps)

**Document type:** Additive implementation-ready PRD module
**Relationship to base document:** Extends `business-lead-extraction-tool-prd.md` (V1). This document does not restate or modify the base PRD's Google Maps search-extraction workflow, core engine, storage foundation, design system, or compliance boundary — it references them by section number and defines only what is new.
**Status:** Ready for engineering handoff

---

## How to read this document

Every base-PRD concept this feature depends on is cited as **[Base §N]**. Where this feature reuses a base mechanism unchanged, that is stated explicitly rather than re-specified. Where this feature extends a base mechanism (schema, storage, state machine, UI), the extension is defined precisely and the unchanged parts are left alone.

---

## Table of Contents

1. Feature Summary
2. User Problem
3. Goals
4. Non-Goals
5. User Stories
6. Manual URL Workflow
7. Auto-Detection Workflow
8. Business Media Extraction
9. Photo Extraction
10. Video Extraction
11. Media Normalization
12. Media Deduplication
13. Review Extraction
14. Review Schema
15. Review Media
16. Review Completeness
17. Storage Architecture
18. Session Integration
19. Progress System
20. Retry System
21. Partial Results
22. Media Library UI
23. Review Table UI
24. Media Detail UI
25. Review Detail UI
26. Filtering / Search
27. CSV Export
28. JSON Export
29. File Naming
30. Large Dataset Handling
31. UI/UX Integration
32. Design System Consistency
33. Accessibility
34. Security & Privacy
35. Architecture Integration
36. Platform Adapter Integration
37. Future Extensibility
38. Performance Requirements
39. Error Handling
40. Edge Cases
41. Acceptance Criteria
42. UI Copy
43. Technical Recommendations
44. Development Breakdown
45. Test Plan

---

## 1. Feature Summary

Business Media & Reviews Extraction is a second extraction mode inside the existing Google Maps section of the extension. Where the base product extracts a **list of businesses from a search**, this feature extracts **all publicly accessible photos, videos, and reviews for one specific business**, targeted either by pasting a Google Maps business URL or by auto-detecting the business the user is currently viewing.

It reuses the base product's core engine, orchestration, timing/backoff, pause/resume/stop semantics, IndexedDB persistence, dashboard shell, table components, status system, and export engine. It adds: a business-targeting workflow, two new normalized record types (media, reviews), their extraction workflows against the Google Maps business detail page, a media library view, a review table view, and export support for both, individually and combined with the business record.

## 2. User Problem

A user who has already identified a business — via the base search extraction, or by simply browsing Google Maps directly — often needs more than the business's contact fields. Agencies auditing a prospect's online presence want their actual photo/video assets and review history; researchers studying reputation or service quality need the full review set, not a sample; sales teams preparing outreach want to reference specific reviews or media in their pitch. Doing this by hand means manually scrolling a gallery and a review feed, copying text and links one at a time, with no structured output — the same category of problem the base product solves for business fields, now applied to media and reviews.

## 3. Goals

- Let a user extract everything Google Maps publicly exposes about one business's media and reviews without manual copying.
- Produce a normalized media schema that never claims an embeddable URL exists when it doesn't.
- Collect the full accessible review set (not a fixed sample), with an honest, non-inflated completeness status.
- Integrate as a natural extension of the existing product — same engine, same storage foundation, same UI language, same compliance boundary — not a parallel product bolted on.
- Preserve everything already extracted if the job is paused, stopped, interrupted, or partially blocked.

## 4. Non-Goals

- No CAPTCHA bypass, anti-bot evasion, fingerprint spoofing, stealth automation, proxy rotation, challenge circumvention, or automated verification solving — identical boundary to **[Base §2, §16]**, applied here without exception.
- No downloading or re-hosting of binary media files. The feature captures **references** (URLs and metadata) to media Google Maps already serves publicly — it does not fetch, store, or re-encode image/video bytes.
- No fabricated embed URLs, media IDs, review IDs, or review content. If a field isn't exposed by the page, it is empty — never guessed.
- No multi-sort-mode review harvesting in V1 (Section 13 explains the tradeoff and V1 decision).
- No re-scraping/diffing against a business's previous extraction to detect deleted content in V1 (Section 40 addresses this as a future item).
- No new design language, new components, new navigation model, or new color/typography system — this feature inherits the base design system in full **[Base §21]**.

## 5. User Stories

- As an agency researcher, I want to paste a Google Maps business URL and pull every public photo and video reference, so that I can review a prospect's visual presence without opening the listing myself.
- As a sales rep already viewing a business on Google Maps, I want the extension to recognize the business I'm on and offer to extract it directly, so that I don't have to copy a URL manually.
- As a market researcher, I want every accessible review — not just the first page — collected with rating, date, author, and owner response, so that I can analyze sentiment and responsiveness at scale.
- As a user, I want a review's truncated text expanded automatically where Google Maps exposes a "More" control, so that my dataset contains full review text, not clipped previews.
- As a freelancer delivering client work, I want to export a business's media and reviews as clean, related CSV/JSON files, so that I can hand off a complete, structured package.
- As a user, I want photo extraction and review extraction tracked and controllable independently, so that a slow or blocked review feed doesn't prevent me from getting the media I've already collected.
- As a user, I want to be told plainly when Google Maps requires verification during this extraction, exactly as with search extraction, so that I never wonder whether the tool is doing something it shouldn't.

## 6. Manual URL Workflow

### 6.1 Purpose
Let a user target a business without needing to have it open in the active tab — e.g., pasting a URL received from a colleague or pulled from a prior export's `maps_url` field.

### 6.2 UI

Added to the Google Maps section of the popup and the dashboard's business row-expand (Section 22 base **[Base §20.4]**), a compact input block matching existing input styling **[Base §21.8]**:

```
Business URL

[ Paste Google Maps business URL...                    ]

[ Detect & Load ]
```

### 6.3 Validation states

| Input | Result | UI feedback |
|---|---|---|
| Empty | Rejected, button disabled | Input placeholder only; `Detect & Load` disabled until non-empty |
| Not a valid URL (fails `URL` constructor parse) | Rejected | Inline error under input: `"Enter a valid URL."` |
| Valid URL, non-Google-Maps host | Rejected | `"This URL is not a Google Maps address."` |
| Valid Google Maps **search** URL (path matches `/maps/search/` or query-only pattern with no place segment) | Rejected | `"This looks like a search results URL. Provide a URL for a single business."` |
| Valid Google Maps **place** URL (`/maps/place/...`) | Accepted | Proceeds to target confirmation (Section 18) |
| Shortened URL (`maps.app.goo.gl/*`, `goo.gl/maps/*`) | Accepted, triggers resolution | `"Resolving shortened link..."` (Section 6.4) |
| Redirected URL that resolves to a place URL | Accepted | Proceeds to target confirmation using the resolved canonical URL |
| Redirected URL that resolves to a search URL or non-business page | Rejected | Same message as the search-URL case, using the resolved URL |

### 6.4 Shortened-URL resolution — permission-conscious design

Resolving a shortened link normally requires following an HTTP redirect. Rather than adding a broad fetch-capable host permission for third-party short-link domains (which would violate the minimal-permission principle in **[Base §24.1]**), resolution is done by **tab navigation**: the extension opens the pasted URL in the current or a new tab via `chrome.tabs.update`/`chrome.tabs.create`. The browser follows the redirect natively; once the tab lands on a `google.com/maps` URL, the already-declared content script (matching `https://www.google.com/maps/*`) detects the canonical destination and reports it back. No new host permission is introduced.

### 6.5 Canonicalization

Once a valid place URL is obtained (pasted directly or resolved), it is normalized using the same `normalizeUrl` routine used for dedup **[Base §13.3]** before being used as the extraction target's `maps_url`, and the place identifier is extracted via the existing `extractPlaceIdentifier` routine **[Base §25.4]** so this workflow's dedup behavior (Section 12, Section 18) is identical to the base product's.

## 7. Auto-Detection Workflow

### 7.1 Purpose
When the user is already viewing a business on Google Maps, require zero copy-paste.

### 7.2 Detection logic

The Google Maps adapter gains one new capability, additive to the existing `PlatformAdapter` implementation **[Base §25.2]**:

```ts
// src/adapters/google-maps/index.ts (extension of the existing adapter)
detectBusinessPage(doc: Document, url: string): DetectedBusinessTarget | null;
```

```ts
interface DetectedBusinessTarget {
  business_name: string;
  address_preview: string | null;
  maps_url: string;
  confidence: "high" | "low";
}
```

- **High confidence**: name and canonical place URL both resolved via primary (index 0) selector strategies **[Base §25.3]**.
- **Low confidence**: one or both required fields only resolved via a fallback selector strategy.
- **No detection**: returns `null` — e.g., the user is on a search page, a non-business Maps view, or a business page whose structure could not be recognized at all.

### 7.3 UI

Popup and dashboard show a detected-business card whenever detection succeeds:

```
Detected Business

Perfect Dental Clinic
Bhubaneswar, Odisha

Google Maps Business Page

[ Use Current Business ]
```

Low-confidence detections carry a visible note beneath the address: `"Detected with reduced confidence — confirm the details below before extracting."` This note is text, not color alone, per the accessibility requirement inherited from the base product **[Base §29]**.

### 7.4 Page transition handling

The detected-business card re-evaluates on every Maps in-page navigation event the content script already observes for the base product's `detectUnexpectedNavigation` check **[Base §25.2]** — no new navigation-listening mechanism is introduced. If the user moves to a different business, the card updates (debounced 300ms to avoid flicker during rapid panel transitions). If the user navigates to a non-business view, the card is replaced by the default state: `"Not currently viewing a Google Maps business page."`

### 7.5 User override and no auto-start

Detection only **offers** a target — clicking `Use Current Business` populates the target confirmation step (Section 18); it never starts extraction by itself. The manual URL input (Section 6) remains available at all times beneath the detected-business card, and using it replaces whatever the auto-detected target was for the purposes of confirmation.

## 8. Business Media Extraction

### 8.1 Scope

"Business media" covers photos and videos exposed through the business's own profile surfaces (gallery, profile header, business-posted updates) — as opposed to media attached to individual reviews (Section 15), which is modeled with the same schema but a different `source_context`.

### 8.2 Source classification

```ts
type MediaSourceContext =
  | "business_gallery"   // the main photo/video gallery
  | "business_profile"   // header/cover imagery on the profile itself
  | "business_updates"   // owner-posted updates ("Posts") containing media
  | "review_media"       // attached to a specific review (Section 15)
  | "unknown";            // media located but its containing UI region could not be classified
```

This enum is defined in `core/classification/media-source.ts`, not hardcoded per extractor, so a future source type (e.g., a "menu photos" tab some business categories expose) is a config addition, not a code change to consuming logic — the same extensibility pattern the base PRD uses for social-domain classification **[Base §11.4]**.

## 9. Photo Extraction

### 9.1 Workflow

```
Target confirmed (Section 18)
        |
        v
Adapter opens the business's media gallery entry point
        |
        v
Adapter reads currently-rendered photo tiles/lightbox items
        |
        v
Stability + "more available" check (9.2)
        |
        v
   more available? --yes--> trigger next load (scroll / tab / load-more,
        |                    per whichever mechanism the gallery UI exposes)
        |                    --> repeat read
        no
        |
        v
Deduplicate (Section 12)
        |
        v
Normalize each item (Section 11)
        |
        v
Persist media records, update progress counters
```

### 9.2 Determining whether more photos remain

Google Maps galleries expose photos through varying UI mechanisms depending on business category and gallery size (a grid with scroll-driven loading, a tabbed category view, or a lightbox with next/previous navigation). The adapter's `discoverMore()`-equivalent for media (`discoverMoreMedia(doc)`) follows the same exhaustion contract as business-card discovery **[Base §8.3]**:

- After each load-trigger action (scroll, click "load more", advance lightbox), the adapter compares the current set of visible/loaded media identifiers against the previous read.
- **Gallery exhausted**: three consecutive load-trigger attempts produce zero new media identifiers.
- **Page changed underneath the job**: the business name/URL context check (shared with `detectUnexpectedNavigation` **[Base §25.2]**) fails — the job pauses (Section 39) rather than continuing to read what could now be a different business's gallery.
- **Media loading failed**: a load-trigger action is issued but the gallery region doesn't stabilize within the timeout (same stability-check pattern as the business detail panel, **[Base §8.5]**, 6-second cap) — this specific load attempt is logged as a recoverable error and retried once (Section 39) before the gallery is considered exhausted-with-errors rather than cleanly exhausted.

Progress is reported as `X / Y+` while still growing and finalized once exhaustion is confirmed, mirroring the base product's business-discovery progress convention **[Base §8.3]**.

## 10. Video Extraction

### 10.1 Workflow

Structurally identical to photo extraction (Section 9), against whatever gallery region exposes video content. Videos are extracted as a **distinct type** from photos at normalization time (Section 11), not inferred by file extension — the adapter classifies an item as `video` based on the presence of native video-player affordances (duration overlay, play control) in that gallery tile, and as `photo` otherwise.

### 10.2 Fields captured when exposed

- Video source URL (the page context the video plays from).
- Embed URL — **only** when the video is hosted on a platform with a defined public embed format (Section 11.4); Google-native gallery videos typically do not have one and are recorded with `embed_url: "unavailable"`.
- Thumbnail.
- Title, when the gallery exposes a caption/title for the item.
- Duration, when displayed on the tile or player.
- Source context (Section 8.2).

### 10.3 No videos present

```json
{ "videos": [] }
```

Never represented as an error, missing field, or `null` — an empty array is a complete, valid result for a business with no video content, exactly as the base schema treats a business with no listed website hours differently from one where extraction failed to confirm hours **[Base §12.3]**.

## 11. Media Normalization

### 11.1 Canonical media schema

```ts
interface MediaRecord {
  media_id: string;                 // internal UUID, always present
  source_media_id: string | null;   // platform-native ID, only when the DOM exposes one
  business_id: string;              // FK -> BusinessRecord.record_id [Base §10.1]
  source_business_id: string | null;// copied from BusinessRecord.place_identifier when available
  review_id: string | null;         // FK -> ReviewRecord.review_id; set only when source_context is "review_media"
  type: "photo" | "video";
  source_url: string;               // the page/lightbox context the asset was found in
  media_url: string;                // the direct, reusable asset URL, when resolvable
  embed_url: string;                // a standard iframe-embeddable URL, or "unavailable" (11.4)
  thumbnail_url: string;            // small/preview variant, when distinct from media_url
  title: string;
  caption: string;
  width: number | null;
  height: number | null;
  duration: number | null;          // seconds; video only, null for photos
  source_context: MediaSourceContext;
  source_platform: "google_maps";
  extraction_status: "success" | "partial" | "failed" | "duplicate" | "skipped";
  extraction_timestamp: string;     // ISO 8601 UTC
  missing_fields: string[];
  error_fields: string[];
}
```

`extraction_status` deliberately uses `"success"` rather than the base schema's `"complete"` **[Base §10.1]** — this is a per-item outcome value, distinct in vocabulary from the job-level `"complete"`/`"partial"` status (Section 16, Section 21) that summarizes the whole media/review job. Reusing the same token at two different granularities was avoided intentionally, since a job can be `"partial"` overall while every individually-extracted item is itself a `"success"`.

### 11.2 URL type distinctions

| Field | Meaning | When populated |
|---|---|---|
| `source_url` | Where on the page this asset was found (a gallery page, a lightbox state, a review) | Always, when the asset was locatable at all |
| `media_url` | A direct, reusable URL to the asset itself (the actual image/video resource) | When the page exposes a direct asset URL — true for the large majority of Google Maps photo tiles |
| `thumbnail_url` | A smaller/preview variant of the same asset | When the gallery exposes a distinct low-resolution variant separately from the full-size asset |
| `embed_url` | A URL meant to be placed in an `<iframe>` to render the content on a third-party page | Only when the source platform defines a public embed format for that content type (11.4) |

### 11.3 Google Photos CDN URL canonicalization

Google-hosted media URLs commonly carry a size/crop suffix (e.g. `.../p/AF1Qip...=w1080-h608-k-no`). The base identifier preceding `=` is the asset's stable identity; the suffix only controls the rendered size. The normalizer:

1. Stores the highest-resolution variant it can obtain as `media_url`.
2. Stores a smaller variant (when the gallery independently exposes one, e.g. a tile preview vs. the lightbox full view) as `thumbnail_url`; if no distinct smaller variant exists, `thumbnail_url` is left empty rather than duplicating `media_url`.
3. Uses the base identifier (suffix stripped) as the canonical fingerprint input for deduplication (Section 12) — so the same photo shown as a small grid tile and again inside the lightbox is recognized as one asset, not two.

### 11.4 Embed URL policy — never fabricated

- **Direct image/video assets** (the standard case for Google Maps gallery content): these are already directly reusable via `media_url` (e.g. in an `<img>` or `<video>` tag). They do not need a separate iframe embed wrapper, and `embed_url` is set to the literal string `"unavailable"` — not `null`, not empty string, so the UI (Section 24) can render an explicit "Unavailable" state rather than an ambiguous blank cell.
- **Third-party embeddable video** (e.g. a YouTube video surfaced on a business's updates/posts): when a recognizable video ID for a platform with a well-defined, publicly documented embed URL format is found, the standard embed URL for that platform is constructed from the ID using that platform's own published format (e.g. YouTube's `https://www.youtube.com/embed/{videoId}`). This is a deterministic, standard transformation of a real, extracted identifier — not an invented URL — and is only performed for platforms with such a published format.
- If a video is present but no such recognizable ID/platform can be determined, `embed_url: "unavailable"` — the system never guesses a wrapper URL.

### 11.5 Case-by-case resolution behavior

| Situation | Behavior |
|---|---|
| Direct media URL exists | `media_url` populated, `extraction_status: "success"` |
| Only a thumbnail is available (full asset URL never resolves) | `media_url` set to the thumbnail URL as the best available reusable link, `thumbnail_url` left equal to it, and `"media_url_is_thumbnail"` added to `error_fields` so this is never silently indistinguishable from a true full-resolution result |
| Only a source/page URL is available (no direct asset URL could be resolved at all) | `media_url: ""`, `source_url` populated, `missing_fields` includes `"media_url"`, `extraction_status: "partial"` |
| Embed URL unavailable | `embed_url: "unavailable"` per 11.4 — not treated as an error |
| Media cannot be resolved at all (tile detected but no readable URL of any kind) | `extraction_status: "failed"`, `error_fields` includes `"media_unresolved"`; the item is still recorded (with its type and whatever context is known) rather than silently dropped, so the user can see that something was there and couldn't be captured |
| Media is duplicated | Handled per Section 12 — not persisted as a second record |
| Media is removed/unavailable at read time (a tile begins loading, then the asset 404s or the tile disappears before the stability check completes) | `extraction_status: "failed"`, `error_fields` includes `"media_unavailable"` |

## 12. Media Deduplication

### 12.1 Fingerprint priority chain

Checked in order, mirroring the tiered approach of the base product's business dedup **[Base §13.2]**:

1. `source_media_id`, when the platform exposes one.
2. Canonicalized `media_url` (Section 11.3 — size-suffix stripped).
3. Canonicalized `embed_url`, when `media_url` could not be resolved but an embed URL was.
4. Canonicalized `source_url` combined with `source_context`, as a last resort when neither of the above resolved (this can under-deduplicate in rare cases, which is preferable to over-merging two genuinely different assets that happen to share a generic thumbnail).

`thumbnail_url` is **never used alone** as a dedup key — thumbnails are frequently generic or shared across otherwise-distinct assets, and using them alone risks incorrectly collapsing different photos.

### 12.2 Why this matters for this feature specifically

The same photo is commonly exposed through more than one UI element on a Google Maps business page (a grid tile, the lightbox view, and sometimes a "cover photo" slot are the same underlying asset). Without this fingerprint chain, a single business could produce 2–3x as many media records as it actually has distinct assets.

### 12.3 Duplicate handling

Identical policy to business-record duplicates **[Base §13.4]**: the second occurrence is not persisted as a new primary record; any field empty on the first-seen record is filled from the duplicate (fill-gaps merge); the duplicate occurrence is logged for transparency and excluded from default export.

## 13. Review Extraction

### 13.1 Workflow

```
Target confirmed, media job running or complete (independent tracks, Section 19)
        |
        v
Adapter opens the business's reviews region
        |
        v
Adapter reads currently-loaded review entries
        |
        v
For each entry: detect truncation -> expand if a "More" control is exposed (13.3)
        |
        v
Extract fields (13.2's schema, Section 14)
        |
        v
Stability + "more reviews available" check, same exhaustion contract as media (9.2)
        |
        v
   more available? --yes--> trigger next load (scroll / "more reviews" control)
        |                    --> repeat read
        no
        |
        v
Deduplicate (fingerprint chain, Section 13.4 below)
        |
        v
Normalize, persist, update review_summary counters
```

### 13.2 Exhaustion and honesty about completeness

The adapter continues loading until:
- Three consecutive load-trigger attempts produce zero new reviews (**exhausted**), or
- The session's configured maximum-reviews limit is reached (an advanced setting, default unlimited), or
- A verification/challenge state is detected (**blocked**, Section 39), or
- The job is paused/stopped by the user, or the error threshold is exceeded (**partial**).

The system never claims completeness it hasn't earned: `review_summary.status` is `"complete"` only in the first case (Section 16).

### 13.3 Review text expansion

- **Detection**: a review entry is treated as truncated when its text container includes a visible "More" control (a distinct, clickable element adjacent to or within the review text — not inferred from character count alone, since Maps' actual truncation point varies).
- **Expansion**: the adapter dispatches a genuine `click()` on that control, then waits (same stability-check pattern, capped at 4 seconds) for the text content to stabilize at a new, longer length.
- **Extraction**: once stable (or once the cap is hit), whatever text is currently rendered is extracted.
- **Failure behavior**: if no "More" control can be located for a review whose text appears cut off, or if the expansion click doesn't produce additional text within the cap, the review is still extracted with whatever text is available, and `error_fields` includes `"review_text_truncated"` — never blocking the rest of the review's extraction or the review job as a whole.

### 13.4 Review deduplication

Reviews can reappear across scroll batches during a long review feed, the same way business cards can during search discovery. Fingerprint priority:

1. `source_review_id`, when exposed.
2. Normalized `author_profile_url` + `review_date` + a hash of the first 200 characters of `review_text`.
3. When no author profile URL is available (anonymous or unlinked reviewers): normalized `author_name` + `review_relative_time` + the same text hash, used as a lower-confidence fallback tier.

## 14. Review Schema

```ts
interface ReviewRecord {
  review_id: string;                 // internal UUID, always present
  source_review_id: string | null;   // platform-native ID, only when exposed
  business_id: string;               // FK -> BusinessRecord.record_id
  source_business_id: string | null;
  author_name: string;
  author_profile_url: string;        // "" if not exposed/linked
  author_review_count: number | null;
  rating: number;                    // 1-5; Google Maps reviews always carry a star rating
  review_text: string;
  review_date: string;               // ISO 8601, when a resolvable absolute date is available
  review_relative_time: string;      // the platform's own display string, e.g. "3 months ago"
  review_url: string;                // "" unless the platform exposes a direct permalink without extra interaction
  language: string;                  // best-effort language code from the page's own language metadata, "" if undetermined
  owner_response: { text: string; date: string } | null;   // null when no response exists
  media: MediaRecord[];              // Section 15; empty array when none
  source_platform: "google_maps";
  extraction_status: "success" | "partial" | "failed" | "duplicate" | "skipped";
  extraction_timestamp: string;
  missing_fields: string[];
  error_fields: string[];
}
```

`review_date` vs. `review_relative_time`: Google Maps typically displays a relative string ("3 months ago") rather than an absolute date. The normalizer computes a best-effort absolute `review_date` from the relative string and the extraction timestamp when the relative string is unambiguous (e.g. "3 months ago"), and leaves `review_date: ""` with `review_relative_time` still populated when the relative string is too coarse to convert reliably (e.g. "a year ago") — the raw platform string is never discarded even when the derived absolute date is.

`rating` has no `null` case: Maps does not display a review entry without a star rating, so an unresolvable rating is treated as an extraction error (`error_fields` includes `"rating"`, `extraction_status: "partial"`) rather than a legitimately-missing field.

## 15. Review Media

Media attached to an individual review — a photo the reviewer uploaded, most commonly — reuses `MediaRecord` (Section 11.1) exactly, with:

- `source_context: "review_media"`
- `review_id` populated with the owning `ReviewRecord.review_id`
- `business_id` / `source_business_id` populated identically to the parent review (media inherits the business context, not just the review context, so it remains queryable both ways)

```json
{
  "media_id": "b1e2...",
  "source_media_id": null,
  "business_id": "6f1c2a9e-...",
  "source_business_id": "0x3a1909f3c1e2a1a3:0x7b2c9e1f4d3a8b60",
  "review_id": "9a44...",
  "type": "photo",
  "source_url": "https://www.google.com/maps/place/.../reviews",
  "media_url": "https://lh3.googleusercontent.com/p/AF1Qip...",
  "embed_url": "unavailable",
  "thumbnail_url": "",
  "title": "",
  "caption": "",
  "width": null,
  "height": null,
  "duration": null,
  "source_context": "review_media",
  "source_platform": "google_maps",
  "extraction_status": "success",
  "extraction_timestamp": "2026-09-09T06:40:02.100Z",
  "missing_fields": ["width", "height"],
  "error_fields": []
}
```

No new UI or extraction logic is required beyond what Sections 9–12 already define — the media pipeline is source-context-agnostic by design, it simply runs against a different DOM region and tags its output differently.

## 16. Review Completeness

### 16.1 Status model

```ts
type ReviewJobStatus = "complete" | "partial" | "blocked" | "failed" | "empty";
```

| Status | Meaning |
|---|---|
| `complete` | The reviews region was scrolled/loaded to exhaustion (Section 13.2) with no blocking encountered. May still carry a `count_discrepancy` note (16.2) — completeness refers to the interface being exhausted, not to matching a header number exactly. |
| `partial` | Extraction stopped before exhaustion due to user pause/stop, the error threshold, or a configured review limit. |
| `blocked` | Extraction stopped specifically because a verification/challenge state was detected — kept distinct from `partial` so the user always knows *why* it stopped. |
| `failed` | Reviews exist on the business but zero could be extracted due to a structural failure (e.g. the reviews region could never be recognized at all). |
| `empty` | The business genuinely has no reviews — not an error. |

### 16.2 Review summary object

```json
{
  "review_summary": {
    "reported_review_count": 842,
    "reviews_found": 842,
    "reviews_extracted": 839,
    "reviews_failed": 3,
    "count_discrepancy": false,
    "status": "complete",
    "sort_mode": "default"
  }
}
```

- `reported_review_count`: the review count shown on the business's own profile header (the same value as `BusinessRecord.review_count` **[Base §10.1]**), captured for comparison.
- `reviews_found`: how many distinct review entries the adapter loaded via scrolling.
- `reviews_extracted`: how many of those were successfully normalized (`extraction_status: "success"`).
- `reviews_failed`: `reviews_found − reviews_extracted`.
- `count_discrepancy`: `true` whenever `reviews_found !== reported_review_count`, surfaced transparently rather than silently reconciled — Google's own displayed count and what the scroll interface actually exposes are not guaranteed to match, and this system does not paper over that gap.
- `sort_mode`: always `"default"` in V1 (Section 13's tradeoff below).

### 16.3 V1 sort-mode decision

Google Maps allows re-sorting reviews (Most relevant, Newest, Highest rating, Lowest rating), but sorting reorders the same underlying accessible set rather than exposing a materially different one. Running a full extraction pass once per sort mode would multiply session duration several-fold under the product's conservative-pacing requirement **[Base §16.1]** for no confirmed data-completeness gain. **V1 decision: extract exhaustively from the default sort order only.** `sort_mode: "default"` is recorded explicitly in the schema so this is a visible, documented choice rather than a silent limitation, and so a future version could add an explicit, user-initiated "also collect under a different sort" action without a schema change.

## 17. Storage Architecture

### 17.1 Conceptual hierarchy

```
Session (search-extraction context, when the business originated from one) [Base §14.2]
  |
  +-- BusinessRecord [Base §10.1]
         |
         +-- MediaReviewJob   (new — this feature's unit of work, Section 18)
                |
                +-- MediaRecord[]   (Section 11)
                +-- ReviewRecord[]  (Section 14, embedding review_media inline via FK)
```

A `MediaReviewJob` always references exactly one `BusinessRecord` and is not itself a member of a search-extraction `Session`'s business queue — it is a separate, business-scoped unit of work that can be launched with or without a prior search session (Section 18).

### 17.2 New IndexedDB object stores

Added to the existing `lead-extraction-db` database **[Base §26.1]** via a schema version bump (v1 → v2); no existing store's shape changes.

| Object store | Key path | Indexes | Purpose |
|---|---|---|---|
| `media_review_jobs` | `jobId` | `businessId`, `status`, `updatedAt` | One entry per media/reviews extraction job (Section 18.2) |
| `media_records` | `media_id` | `businessId`, `reviewId`, `sourceContext`, `canonicalFingerprint`, `extractionStatus` | Media items (Section 11); `reviewId` index supports "media for this review" lookups, `businessId` supports "all media for this business" regardless of context |
| `review_records` | `review_id` | `businessId`, `rating`, `extractionStatus`, `reviewFingerprint` | Review items (Section 14) |

```ts
// src/core/storage/db.ts — migration addition, existing stores untouched
async function upgradeToV2(db: IDBPDatabase<LeadExtractionDB>) {
  if (!db.objectStoreNames.contains("media_review_jobs")) {
    const jobs = db.createObjectStore("media_review_jobs", { keyPath: "jobId" });
    jobs.createIndex("businessId", "businessId");
    jobs.createIndex("status", "status");
    jobs.createIndex("updatedAt", "updatedAt");
  }
  if (!db.objectStoreNames.contains("media_records")) {
    const media = db.createObjectStore("media_records", { keyPath: "media_id" });
    media.createIndex("businessId", "business_id");
    media.createIndex("reviewId", "review_id");
    media.createIndex("sourceContext", "source_context");
    media.createIndex("canonicalFingerprint", "canonicalFingerprint");
    media.createIndex("extractionStatus", "extraction_status");
  }
  if (!db.objectStoreNames.contains("review_records")) {
    const reviews = db.createObjectStore("review_records", { keyPath: "review_id" });
    reviews.createIndex("businessId", "business_id");
    reviews.createIndex("rating", "rating");
    reviews.createIndex("extractionStatus", "extraction_status");
    reviews.createIndex("reviewFingerprint", "reviewFingerprint");
  }
}
```

`canonicalFingerprint` and `reviewFingerprint` are computed, indexed-but-not-exported fields used purely to make the dedup lookups in Sections 12 and 13.4 O(log n) rather than a full-store scan as a business's media/review count grows.

### 17.3 No unnecessary business-record duplication

Before creating a `MediaReviewJob`, the target business is resolved against the existing `business_records` store using the same identifier chain as base-product dedup **[Base §13.2]** (place identifier → canonical Maps URL → name+address). If a match is found (the business was already captured via a prior search extraction, or a prior media/review job), the job attaches to that existing `record_id` — a new `BusinessRecord` is created only when no match exists (e.g. a business reached purely via manual URL/auto-detect that was never part of any search session). This directly satisfies the "do not duplicate business records unnecessarily" requirement.

## 18. Session Integration

### 18.1 `MediaReviewJob` state shape

```ts
interface MediaReviewJob {
  jobId: string;                      // UUID v4
  businessId: string;                 // FK -> BusinessRecord.record_id
  parentSessionId: string | null;     // set when launched from a search-extraction session's business row; null for standalone manual/auto-detect jobs
  status: "idle" | "running" | "paused" | "completed" | "stopped" | "failed";
  pauseReason: "user" | "verification_required" | "unexpected_page_state" | "error_threshold" | null;
  mediaStatus: "not_started" | "running" | "paused" | "complete" | "partial" | "failed" | "empty";
  reviewStatus: ReviewJobStatus;       // Section 16.1
  createdAt: string;
  updatedAt: string;
  mediaProgress: { photosFound: number; photosExtracted: number; videosFound: number; videosExtracted: number };
  reviewProgress: { reviewsFound: number; reviewsExtracted: number; reviewMediaFound: number; reviewMediaExtracted: number };
  settingsSnapshot: MediaReviewSettings;
}
```

### 18.2 Reused vs. new mechanisms

| Mechanism | Treatment |
|---|---|
| State machine shape (idle/running/paused/completed/stopped/failed, pause reasons) | **Reused unchanged** — same reducer pattern as `ExtractionSession` **[Base §22.2]**, parameterized over `MediaReviewJob` instead of `ExtractionSession` |
| Timing/backoff/jitter rules | **Reused unchanged** **[Base §16.1]** |
| Verification detection | **Reused unchanged** — the adapter's `detectVerification()` **[Base §16.2]** is platform-level, not specific to the search-extraction workflow, and applies identically here |
| Recovery-on-restart flow | **Reused pattern** **[Base §14.4]** — a `MediaReviewJob` in `running` status at the time of a restart is never silently auto-resumed; the dashboard offers a manual resume once the target business's page context is available again |
| Message-passing contract | **Extended** — new message types added to the existing contract **[Base §24.4]** (Section 39) rather than a parallel messaging system |
| Independent pause/resume for media vs. reviews | **New** — `mediaStatus` and `reviewStatus` are tracked and controllable independently (Section 20), since a review-feed block should not necessarily halt an already-progressing media extraction and vice versa |

### 18.3 Relationship to search-extraction sessions

Launching "View Media & Reviews" from a business row in the base dashboard's Businesses table **[Base §20]** creates a `MediaReviewJob` with `parentSessionId` set to that session — allowing the dashboard to show, from a search-extraction session, which of its businesses also have a completed media/review job, without those jobs being members of the session's own business queue.

## 19. Progress System

### 19.1 Popup / dashboard progress block

Media and review progress are shown as independent tracks, consistent with them being independently controllable (Section 18.2):

```
Media

Photos
124 / 184

Videos
12 / 12

Reviews

532 / 842

Review Media
41 / 63
```

- Each fraction uses the same tabular-numeral treatment as the base popup's progress display **[Base §21.2]**.
- A track showing `0 / 0` once its discovery phase completes renders as `"No photos found"` / `"No videos found"` / `"No reviews found"` rather than a bare `0 / 0`, consistent with treating absence as a real, complete answer rather than an unfinished-looking number.
- While a track's discovery is still in progress, its denominator carries the same `+` convention as base business discovery **[Base §8.3]** (e.g. `124 / 180+`).

### 19.2 Status banner

A single top-level banner reflects the `MediaReviewJob.status` (not the two sub-track statuses) using the same banner treatment as the base popup's paused/completed states **[Base §31]**, so a user familiar with the base product's states immediately recognizes this feature's states as the same visual language.

## 20. Retry System

### 20.1 Granular retry actions

| Action | Scope | Behavior |
|---|---|---|
| `Retry Media` | All media items with `extraction_status: "failed"` for this job | Re-attempts only those items; successfully-extracted media is untouched |
| `Retry Reviews` | All reviews with `extraction_status: "failed"` for this job | Re-attempts only those reviews |
| `Retry Failed Media` / `Retry Failed Reviews` | Identical to the above — surfaced from the Media Library (Section 22) and Review Table (Section 23) directly, scoped to the currently filtered failed set | Same underlying action as the job-level retry, exposed contextually where the user is already looking at failures |

This mirrors the base product's `Retry Failed` **[Base §13, FR-12]** exactly, just scoped to media/reviews instead of businesses — no new retry paradigm is introduced.

### 20.2 Independent failure isolation

A failure in review extraction never requires restarting media extraction, and vice versa — enforced by `mediaStatus` and `reviewStatus` being tracked and paused/resumed independently (Section 18.1).

## 21. Partial Results

### 21.1 Preservation

Consistent with the base product's core guarantee that stopping never destroys data **[Base §13, FR-11]**: pausing, stopping, or a partial/blocked outcome on either track leaves every already-persisted `MediaRecord`/`ReviewRecord` fully intact and exportable.

### 21.2 Composite status example

```json
{
  "media_status": "partial",
  "review_status": "complete",
  "overall_status": "partial"
}
```

`overall_status` is the least-complete of the two tracks (`complete` only when both are `complete` or legitimately `empty`; `partial`/`blocked`/`failed` otherwise, using the same precedence order as the enum's implied severity: `failed` > `blocked` > `partial` > `complete`/`empty`) — this is a pure display/summary derivation, not a new independently-stored field, computed the same way each time it's rendered.

## 22. Media Library UI

### 22.1 Layout — dense hybrid, not a photo grid

A compact table with a small thumbnail column, not an oversized card grid, matching the base product's data-table density philosophy **[Base §20, §21.9]**:

| Column | Width | Notes |
|---|---|---|
| Thumbnail | 48px | Small square preview; a neutral placeholder icon (not a broken-image glyph) when no thumbnail is available |
| Type | 64px | `Photo` / `Video` status-chip-style badge, same chip component as base status chips **[Base §20.2]** |
| Source | 120px | `Business Gallery` / `Review Media` / etc. (Section 8.2 values, human-readable) |
| Business | flex, min 160px | Business name, links to that business's row in the base Businesses table |
| Source URL | 160px | Truncated, tooltip for full value |
| Embed URL | 96px | `Available` (accent-colored link-style) or `Unavailable` (neutral, per 11.4) |
| Extraction Status | 88px | Standard status chip |

Row height 36px, identical to the base business table **[Base §21.9]** — this table is a sibling of that table, not a new visual pattern.

### 22.2 Row actions

`Copy Media URL`, `Copy Embed URL` (disabled with a tooltip when unavailable, never a dead click), `Open Source`, `View Details` (opens the media detail panel, Section 24) — rendered as the same compact icon-button row-action pattern used elsewhere in the dashboard.

## 23. Review Table UI

### 23.1 Columns

| Column | Width | Notes |
|---|---|---|
| Rating | 64px | Star-count rendered as a compact `4.0` numeral plus a small filled/outline star glyph set — not five separate icon elements per row, to preserve density |
| Author | 140px | Name; a small "no profile link" indicator when `author_profile_url` is empty |
| Review Date | 100px | Relative time shown by default (`3 months ago`), absolute ISO date on hover, matching the base table's relative/absolute time convention **[Base §20.1]** |
| Review Text | flex, min 260px | Truncated to two lines with `-webkit-line-clamp`, ellipsis, no expand-in-place (Section 25 handles full view) |
| Owner Response | 96px | `Yes` / `—` badge, not the full response text |
| Media | 72px | Count badge (e.g. `2`) or `—` |
| Source | 88px | `google_maps` platform badge — present for forward-compatibility with future adapters (Section 37), even though V1 has only one value |

### 23.2 Interactions

Search (across author name and review text), rating filter (`All, 5, 4, 3, 2, 1`), date filter (a simple range picker consistent with the base input style **[Base §21.8]**), response filter (`All, With Response, Without Response`), media filter (`All, With Media, Without Media`), and column sorting on Rating and Review Date — the same filter-chip-row pattern as the base Businesses table **[Base §20.4]**, not a new filtering paradigm.

## 24. Media Detail UI

A slide-over panel (reusing the base product's panel/modal component **[Base §21.12]**) rather than a full-page navigation, opened via `View Details`:

```
Thumbnail / preview (max 240px, contained, not cropped)

Type              Photo
Business          Perfect Dental Clinic
Source Context    Business Gallery
Media URL         https://lh3.googleusercontent.com/...     [Copy]
Embed URL         Unavailable
Source URL        https://www.google.com/maps/place/...     [Copy] [Open]
Dimensions        1080 x 608
Extraction Status  Success
```

Missing/unavailable fields render with the same empty-state treatment as the base business table's missing-value cells **[Base §20.3]** (bordered indicator + tooltip), not a blank line.

## 25. Review Detail UI

Same slide-over pattern as Section 24:

```
Author            Jane R.                    [View Profile]
Rating            5.0
Date              March 2026  (3 months ago)
Review Text       (full, untruncated text)
Owner Response    (full response text, or "No response from the business.")
Review Media      (thumbnail strip, each opening its own Media Detail panel)
Source            google_maps                [Open Source]
```

`[View Profile]` is disabled with a tooltip (`"No profile link exposed."`) when `author_profile_url` is empty, following the same never-a-dead-click principle as Section 22.2.

## 26. Filtering / Search

### 26.1 Media filters

`All, Photos, Videos, Business Gallery, Review Media, With Embed URL, Without Embed URL, Failed` — implemented as the same multi-select filter-chip component as the base Businesses table's status/website filters **[Base §20.4]**.

### 26.2 Review filters

`All, 5 Star, 4 Star, 3 Star, 2 Star, 1 Star, With Response, Without Response, With Media, Without Media` — same component, same interaction model.

Both filter sets combine with AND logic and display an active-filter summary chip row with one-click clear, identical to the base table's filtering behavior.

## 27. CSV Export

### 27.1 Media CSV — exact column order

```
business_name, business_id, media_id, media_type, source_context, media_url,
embed_url, thumbnail_url, source_url, width, height, title, caption, duration,
review_id, extraction_status, extraction_timestamp, source_platform
```

`duration` is empty for photos. `review_id` is empty for business-level media (`source_context` other than `review_media`).

### 27.2 Reviews CSV — exact column order

```
business_name, business_id, review_id, author_name, author_profile_url,
author_review_count, rating, review_date, review_relative_time, review_text,
owner_response, owner_response_date, review_url, review_media_count, language,
extraction_status, extraction_timestamp, source_platform
```

`owner_response` (text) and `owner_response_date` are the flattened fields of the `owner_response` object — the same object-flattening approach extends the base CSV spec's existing array-joining rule **[Base §15.1]** (arrays → `; `-joined single cell) with a parallel, explicitly-stated rule for objects: **an object field is flattened into one column per sub-field, prefixed with the parent field name**, rather than serialized as a JSON string inside a cell (which would defeat the purpose of a spreadsheet-native export).

`review_media_count` is `review.media.length` — the actual media rows live in the Media CSV (27.1) linked by `review_id`, avoiding an unparseable nested array inside a single review row.

### 27.3 Escaping and encoding

Identical rules to the base CSV spec **[Base §15.1]**: UTF-8 with BOM, CRLF line endings, RFC 4180 quoting/escaping, empty cells for missing values (subject to the same user-configurable placeholder toggle **[Base §12.4]**).

## 28. JSON Export

### 28.1 Structure

```json
{
  "business": { "...": "BusinessRecord fields [Base §10.1]" },
  "media": {
    "photos": [ { "...": "MediaRecord, type=photo" } ],
    "videos": [ { "...": "MediaRecord, type=video" } ]
  },
  "reviews": [ { "...": "ReviewRecord, with media[] inlined per Section 15" } ],
  "review_summary": { "...": "Section 16.2" },
  "extraction_metadata": {
    "job_id": "...",
    "export_timestamp": "2026-09-09T07:02:11.000Z",
    "media_status": "partial",
    "review_status": "complete",
    "overall_status": "partial",
    "source_platform": "google_maps",
    "tool_version": "1.0.0"
  }
}
```

Review-attached media appears **both** inline within its owning review object (`reviews[n].media[]`, for consumers who want the relationship pre-joined) **and** is not duplicated elsewhere — there is exactly one JSON representation per media item, unlike the CSV export where the relational split (Section 27) is necessary because CSV cannot nest.

## 29. File Naming

### 29.1 Per-business export folder

Extending the base product's flat export naming **[Base §15.3]** to accommodate three related files per business, using `chrome.downloads.download()`'s support for relative sub-paths within the Downloads folder:

```
business-lead-extraction/{business-slug}-{shortId}/business.json
business-lead-extraction/{business-slug}-{shortId}/media.csv
business-lead-extraction/{business-slug}-{shortId}/reviews.csv
```

- `{business-slug}`: the business name, lowercased, non-alphanumeric characters replaced with `-`, truncated to 40 characters.
- `{shortId}`: the first 8 characters of `business_id`, guaranteeing uniqueness across two businesses that happen to slugify identically.

### 29.2 Combined JSON

`"Export All as JSON"` produces a single file (Section 28.1's nested structure needs no splitting): `business-lead-extraction/{business-slug}-{shortId}/business-media-reviews.json`.

## 30. Export Options

| Control | Output |
|---|---|
| `Export Business Data` | `business.json` or the base product's existing business CSV row **[Base §15.1]**, for this one business |
| `Export Media` | `media.csv` (27.1) or a media-only JSON array |
| `Export Reviews` | `reviews.csv` (27.2) or a reviews-only JSON array |
| `Export All as CSV` | The three related files (29.1) — chosen over a single denormalized file because business/media/review is a genuine one-to-many-to-many relationship; flattening it into one CSV would mean repeating every business field on every media and review row, inflating file size and inviting accidental data corruption if a user edits the "business" columns inconsistently across rows. A user who specifically wants one flat file can select "flat/denormalized" in export settings, which produces a single CSV with business fields prefixed (`business_name`, `business_phone`, ...) repeated on every media/review row — documented as an explicit alternative, not the default. |
| `Export All as JSON` | The single combined file (29.2) |

## 31. Large Dataset Handling

See also Section 38 (Performance Requirements) for numeric targets.

- **Streaming/iterative processing**: media and review discovery/extraction runs as a continuous loop identical in shape to the base engine's orchestrator loop **[Base §28.1]**, never accumulating the full result set in memory before persisting — each item (or small batch, see below) is written to IndexedDB as soon as it's normalized.
- **Batched persistence**: unlike the base product's one-transaction-per-business pattern (appropriate given businesses process every 3.5–6 seconds), media and review items can be read much faster once a gallery/review region is open. Writes are batched every 20 items or every 5 seconds (whichever comes first) into a single IndexedDB transaction, keeping transaction volume proportional to actual throughput while still checkpointing frequently enough that a crash loses at most a few seconds of work.
- **UI virtualization**: the Media Library and Review Table both apply the same virtualization threshold as the base Businesses table (~150 rows) **[Base §28.1]**.
- **Export performance**: CSV/JSON export streams over an IndexedDB cursor per the base export engine's approach **[Base §28.1]**, applied identically to the new `media_records` and `review_records` stores.

## 32. UI/UX Integration

### 32.1 Dashboard placement

Rather than introducing a new, disconnected top-level navigation concept, this feature attaches to the existing dashboard **[Base §19]** at its natural integration point: the Businesses table's row-expand detail (**[Base §20.4]**) gains a new action, `View Media & Reviews`, alongside the existing full-field detail view. Selecting it opens this feature's own three-pane view (Overview / Media / Reviews) using the same tab-bar component as the base dashboard's top-level navigation **[Base §19.1]**, scoped to that one business.

For businesses reached via manual URL or auto-detect with no parent search session, the same three-pane view is reached directly from a new `Media & Reviews` entry in the popup (Section 6, Section 7) and, once at least one such job exists, a corresponding entry in the dashboard's session switcher area listing standalone media/review jobs alongside search sessions.

### 32.2 Within-feature navigation

```
Business Media & Reviews
  |
  +-- Overview     (Section 15's summary block, extraction status banner)
  +-- Media        (Section 22)
  +-- Reviews      (Section 23)
```

## 33. Design System Consistency

This feature introduces **zero** new design tokens, components, or patterns. Everything used is drawn directly from the base design system **[Base §21]**:

| Need | Reused base component/token |
|---|---|
| Status indicators (extraction status, media type, embed availability) | Status chip component **[Base §20.2, §21.7]** |
| Tables (Media Library, Review Table) | Base table density/row-height/header spec **[Base §21.9]** |
| Detail panels | Base modal/panel component **[Base §21.12]** |
| Inputs (URL paste field, filters, date range) | Base input spec **[Base §21.8]** |
| Buttons (Start/Pause/Stop/Retry/Export, row actions) | Base button hierarchy and sizing **[Base §21.6]** |
| Icons (copy, open, expand, star rating, media type) | Base icon library, sizes, single-meaning-per-icon rule **[Base §21.7]** |
| Color usage (success/error/warning/neutral) | Base color tokens, same semantic mapping — red never means anything but error/missing/critical, green never means anything but success/complete, amber never means anything but warning/partial **[Base §21.1]** |
| Empty/loading states | Base empty-state and loading-state patterns **[Base §21.13, §21.14]** |
| Typography | Base type scale, no new sizes or weights introduced **[Base §21.2]** |

No new font, no new radius value, no new spacing value, no new icon style, and no new navigation philosophy are introduced anywhere in this feature.

## 34. Accessibility

Fully inherits the base accessibility requirements **[Base §29]** — keyboard navigation, visible focus states, WCAG AA contrast, accessible table semantics, screen-reader labels on icon-only actions, and color-independent status communication all apply to the Media Library, Review Table, and both detail panels without modification. Two feature-specific additions:

- The star-rating display (Section 23.1) carries an `aria-label` stating the numeric rating (e.g. `aria-label="Rating: 4.6 out of 5"`) rather than relying on the visual star glyphs alone.
- The `Embed URL: Unavailable` state (Section 11.4) is exposed to assistive technology as text, not merely as a disabled-looking button state, so a screen-reader user gets the same "unavailable" information as a sighted user reading the label.

## 35. Security & Privacy

Fully inherits the base local-first commitment **[Base §27]**: no extracted media URL, review text, or reviewer information is transmitted anywhere by default; no new analytics; no new remote endpoints. Two feature-specific notes:

- **No binary retrieval**: this feature never downloads image/video bytes to disk or into extension storage — it stores references (URLs) only, exactly as specified in Non-Goals (Section 4). This meaningfully limits both storage footprint and any question of re-distributing platform-hosted content.
- **Reviewer information handling**: `author_name` and `author_profile_url` are whatever Google Maps already displays publicly on the review; the feature does not attempt to resolve, enrich, or cross-reference reviewer identity beyond what's directly shown, consistent with the base product's stance on not extracting information beyond what a business (or, here, a reviewer) has chosen to publicly display **[Base §27.4]**.

### 35.1 Storage security for large datasets

Media and review records are persisted in the same IndexedDB database as the base product's business records, which is already origin/profile-isolated by the browser **[Base §27.2]** — no new storage isolation mechanism is required. The `unlimitedStorage` permission already declared in the base manifest **[Base §24.1]** covers the additional volume this feature introduces; no manifest change is needed for storage capacity.

## 36. Architecture Integration

```
Google Maps Adapter [Base §25]
      |
      +-- Business Extraction (existing, unchanged)
      |
      +-- Media Extraction (new: Sections 9, 10)
      |
      +-- Review Extraction (new: Section 13)
              |
              v
      Normalization Layer
        - existing BusinessRecord normalizer [Base §25.2] — unchanged
        - new MediaRecord normalizer (Section 11)
        - new ReviewRecord normalizer (Section 14)
              |
              v
      Deduplication
        - existing business identifier chain [Base §13] — unchanged
        - new media fingerprint chain (Section 12)
        - new review fingerprint chain (Section 13.4)
              |
              v
      Storage Layer (same IndexedDB database, new object stores — Section 17)
              |
      +-------+--------+
      |                |
      UI               Export
      |                |
      Media Library    Media CSV/JSON
      Review Table     Review CSV/JSON
```

The core extraction engine's orchestrator, timing/backoff, and state-machine pattern are **reused as a generic mechanism** parameterized over a different unit of work (`MediaReviewJob` instead of `ExtractionSession`'s business queue) rather than duplicated — the base PRD's core/adapter boundary **[Base §25.1]** is preserved: no Google-Maps-specific media/review DOM logic exists outside `adapters/google-maps/`.

## 37. Platform Adapter Integration

`PlatformAdapter` **[Base §25.2]** gains three new optional interface members (optional because a future adapter's platform may not expose one of these concepts at all):

```ts
export interface PlatformAdapter {
  // ...existing required members unchanged...

  detectBusinessPage?(doc: Document, url: string): DetectedBusinessTarget | null;
  discoverMedia?(doc: Document, context: MediaSourceContext): Promise<RawMediaItem[]>;
  discoverReviews?(doc: Document): Promise<RawReviewItem[]>;
}
```

The core engine checks for the presence of these methods before offering the Media & Reviews feature for a given platform — a future adapter that doesn't implement them simply doesn't expose this feature for that platform, without any core-engine branching on platform identity.

## 38. Future Extensibility

| Platform | Businesses | Photos | Videos | Reviews |
|---|---|---|---|---|
| Google Maps (V1, this document) | Yes | Yes | Yes | Yes |
| Platform A (hypothetical, full parity) | Yes | Yes | Yes | Yes |
| Platform B (hypothetical, partial parity — e.g. no native video hosting) | Yes | Yes | No (`discoverMedia` returns only photos; `videos: []` always, `mediaStatus` for video is `"empty"`, never an error) | Yes |

Because `MediaRecord`/`ReviewRecord` are already platform-agnostic (Section 39 fields: `source_platform`, `source_business_id`, `source_media_id`, `source_review_id`) and the adapter interface members are optional per-capability rather than a monolithic "supports media and reviews: yes/no" flag, a partial-parity platform integrates without any change to storage, export, or UI — the UI simply reflects whatever `mediaStatus`/`reviewStatus` values that platform's adapter is capable of producing, using the same status vocabulary already defined (Section 16, Section 21.2).

## 39. Performance Requirements

| Scenario | Requirement |
|---|---|
| 100 photos | Negligible — well under the virtualization threshold, discovery completes in a small number of load-trigger cycles |
| 500 photos | Media Library table virtualizes (Section 31); discovery batching (Section 31) keeps IndexedDB write volume proportional to actual throughput, not per-item |
| 1,000+ reviews | Review Table virtualizes; review-text expansion (Section 13.3) is the dominant per-item cost and is bounded by its own 4-second cap per review so a small number of slow expansions cannot stall the whole job — a review whose expansion times out is still extracted (truncated) and the job continues |
| Large media sets combined with large review sets on one business | Media and review tracks process independently (Section 18.2) and do not block each other's progress reporting or UI responsiveness |
| Long-running jobs (a business with thousands of reviews under conservative pacing) | Session-style checkpointing (Section 17, Section 18) ensures a multi-hour job survives interruption exactly as a large search-extraction session does **[Base §28.1]** |
| Memory | The service worker holds only the active job's progress counters and current-batch buffer in memory; full media/review record bodies are read from IndexedDB on demand for UI display, identical to the base product's memory discipline **[Base §28.1]** |
| Cancellation | Stopping a job (Section 21) is immediate at the level of "don't start the next item" — consistent with the base product's pause semantics **[Base §18]**, the in-flight item is allowed to finish rather than being torn down mid-extraction |
| Recovery | Section 18.2's restart handling applies without a size-dependent difference — a job with 5,000 persisted reviews recovers identically to one with 50, since recovery reads job/progress metadata, not the full record set |

## 40. Error Handling

Extends the base error taxonomy **[Base §23.2]** with feature-specific instances of the same five categories — no new category is introduced:

| Category | Media example | Review example |
|---|---|---|
| Recoverable | Gallery region briefly didn't render before the stability check timed out | A single review's owner-response region didn't stabilize in time |
| Retryable | Gallery load-trigger produced a network stall | Review-feed scroll produced a stalled load |
| Non-recoverable (per-item) | A tile's underlying asset returns a broken/404 reference | A review's rating could not be parsed from its DOM region at all |
| User-action-required | User navigates away from the gallery mid-extraction | User navigates away from the reviews region mid-extraction |
| Verification | Verification interstitial appears while paging through the gallery | Verification interstitial appears while scrolling reviews |

### 40.1 Error-threshold scope

The base product's 3-consecutive-failures auto-pause **[Base §23.4]** is tracked **per track** (media, reviews) rather than jointly — three consecutive failed photos pauses the media track without affecting an already-healthy review extraction running in parallel, consistent with the independent-track design (Section 18.2, Section 20.2).

## 41. Edge Cases

| Edge case | Behavior |
|---|---|
| Invalid URL | Rejected at input time (Section 6.3), no job created |
| Search URL instead of business URL | Rejected at input time (Section 6.3) |
| Closed business (permanently or temporarily) | Media/review extraction proceeds normally against whatever content remains visible — `BusinessRecord.business_status` **[Base §10.1]** is unaffected by this feature and simply reflects whatever the base extraction already captured |
| Removed / inaccessible business (URL no longer resolves to a listing) | `detectBusinessPage`/manual-URL confirmation fails with `"Google Maps could not display a business at this URL."`; no job is created |
| No photos | `photos: []`, `mediaStatus` (photo sub-track) = `"empty"`, not an error |
| No videos | `videos: []`, same treatment |
| No reviews | `reviews: []`, `reviewStatus: "empty"` |
| Review count differs from accessible reviews | `count_discrepancy: true` (Section 16.2), status remains `"complete"` if the interface was genuinely exhausted |
| Truncated reviews | Handled per Section 13.3 |
| Deleted reviews/media (present in a prior extraction, absent on re-run) | V1 does not auto-delete previously stored records on re-extraction — a page no longer showing an item is not treated as confirmed deletion; re-running is additive/refreshing only (Section 4, Section 45 future item) |
| Duplicate media | Handled per Section 12 |
| Duplicate reviews | Handled per Section 13.4 |
| Dynamic content not loading | Recoverable/retryable per Section 40, one retry with backoff before the item/batch is marked failed |
| User navigates away | Job auto-pauses with `pauseReason: "unexpected_page_state"`, scoped to this job only — an unrelated search-extraction session, if any is separately running, is unaffected |
| Browser restart | Section 18.2's recovery flow — manual resume once the business page context is available again |
| Extension restart | Same as browser restart — job state is durable in IndexedDB independent of service-worker lifecycle |
| Storage quota issues | Same "Storage error" state as the base product **[Base §31]**, with feature-specific wording (Section 42) noting large media/review volume as a likely cause |
| Verification challenge | Hard stop, identical mechanism to the base product **[Base §16.2]** |
| Unexpected Google Maps DOM changes | Layered selector-strategy fallback (Section 9.2, reusing the base pattern **[Base §25.3]**); total failure to recognize the gallery/reviews region at all pauses that track with an "Unexpected page structure" state, not a silent empty result |
| Partial data | Preserved and exportable at all times (Section 21) |
| Failed export | Same retry-export affordance as the base product |

## 42. Acceptance Criteria

1. Given a valid Google Maps business URL, when the user pastes it and clicks `Detect & Load`, then the target confirmation (Section 18's linked BusinessRecord resolution) is shown with the business's name, address, and canonical Maps URL.
2. Given the user is viewing a Google Maps business page, when they open the popup, then a `Detected Business` card appears with `Use Current Business` available, and clicking it populates the same confirmation step as (1).
3. Given a pasted URL that matches a Maps search pattern, when the user clicks `Detect & Load`, then the input is rejected with the message defined in Section 6.3 and no job is created.
4. Given a confirmed target, extraction does not begin until the user explicitly clicks `Start Media & Review Extraction`.
5. Given a business with a photo gallery, when media extraction runs, then every distinct photo the gallery exposes across all load-trigger cycles is represented by exactly one `MediaRecord`.
6. Given a business with gallery videos, when media extraction runs, then videos are captured as `type: "video"` with duration/thumbnail when exposed, distinct from photo records.
7. Given a media item with no direct asset URL resolvable, when normalized, then `media_url` is empty, `"media_url"` appears in `missing_fields`, and `extraction_status` is `"partial"` — never a fabricated URL.
8. Given a media item with no platform-defined embed format, when normalized, then `embed_url` is exactly the literal string `"unavailable"`, never a constructed guess.
9. Given the same photo is exposed via both a grid tile and the lightbox, when deduplication runs, then only one `MediaRecord` is persisted for it.
10. Given a business's review feed, when review extraction runs, then it continues loading until three consecutive load attempts yield no new reviews, or a blocking/pausing condition occurs, and `review_summary.status` reflects which of these occurred honestly (Section 16).
11. Given a review with a "More" text-expansion control, when extracted, then the full expanded text is captured; if expansion fails, the truncated text is still captured and `"review_text_truncated"` is recorded in `error_fields`.
12. Given a review, its `rating` is always captured as a number 1-5, or the review is marked `partial` with `"rating"` in `error_fields` — never a `null`/guessed rating.
13. Given a review with an author profile link, `author_name` and `author_profile_url` are both captured; given no link, `author_profile_url` is empty without blocking the rest of the review's extraction.
14. Given a review with a resolvable absolute date, `review_date` is populated; given only a coarse relative string, `review_date` is empty while `review_relative_time` retains the original platform string.
15. Given a review with an owner response, `owner_response` is populated with both `text` and `date`; given no response, `owner_response` is `null`.
16. Given a review with attached photos, each is represented as a `MediaRecord` with `source_context: "review_media"` and `review_id` correctly linking it back to that review.
17. Given a media or review job stopped partway, all records persisted up to that point remain fully intact and exportable, and this is verifiable by comparing pre-stop and post-stop record counts in storage.
18. Given the user pauses a running job, the in-flight item finishes normally, no further items begin, and `Resume` continues from the correct next item.
19. Given the user resumes a paused job, extraction continues without re-processing already-successful items.
20. Given the user stops a job and confirms, the job status becomes `stopped` and no data is deleted.
21. Given failed media items exist, `Retry Failed Media` reprocesses only those items.
22. Given failed reviews exist, `Retry Failed Reviews` reprocesses only those items.
23. Given a completed or partial job, `Export Media as CSV` and `Export Media as JSON` both produce valid, correctly-columned/structured output per Sections 27–28.
24. Given a completed or partial job, `Export Reviews as CSV` and `Export Reviews as JSON` both produce valid output per Sections 27–28.
25. Given `Export All as JSON`, the resulting file preserves business/media/review relationships exactly as specified in Section 28.1, with review-attached media inlined under its owning review.
26. Given `Export All as CSV`, three related files are produced (Section 29.1) joined by `business_id`/`review_id` foreign key columns, with no silent data loss from the relational split.
27. Given any missing field on a media or review record, it renders as empty in storage and in exports (subject to the placeholder setting), never as a placeholder string by default.
28. Given a missing field displayed in the Media Library or Review Table, it uses the same bordered/tooltip missing-value treatment as the base Businesses table, not a new visual pattern.
29. Given one media item or one review fails extraction entirely, the job continues processing subsequent items without halting.
30. Given a verification/challenge state is detected during media or review extraction, the affected track pauses immediately with `pauseReason: "verification_required"`, and no bypass attempt of any kind occurs.
31. Given this feature is in use, the Media Library, Review Table, and both detail panels visually match the base product's existing tables, panels, buttons, inputs, and status chips with no new design tokens introduced.
32. No emoji characters appear anywhere in this feature's UI, notifications, tooltips, or copy.
33. No new browser permission beyond what the base manifest already declares is required to ship this feature (Section 6.4, Section 35.1).

## 43. UI Copy

Production-ready strings, matching the base product's professional register **[Base §17.1]**:

- `"Google Maps business detected."`
- `"Detected with reduced confidence — confirm the details below before extracting."`
- `"Not currently viewing a Google Maps business page."`
- `"This looks like a search results URL. Provide a URL for a single business."`
- `"This URL is not a Google Maps address."`
- `"Resolving shortened link..."`
- `"Ready to extract."`
- `"184 photos available."`
- `"12 videos available."`
- `"No photos found."`
- `"No videos found."`
- `"No reviews found."`
- `"Extraction paused because verification is required."`
- `"Extraction paused. The Google Maps tab navigated away from the expected page."`
- `"Review extraction completed."`
- `"Media extraction completed."`
- `"Partial extraction. Export remains available."`
- `"Some media could not be resolved."`
- `"Embed URL unavailable."`
- `"No profile link exposed."`
- `"No response from the business."`
- `"3 consecutive items failed to extract. This track has been paused so you can check the Google Maps tab before continuing."`
- `"Export complete — 3 files saved to Downloads."`
- `"Unable to save extracted data. Check available disk space."`

No informal, celebratory, or emoji-based copy appears anywhere in this feature, consistent with the base product's copy standard.

## 44. Technical Recommendations

- Implement `discoverMedia`/`discoverReviews` (Section 37) as the first concrete use of the `PlatformAdapter` interface's new optional-member pattern — this is a good opportunity to validate that pattern in production ahead of any future platform adapter relying on it.
- Reuse the base product's `idb`-wrapped IndexedDB layer **[Base §26.2]** directly for the new object stores rather than introducing a second storage abstraction.
- Implement the media/review orchestrator as a generic "job runner" parameterized over a work-item type, sharing code with (not duplicating) the base `orchestrator.ts` **[Base §25's project structure]** — concretely, extract the timing/backoff/state-machine-transition logic already in `core/engine/orchestrator.ts` into a reusable function that both `ExtractionSession` processing and `MediaReviewJob` processing call, rather than forking the file.
- Build the review-text-expansion stability check (Section 13.3) as a small, independently-testable utility (`waitForTextStabilization(element, timeoutMs)`) so it can be unit-tested against fixtures without a live page, matching the testing philosophy of the base adapter's stability checks **[Base §8.5]**.
- Add the new project-structure paths as siblings of the existing ones, not nested inside them:

```
src/
  core/
    engine/
      job-runner.ts              # generic runner shared by sessions and media/review jobs
    classification/
      media-source.ts            # Section 8.2
    dedup/
      media-fingerprint.ts       # Section 12.1
      review-fingerprint.ts      # Section 13.4
    schema/
      media-record.ts            # Section 11.1
      review-record.ts           # Section 14
  adapters/
    google-maps/
      media/
        discover-photos.ts
        discover-videos.ts
        extractors/
          media-url.ts
          embed-url.ts           # Section 11.4 policy enforced here
      reviews/
        discover-reviews.ts
        expand-review-text.ts    # Section 13.3
        extractors/
          rating.ts
          owner-response.ts
  ui/
    dashboard/
      views/
        media-library.ts         # Section 22
        review-table.ts          # Section 23
      panels/
        media-detail.ts          # Section 24
        review-detail.ts         # Section 25
```

## 45. Development Breakdown

| Phase | Scope |
|---|---|
| 1 — Foundation | `MediaReviewJob` state machine (reusing the generic job-runner), IndexedDB schema v2 migration, manual URL input + validation (Section 6), auto-detection (Section 7), target confirmation |
| 2 — Media | Photo/video discovery and extraction against the Google Maps adapter, media normalization and embed-URL policy (Section 11), media deduplication (Section 12), Media Library UI (Section 22), Media Detail panel (Section 24) |
| 3 — Reviews | Review discovery, text expansion, review normalization (Section 14), review-media linkage (Section 15), review deduplication (Section 13.4), Review Table UI (Section 23), Review Detail panel (Section 25) |
| 4 — Export | Media/review CSV and JSON export (Sections 27–29), combined export bundling, export-settings extension for the flat/denormalized CSV option (Section 30) |
| 5 — Hardening | Error-threshold-per-track (Section 40.1), verification/challenge handling validation against the shared adapter mechanism, large-dataset performance validation (Section 39), full regression pass confirming the base product's existing search-extraction flow is unaffected |

Phases are sequenced so that Phase 1 alone (without Phase 2/3) is a coherent, demoable slice (target a business, see its confirmed identity, no extraction yet) — reducing integration risk before the extraction logic itself is built.

## 46. Test Plan

Extending the base test suite **[Base §33]** with feature-specific coverage; no existing base test category is replaced.

| Test type | Coverage focus |
|---|---|
| Unit tests | Media/review normalization (Section 11, 14), embed-URL policy (never fabricates, Section 11.4), fingerprint chains (Section 12, 13.4), CSV object-flattening rule (Section 27) |
| DOM parser / extractor tests | Photo/video/review field extractors against fixture HTML covering multiple gallery/review UI layout variants, including at least one fixture exercising the text-expansion flow (13.3) and one exercising a truncated-with-no-expansion-control case |
| Job-runner tests | Verify the shared job-runner correctly drives both `ExtractionSession` and `MediaReviewJob` without regressing the base product's existing orchestration tests |
| Deduplication tests | Media: same asset exposed via grid + lightbox collapses to one record; distinct assets sharing a generic thumbnail do not incorrectly merge. Reviews: same review reappearing across scroll batches collapses to one record; two different reviews with coincidentally similar text do not incorrectly merge |
| Review-completeness tests | Simulated exhaustion (status `complete`), simulated pause mid-scroll (`partial`), simulated verification interstitial (`blocked`), simulated zero-reviews business (`empty`), simulated count mismatch producing `count_discrepancy: true` while still reaching `complete` |
| Session/job recovery tests | Simulated service-worker restart mid-job using `fake-indexeddb` **[Base §36]**, verifying no duplicate or lost media/review records across the restart boundary |
| Export tests | Media CSV and Reviews CSV round-tripped through a standard CSV parser to confirm real-world compatibility; combined JSON export validated for correct nested relationships (Section 28.1); combined CSV validated for correct FK linkage across the three files (Section 29.1) |
| UI tests | Media Library and Review Table rendering, filtering, sorting, and virtualization threshold behavior (Playwright, extension-loaded mode, consistent with base UI testing approach **[Base §36]**) |
| Error handling tests | Every taxonomy instance in Section 40's table exercised without halting the overall job except the two designed to pause it (error threshold, verification) |
| Regression tests | Full base-product test suite **[Base §36]** re-run to confirm the IndexedDB schema migration (Section 17.2) and shared job-runner refactor (Section 44) introduce no regression to existing search-extraction behavior |

---

*End of addendum. This document should be read alongside `business-lead-extraction-tool-prd.md` (V1 base PRD) — it does not stand alone as a complete product specification.*
