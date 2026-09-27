# Product Requirement Document (PRD): Lead Intelligence Engine & Niche Qualification

**Product:** Business Lead Extraction Tool — Browser Extension  
**Module:** Lead Intelligence Engine, Qualification System & UI Enhancement  
**Status:** Approved Specification  
**Design Standard:** Professional, Industrial, B2B, Minimal, Information-Dense, Strictly No Emojis  

---

## 1. Executive Summary & Product Requirement

The Business Lead Extraction Tool extracts local business leads from Google Maps. While raw extraction collects names, categories, contact points, ratings, and media, freelancers and agencies require actionable qualification signals to determine which leads match their specific offerings (e.g. Web Development, SEO, Reputation Management, Social Media Marketing, Paid Advertising).

The **Lead Intelligence Engine** transforms raw Google Maps data into an explainable, deterministic qualification layer. It replaces the narrow "Website Analysis" widget in the popup and dashboard with a multi-dimensional intelligence system spanning:
- **Online Presence** (Website, Social Profiles, Link Aggregators)
- **Contactability** (Phone presence, Address completeness)
- **Reputation & Review Metrics** (Rating tiers, Volume distribution, Owner engagement)
- **Profile Completeness** (Google Maps listing maturity and missing fields)
- **Activity Signals** (Operational status, Recent review presence)
- **Niche-Agnostic Opportunity Scores & Signals** (Tailored to specific freelancer/agency services)

---

## 2. Current UI Problem & Motivation

### Current Limitations:
1. **Overly Narrow Scope**: The existing popup displays only a 3-row "Website Analysis" block (Website / Social Only / No Website).
2. **Missing Business Signals**: Critical qualification data extracted from Google Maps (review volume, star ratings, phone availability, listing completeness, operating status) is omitted from the initial summary.
3. **Implicit Web-Dev Bias**: The UI previously assumed all users sell websites. Service providers in SEO, reputation management, photography, and advertising had no immediate visibility into signals relevant to their niches.
4. **Lack of Explainability**: No mechanism existed to explain *why* a business is considered high or low opportunity.

---

## 3. Lead Intelligence Concept & Core Architecture

The Lead Intelligence engine operates on a clean separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW EXTRACTED DATA                       │
│  (BusinessRecord, MediaRecord, ReviewRecord in IndexedDB)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Read-only, Unmutated)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   LEAD INTELLIGENCE ENGINE                  │
│       (Deterministic, Pure-Function Scoring Layer)          │
│                                                             │
│  ├─ 1. Online Presence Evaluator                            │
│  ├─ 2. Contactability Evaluator                             │
│  ├─ 3. Reputation & Volume Evaluator                        │
│  ├─ 4. Profile Completeness Evaluator                       │
│  ├─ 5. Activity & Freshness Evaluator                       │
│  └─ 6. Niche Profile Opportunity Matrix                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│     UI RENDERING      │             │   DELIVERABLE EXPORT  │
│  - Popup Summary      │             │  - CSV with Signals   │
│  - Dashboard Tab      │             │  - JSON Nested Schema │
│  - Business Table     │             └───────────────────────┘
└───────────────────────┘
```

---

## 4. Raw Data Model vs. Derived Data Model

### 4.1 Raw Extracted Model (`BusinessRecord` — Immutable)
Raw fields extracted directly from Google Maps DOM are preserved without mutation:
- `business_name: string`
- `primary_category: string`, `secondary_categories: string[]`
- `rating: number | null`, `review_count: number | null`, `price_level: PriceLevel`
- `address: string`, `phone: string`, `website: string`, `website_status: WebsiteStatus`
- `social_links: string[]`, `maps_url: string`, `place_identifier: string | null`
- `opening_hours: OpeningHourItem[] | null`, `business_status: BusinessStatus`
- `description: string | null`, `service_options: string[]`, `attributes: string[]`
- `missing_fields: string[]`, `error_fields: string[]`

### 4.2 Derived Lead Intelligence Model (`BusinessLeadIntelligence`)
```typescript
export type OpportunityLevel = "high" | "medium" | "low" | "none";

export interface SignalExplanation {
  id: string;
  label: string;
  category: "online_presence" | "contactability" | "reputation" | "profile" | "activity" | "opportunity";
  description: string;
  evidence: string;
}

export interface NicheQualification {
  profileId: string;
  profileName: string;
  opportunityLevel: OpportunityLevel;
  matchedSignals: string[];
  reasons: string[];
}

export interface BusinessLeadIntelligence {
  // Digital Maturity Score (0 - 100)
  digitalMaturityScore: number;
  
  // Categorical Classifications
  onlinePresenceType: "website_and_social" | "website_only" | "social_only" | "no_presence";
  contactabilityTier: "complete" | "phone_only" | "address_only" | "unreachable";
  reputationTier: "excellent" | "good" | "poor" | "unreviewed";
  reviewVolumeTier: "high" | "moderate" | "low" | "none";
  profileCompletenessPercentage: number;
  
  // Deterministic Active Signals
  signals: SignalExplanation[];
  
  // Service-Specific Evaluation
  nicheQualifications: Record<string, NicheQualification>;
}
```

---

## 5. Lead Signal Engine & Deterministic Rules

The Lead Signal Engine calculates discrete, explainable signals using exact conditions:

### 5.1 Online Presence Signals
| Signal ID | Label | Condition | Evidence / Explanation |
| :--- | :--- | :--- | :--- |
| `sig_no_website` | No Website | `website_status === "none"` | No conventional website domain detected. |
| `sig_social_only` | Social Only | `website_status === "social_only"` | Relies exclusively on social platforms (e.g. Instagram, Facebook). |
| `sig_web_and_social` | Website + Social | `website_status === "website" && social_links.length > 0` | Maintains dedicated domain and linked social channels. |
| `sig_no_social` | No Social Links | `social_links.length === 0` | No social media presence found on listing. |

### 5.2 Contactability Signals
| Signal ID | Label | Condition | Evidence / Explanation |
| :--- | :--- | :--- | :--- |
| `sig_phone_available` | Phone Available | `phone.length >= 6` | Valid direct telephone number available. |
| `sig_phone_missing` | Phone Missing | `!phone || phone.trim() === ""` | No telephone contact listed on Google Maps. |
| `sig_full_contact` | Full Contact Info | `phone.length >= 6 && address.length >= 5` | Both phone and physical address are accessible. |

### 5.3 Reputation & Volume Signals
| Signal ID | Label | Condition | Evidence / Explanation |
| :--- | :--- | :--- | :--- |
| `sig_rating_excellent` | Rating 4.5+ | `rating !== null && rating >= 4.5` | Highly rated by customer base. |
| `sig_rating_poor` | Rating Below 4.0 | `rating !== null && rating < 4.0 && rating > 0` | Low customer rating presents reputation repair opportunity. |
| `sig_reviews_high` | 100+ Reviews | `review_count !== null && review_count >= 100` | Strong public proof and established customer flow. |
| `sig_reviews_low` | 10 or Fewer Reviews | `review_count !== null && review_count <= 10` | Low review volume indicates need for review generation. |
| `sig_unreviewed` | No Reviews | `review_count === null || review_count === 0` | Listing has zero verified customer feedback. |

### 5.4 Profile Completeness Signals
| Signal ID | Label | Condition | Evidence / Explanation |
| :--- | :--- | :--- | :--- |
| `sig_profile_complete` | Complete Profile | `missing_fields.length === 0` | All core business fields populated on listing. |
| `sig_profile_incomplete` | Incomplete Profile | `missing_fields.length > 0` | Profile is missing one or more standard information fields. |
| `sig_hours_missing` | Hours Missing | `missing_fields.includes("hours")` | Operating hours schedule is not listed. |
| `sig_description_missing` | Description Missing | `missing_fields.includes("description")` | Business description or editorial summary is unpopulated. |

### 5.5 High-Value Compound Opportunity Signals
| Signal ID | Label | Condition | Evidence / Explanation |
| :--- | :--- | :--- | :--- |
| `sig_opp_high_rev_no_site` | High Reviews / No Website | `review_count >= 50 && website_status === "none"` | Established business with proven customer demand but no web presence. |
| `sig_opp_high_rate_no_site` | High Rating / No Website | `rating >= 4.5 && website_status === "none"` | Quality business lacking digital conversion portal. |
| `sig_opp_high_rev_social` | High Reviews / Social Only | `review_count >= 50 && website_status === "social_only"` | Active customer volume relying solely on third-party social profiles. |
| `sig_opp_low_rate_high_rev` | Low Rating / Active Volume | `rating < 4.0 && review_count >= 30` | Active customer flow suffering from reputation issues. |
| `sig_opp_incomplete_active` | Incomplete / Active Reviews | `missing_fields.length >= 2 && review_count >= 20` | Active business with poorly maintained Google profile. |

---

## 6. Scoring Architecture: Digital Maturity & Niche Opportunities

### 6.1 Base Digital Maturity Score (0 - 100)
Measures the listing's digital completeness and public footprint:
- **Website Presence**: +30 pts (Dedicated site: 30 pts, Social only: 15 pts, None: 0 pts)
- **Direct Contactability**: +25 pts (Phone: 15 pts, Physical address: 10 pts)
- **Reputation Maturity**: +25 pts (Rating >= 4.0: 15 pts, Rating >= 3.0: 10 pts; Review Count >= 50: 10 pts, >= 10: 5 pts)
- **Profile Completeness**: +20 pts (Hours: 5 pts, Description/Attributes: 5 pts, Social links: 5 pts, Category/Maps: 5 pts)

### 6.2 Service-Specific Niche Profiles

The user can select an active **Lead Profile** to evaluate opportunities from their service perspective:

```typescript
export interface NicheProfileDefinition {
  id: string;
  name: string;
  targetDescription: string;
  evaluateOpportunity: (record: BusinessRecord, intel: BusinessLeadIntelligence) => NicheQualification;
}
```

#### Predefined Niche Profiles:
1. **Web Development & Design**:
   - *High Opportunity*: `website_status === "none"` OR `website_status === "social_only"` with `review_count >= 20` or `rating >= 4.2`.
   - *Reason*: Established business with customer volume that lacks a proper conversion website.
2. **SEO & Local Search (GBP Optimization)**:
   - *High Opportunity*: Incomplete profile (`missing_fields >= 2`), missing description/hours, or low review volume (`review_count < 25`) with active operational status.
   - *Reason*: Untapped search visibility and unoptimized local profile.
3. **Reputation Management**:
   - *High Opportunity*: `rating < 4.0` with `review_count >= 15` OR `review_count <= 5`.
   - *Reason*: Negative sentiment impacting customer conversion or lack of review generation.
4. **Social Media Marketing**:
   - *High Opportunity*: `social_links.length === 0` on businesses with `review_count >= 20` OR `website_status === "social_only"` (unoptimized social setup).
   - *Reason*: Missing social distribution or reliance on unmanaged profiles.
5. **Paid Advertising & Lead Generation**:
   - *High Opportunity*: Strong website + phone available + rating >= 4.0 + reviews >= 30.
   - *Reason*: Established infrastructure ready for paid traffic and customer acquisition scaling.
6. **General Lead Qualification**:
   - *Balanced Matrix*: Highlights verified phone + address + operational status.

---

## 7. Popup UI Specification

The popup section replaces the legacy "Website Analysis" block with a compact, structured Lead Intelligence widget.

### 7.1 Layout Wireframe (380px Width)
```
┌─────────────────────────────────────────────────────────────┐
│ LEAD INTELLIGENCE                                           │
├─────────────────────────────────────────────────────────────┤
│ ONLINE PRESENCE                                             │
│   Website                                                19 │
│   Social Only                                             1 │
│   No Website                                             53 │
├─────────────────────────────────────────────────────────────┤
│ CONTACTABILITY                                              │
│   Phone Available                                        67 │
│   Phone Missing                                           6 │
├─────────────────────────────────────────────────────────────┤
│ REPUTATION                                                  │
│   Rating 4.5+                                            41 │
│   Rating Under 4.0                                        9 │
│   100+ Reviews                                           18 │
│   10 or Fewer Reviews                                    14 │
├─────────────────────────────────────────────────────────────┤
│ PROFILE COMPLETENESS                                        │
│   Complete Listing                                       52 │
│   Incomplete Listing                                     21 │
├─────────────────────────────────────────────────────────────┤
│ TOP OPPORTUNITIES                                           │
│   No Website                                             53 │
│   High Reviews / No Site                                 12 │
│   Low Rating Repair                                       9 │
├─────────────────────────────────────────────────────────────┤
│ [ Open Lead Intelligence Dashboard ]                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Styling & Hierarchy
- Uses existing design system tokens (`--color-bg-surface`, `--color-border`, `--color-text-primary`, `--color-accent`).
- Numbers formatted using `.tabular-nums` for clean visual alignment.
- Semantic indicators:
  - Green (`--color-success`): Positive status (Website, Phone Available, Rating 4.5+, Complete).
  - Amber (`--color-warning`): Moderate opportunity (Social Only, 10 or Fewer Reviews, Incomplete).
  - Red/Neutral (`--color-error` / `--color-text-secondary`): Critical opportunity (No Website, Low Rating, Phone Missing).
- Clicking `[ Open Lead Intelligence Dashboard ]` opens the full dashboard focused on the Lead Intelligence view.

---

## 8. Full Lead Intelligence Dashboard Specification

The full dashboard integrates a dedicated **Lead Intelligence** tab alongside enhanced filtering in the Businesses table.

### 8.1 Dashboard Layout & Components

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Navigation: [Businesses] [Media Library] [Reviews] [Overview] [Lead Intelligence] [Sessions]  │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Active Lead Profile: [ Web Development ▼ ]   Showing opportunities tailored to: Website Sales  │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐ │
│ │ ONLINE PRESENCE      │ │ CONTACTABILITY       │ │ REPUTATION           │ │ PROFILE HEALTH │ │
│ │ Website:         19  │ │ Phone Listed:    67  │ │ Avg Rating:     4.6  │ │ Complete:  52  │ │
│ │ Social Only:      1  │ │ Phone Missing:    6  │ │ 4.5+ Stars:     41  │ │ Missing Hours: 14│ │
│ │ No Website:      53  │ │ Full Address:    72  │ │ <4.0 Stars:      9  │ │ Missing Desc:  18│ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ NICHE QUALIFICATION BREAKDOWN                                                                 │
│ ┌──────────────────────────────────────┐ ┌──────────────────────────────────────────────────┐ │
│ │ High Opportunity Leads:           28 │ │ Matched Signals Distribution:                    │ │
│ │ Medium Opportunity Leads:         19 │ │ • High Reviews / No Website: 12 businesses        │ │
│ │ Low Opportunity Leads:            26 │ │ • Social Only / High Volume:  1 business         │ │
│ └──────────────────────────────────────┘ └──────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ QUICK FILTER PRESETS:                                                                         │
│ [ All Leads (73) ]  [ No Website (53) ]  [ High Reviews / No Site (12) ]  [ Needs Reputation (9) ] │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ QUALIFIED LEADS TABLE                                                                         │
│ [Search Leads...] [Profile Filter ▼] [Rating Filter ▼] [Website Filter ▼] [Columns ▼]          │
│ ┌──────┬──────────────────────┬─────────┬─────────┬──────────────┬──────────────┬───────────┐ │
│ │ Score│ Business Name        │ Category│ Rating  │ Website      │ Phone        │ Signals   │ │
│ ├──────┼──────────────────────┼─────────┼─────────┼──────────────┼──────────────┼───────────┤ │
│ │  45  │ Sai Laser Clinic     │ Dentist │ 4.9(142)│ None         │ +91 9938...  │ [No Site] │ │
│ │      │                      │         │         │              │              │ [High Rev]│ │
│ └──────┴──────────────────────┴─────────┴─────────┴──────────────┴──────────────┴───────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Business Table Integration & Signal Explainability

### 9.1 Column Customization
The `BusinessesTable` component supports configurable columns:
- `Score` (Digital maturity 0-100 with High/Medium/Low opportunity badge)
- `Business Name`
- `Category`
- `Rating & Reviews`
- `Phone`
- `Website Status` (Website / Social Only / None / Website+Social)
- `Lead Signals` (Interactive badges)
- `Extraction Status`

### 9.2 Signal Tooltip & Explanation Modal
Clicking on any signal badge (e.g. `[High Reviews / No Website]`) displays an explainable diagnostic popover:

```
┌──────────────────────────────────────────────────────┐
│ SIGNAL: HIGH REVIEWS / NO WEBSITE                    │
├──────────────────────────────────────────────────────┤
│ Category: High Opportunity (Web Development)         │
│ Evidence:                                            │
│ • Review count: 142 verified customer reviews        │
│ • Star rating: 4.9 / 5.0                             │
│ • Website status: No conventional website detected   │
│                                                      │
│ Qualification Note:                                  │
│ This business has strong local customer demand but   │
│ lacks a dedicated website, making it a prime         │
│ candidate for website design and lead funnel setup.  │
└──────────────────────────────────────────────────────┘
```

---

## 10. Multi-Condition Filter Builder

The system includes a composable in-memory filter engine operating on both raw fields and derived signals:

```typescript
export interface LeadFilterCriteria {
  searchQuery?: string;
  nicheProfileId?: string;
  opportunityLevel?: OpportunityLevel | "all";
  websiteStatus?: WebsiteStatus | "all" | "website_and_social";
  hasPhone?: boolean | "all";
  minRating?: number;
  maxRating?: number;
  minReviews?: number;
  maxReviews?: number;
  profileStatus?: "complete" | "incomplete" | "all";
  requiredSignals?: string[];
  category?: string | "all";
}
```

---

## 11. Export Integration (CSV and JSON)

### 11.1 CSV Export (RFC 4180 + UTF-8 BOM)
When the user checks "Include Lead Intelligence in Export", the CSV serializer appends canonical derived columns:
- `lead_score`: Digital Maturity Score (0-100)
- `opportunity_level`: high / medium / low / none
- `niche_profile`: active profile name (e.g. Web Development)
- `contactability_tier`: complete / phone_only / address_only / unreachable
- `lead_signals`: Semicolon-delimited list of active signal labels (e.g. `No Website; 100+ Reviews; Rating 4.5+; Phone Available`)

### 11.2 JSON Export Format
The JSON serializer nests the structured `lead_intelligence` object within each business record without altering existing root properties:

```json
{
  "export_metadata": {
    "export_timestamp": "2026-09-09T15:45:00.000Z",
    "total_records": 73,
    "lead_profile_applied": "web_development"
  },
  "businesses": [
    {
      "record_id": "9f1d2e3c-...",
      "business_name": "Sai Laser Dental Clinic",
      "primary_category": "Dental clinic",
      "rating": 4.9,
      "review_count": 142,
      "phone": "+91 99385 30308",
      "website": "",
      "website_status": "none",
      "lead_intelligence": {
        "digital_maturity_score": 45,
        "opportunity_level": "high",
        "niche_profile": "web_development",
        "online_presence_type": "no_presence",
        "contactability_tier": "complete",
        "reputation_tier": "excellent",
        "review_volume_tier": "high",
        "profile_completeness_pct": 75,
        "signals": [
          "no_website",
          "rating_4_5_plus",
          "100_plus_reviews",
          "phone_available",
          "opp_high_reviews_no_site"
        ]
      }
    }
  ]
}
```

---

## 12. Performance & Resilience Guidelines

1. **Pure Function Computation**: Calculations execute in-memory in `< 2ms` for 500 records via `computeLeadIntelligence()`.
2. **No Storage Bloat**: IndexedDB stores only clean raw `BusinessRecord` entities; derived scores are never persisted unnecessarily, preventing database migrations or stale cached evaluations.
3. **Memoized Aggregations**: Dashboard metrics aggregate in Preact via `useMemo()`, recalculating only when `records` or the active `nicheProfile` changes.
4. **Strict Design Discipline**: Absolutely NO emojis, childish animations, or unnecessary third-party styling frameworks.

---

## 13. Implementation Roadmap

| Phase | Milestone | Scope of Work |
| :--- | :--- | :--- |
| **Phase 1** | **Core Intelligence Engine** | Implement `src/core/classification/lead-intelligence.ts` with pure calculation functions, signal rules, digital maturity scoring, and niche profiles. |
| **Phase 2** | **Popup UI Upgrade** | Replace Website Analysis in `popup.html` and `popup.ts` with the compact Lead Intelligence widget and category counters. |
| **Phase 3** | **Dashboard Lead Intelligence Tab** | Create dedicated tab in `dashboard.html` / `dashboard.ts` with metric cards, niche profile selector, and signal filters. |
| **Phase 4** | **Businesses Table Integration** | Enhance `BusinessesTable.tsx` to render Score badges, signal tags, and tooltip explanations. |
| **Phase 5** | **Export Pipeline Integration** | Update `csv.ts` and `json.ts` to serialize lead intelligence metadata. |
| **Phase 6** | **Unit & Integration Testing** | Add comprehensive Vitest suites covering scoring, signal accuracy, and niche profiles. |
