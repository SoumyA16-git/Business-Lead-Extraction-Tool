/**
 * Interactive Preact Businesses Table Component with Lead Intelligence Integration
 * Defined in PRD: Lead Intelligence Engine & Dashboard
 */

import { Fragment } from "preact";
import { useState, useMemo } from "preact/hooks";
import { BusinessRecord, ExtractionStatus, WebsiteStatus } from "../../../core/schema/business-record";
import {
  computeLeadIntelligence,
  NICHE_PROFILES,
  OpportunityLevel,
  SignalExplanation,
} from "../../../core/classification/lead-intelligence";

interface BusinessesTableProps {
  records: BusinessRecord[];
  activeNicheProfileId?: string;
  onNicheProfileChange?: (profileId: string) => void;
  onExplainSignal?: (signal: SignalExplanation) => void;
  onViewMediaReviews?: (record: BusinessRecord) => void;
  onOpenWhatsAppOutreach?: () => void;
}

type SortField =
  | "business_name"
  | "primary_category"
  | "score"
  | "opportunity"
  | "rating"
  | "address"
  | "phone"
  | "website_status"
  | "extraction_status";

export function BusinessesTable({
  records,
  activeNicheProfileId = "general",
  onNicheProfileChange,
  onExplainSignal,
  onViewMediaReviews,
  onOpenWhatsAppOutreach,
}: BusinessesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState(activeNicheProfileId);
  const [opportunityFilter, setOpportunityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [missingFieldFilter, setMissingFieldFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("business_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const noWebsiteLeadsCount = useMemo(() => {
    return records.filter(
      (r) =>
        r.website_status === "none" &&
        ((r.phone_normalized && r.phone_normalized.length >= 8) ||
          (r.phone && r.phone.length >= 8))
    ).length;
  }, [records]);

  // Compute Lead Intelligence for all records
  const recordsWithIntel = useMemo(() => {
    return records.map((rec) => {
      const intel = computeLeadIntelligence(rec, selectedNiche);
      return {
        record: rec,
        intel,
      };
    });
  }, [records, selectedNiche]);

  // Filtered and sorted records
  const filteredItems = useMemo(() => {
    return recordsWithIntel
      .filter(({ record: rec, intel }) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            rec.business_name.toLowerCase().includes(q) ||
            rec.primary_category.toLowerCase().includes(q) ||
            rec.address.toLowerCase().includes(q) ||
            rec.phone.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Opportunity filter
        if (opportunityFilter !== "all") {
          if (opportunityFilter === "high" && intel.activeNiche.opportunityLevel !== "high") return false;
          if (opportunityFilter === "medium" && intel.activeNiche.opportunityLevel !== "medium") return false;
          if (opportunityFilter === "low" && intel.activeNiche.opportunityLevel !== "low") return false;
          if (opportunityFilter === "no_website" && rec.website_status !== "none") return false;
          if (opportunityFilter === "social_only" && rec.website_status !== "social_only") return false;
          if (opportunityFilter === "repair_needed") {
            const hasPoorRating = rec.rating !== null && rec.rating < 4.0 && (rec.review_count || 0) >= 10;
            if (!hasPoorRating) return false;
          }
        }

        // Status filter
        if (statusFilter !== "all" && rec.extraction_status !== statusFilter) {
          return false;
        }

        // Missing field filter
        if (missingFieldFilter !== "all") {
          if (!rec.missing_fields.includes(missingFieldFilter)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortField === "score") {
          valA = a.intel.digitalMaturityScore;
          valB = b.intel.digitalMaturityScore;
        } else if (sortField === "opportunity") {
          const oppWeights: Record<OpportunityLevel, number> = { high: 3, medium: 2, low: 1, none: 0 };
          valA = oppWeights[a.intel.activeNiche.opportunityLevel];
          valB = oppWeights[b.intel.activeNiche.opportunityLevel];
        } else {
          valA = a.record[sortField];
          valB = b.record[sortField];
        }

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return sortAsc ? -1 : 1;
        return sortAsc ? 1 : -1;
      });
  }, [recordsWithIntel, searchQuery, opportunityFilter, statusFilter, missingFieldFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for scores and ratings
    }
  };

  const handleNicheChange = (profileId: string) => {
    setSelectedNiche(profileId);
    if (onNicheProfileChange) {
      onNicheProfileChange(profileId);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const renderScoreBadge = (score: number) => {
    let scoreClass = "score-low";
    if (score >= 70) scoreClass = "score-high";
    else if (score >= 40) scoreClass = "score-med";

    return (
      <span class={`score-badge ${scoreClass} tabular-nums`} title={`Digital Maturity Score: ${score}/100`}>
        {score}
      </span>
    );
  };

  const renderOpportunityBadge = (level: OpportunityLevel) => {
    let chipClass = "chip-neutral";
    if (level === "high") chipClass = "chip-success";
    else if (level === "medium") chipClass = "chip-warning";

    return <span class={`chip ${chipClass}`}>{level.toUpperCase()}</span>;
  };

  const renderStatusChip = (status: ExtractionStatus) => {
    let chipClass = "chip-neutral";
    if (status === "complete") chipClass = "chip-success";
    else if (status === "partial") chipClass = "chip-warning";
    else if (status === "failed") chipClass = "chip-error";

    return <span class={`chip ${chipClass}`}>{status}</span>;
  };

  const renderWebsiteChip = (status: WebsiteStatus, url: string) => {
    if (status === "website") {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" class="chip chip-success">
          Website ↗
        </a>
      );
    }
    if (status === "social_only") {
      return <span class="chip chip-warning">Social Only</span>;
    }
    return <span class="chip chip-neutral">None</span>;
  };

  return (
    <div class="businesses-view">
      {/* Table Toolbar */}
      <div class="table-toolbar" style={{ flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
        {/* Row 1: Search and Primary Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, minWidth: "320px" }}>
            <input
              type="text"
              class="search-input"
              placeholder="Search business name, category, phone, address..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              style={{ flex: 1 }}
            />

            {/* Niche Profile Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label class="field-label" style={{ fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>
                Niche Fit:
              </label>
              <select
                class="input-sm"
                value={selectedNiche}
                onChange={(e) => handleNicheChange((e.target as HTMLSelectElement).value)}
                style={{ fontWeight: 500 }}
              >
                {Object.values(NICHE_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div class="toolbar-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {noWebsiteLeadsCount > 0 && onOpenWhatsAppOutreach && (
              <button
                type="button"
                class="btn btn-primary btn-sm"
                style={{ fontSize: "11px", padding: "3px 10px", whiteSpace: "nowrap" }}
                onClick={onOpenWhatsAppOutreach}
                title="Open WhatsApp Outreach tab to message leads without websites"
              >
                WhatsApp Outreach ({noWebsiteLeadsCount})
              </button>
            )}
            <span class="text-caption text-secondary tabular-nums">
              Showing {filteredItems.length} of {records.length} records
            </span>
          </div>
        </div>

        {/* Row 2: Qualification Opportunity Filters */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div class="filter-chip-group">
            <span class="text-caption text-secondary" style={{ marginRight: "4px", fontSize: "11px", fontWeight: 500 }}>
              Opportunity:
            </span>
            {[
              { id: "all", label: "ALL" },
              { id: "high", label: "HIGH FIT" },
              { id: "medium", label: "MEDIUM FIT" },
              { id: "low", label: "LOW FIT" },
              { id: "no_website", label: "NO WEBSITE" },
              { id: "social_only", label: "SOCIAL ONLY" },
              { id: "repair_needed", label: "NEEDS REPAIR" },
            ].map((of) => (
              <button
                key={of.id}
                class={`filter-chip ${opportunityFilter === of.id ? "active" : ""}`}
                onClick={() => setOpportunityFilter(of.id)}
              >
                {of.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", marginLeft: "auto", alignItems: "center" }}>
            {/* Extraction Status Filter Dropdown */}
            <select
              class="input-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
            >
              <option value="all">All Statuses</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="duplicate">Duplicate</option>
            </select>

            {/* Missing Field Filter Dropdown */}
            <select
              class="input-sm"
              value={missingFieldFilter}
              onChange={(e) => setMissingFieldFilter((e.target as HTMLSelectElement).value)}
            >
              <option value="all">Any Missing Fields</option>
              <option value="phone">Missing Phone</option>
              <option value="website">Missing Website</option>
              <option value="rating">Missing Rating</option>
              <option value="opening_hours">Missing Hours</option>
              <option value="description">Missing Description</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="table-container">
        <table class="leads-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("business_name")}>
                Business Name {sortField === "business_name" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th onClick={() => handleSort("primary_category")}>
                Category {sortField === "primary_category" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th onClick={() => handleSort("score")} title="Digital Maturity Score (0-100)">
                Score {sortField === "score" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th onClick={() => handleSort("opportunity")} title="Qualification fit for active niche profile">
                Opportunity {sortField === "opportunity" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th>Lead Signals</th>
              <th onClick={() => handleSort("rating")}>
                Rating {sortField === "rating" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th onClick={() => handleSort("phone")}>
                Phone {sortField === "phone" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th>WhatsApp</th>
              <th onClick={() => handleSort("website_status")}>
                Web {sortField === "website_status" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
              <th onClick={() => handleSort("extraction_status")}>
                Status {sortField === "extraction_status" ? (sortAsc ? "▲" : "▼") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "32px" }}>
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              filteredItems.map(({ record: rec, intel }) => {
                const isExpanded = expandedRowId === rec.record_id;
                return (
                  <Fragment key={rec.record_id}>
                    <tr onClick={() => toggleRow(rec.record_id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 500 }}>
                        <span style={{ display: "inline-block", width: "16px", color: "var(--color-text-secondary)" }}>
                          {isExpanded ? "v" : ">"}
                        </span>
                        {rec.business_name}
                      </td>
                      <td>{rec.primary_category}</td>
                      <td>{renderScoreBadge(intel.digitalMaturityScore)}</td>
                      <td>{renderOpportunityBadge(intel.activeNiche.opportunityLevel)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "260px" }}>
                          {intel.signals.slice(0, 3).map((sig) => (
                            <span
                              key={sig.id}
                              class={`signal-tag ${sig.category === "opportunity" ? "signal-tag-highlight" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onExplainSignal) onExplainSignal(sig);
                              }}
                              title={`${sig.label}: Click to view explanation`}
                            >
                              {sig.label}
                            </span>
                          ))}
                          {intel.signals.length > 3 && (
                            <span class="text-micro text-secondary" style={{ alignSelf: "center" }}>
                              +{intel.signals.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td class="tabular-nums">
                        {rec.rating ? `${rec.rating.toFixed(1)} (${rec.review_count || 0})` : "-"}
                      </td>
                      <td class="tabular-nums">{rec.phone_normalized || rec.phone || "-"}</td>
                      <td>
                        {rec.whatsapp_link ? (
                          <a
                            href={rec.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="chip chip-success"
                            style={{ textDecoration: "none", fontSize: "11px", padding: "2px 8px" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Chat
                          </a>
                        ) : (
                          <span class="text-secondary">-</span>
                        )}
                      </td>
                      <td>{renderWebsiteChip(rec.website_status, rec.website)}</td>
                      <td>{renderStatusChip(rec.extraction_status)}</td>
                    </tr>

                    {/* Inline Expanded Detail Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} class="row-expand-content">
                          <div class="record-details-grid">
                            {/* Lead Qualification Box */}
                            <div
                              style={{
                                gridColumn: "1 / -1",
                                backgroundColor: "var(--color-bg-app)",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)",
                                marginBottom: "8px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <strong>
                                  Niche Fit ({intel.activeNiche.profileName}):{" "}
                                  <span
                                    class={`chip ${
                                      intel.activeNiche.opportunityLevel === "high"
                                        ? "chip-success"
                                        : intel.activeNiche.opportunityLevel === "medium"
                                        ? "chip-warning"
                                        : "chip-neutral"
                                    }`}
                                  >
                                    {intel.activeNiche.opportunityLevel.toUpperCase()} FIT
                                  </span>
                                </strong>
                                <span class="text-caption text-secondary">
                                  Digital Maturity: <strong>{intel.digitalMaturityScore} / 100</strong>
                                </span>
                              </div>

                              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                                {intel.activeNiche.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>

                              {/* All Active Signals */}
                              <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                                <span class="text-micro text-secondary" style={{ fontWeight: 600 }}>
                                  ALL DETECTED SIGNALS:
                                </span>
                                {intel.signals.map((sig) => (
                                  <button
                                    key={sig.id}
                                    type="button"
                                    class="signal-tag"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onExplainSignal) onExplainSignal(sig);
                                    }}
                                  >
                                    {sig.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div class="detail-item">
                              <span class="detail-item-label">Full Address:</span>
                              <span>{rec.address || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Phone (Raw):</span>
                              <span>{rec.phone_raw || rec.phone || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Phone (Normalized):</span>
                              <span>{rec.phone_normalized || rec.phone || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Country Calling Info:</span>
                              <span>
                                {rec.phone_country ? `${rec.phone_country} (${rec.phone_country_calling_code || "-"}) · Source: ${rec.phone_country_source || "unknown"}` : "None"}
                              </span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Website URL:</span>
                              <span>{rec.website || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Social Profile Links:</span>
                              <span>{rec.social_links?.join(", ") || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Business Status:</span>
                              <span>{rec.business_status}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Coordinates / Plus Code:</span>
                              <span>
                                {rec.latitude && rec.longitude
                                  ? `${rec.latitude}, ${rec.longitude}`
                                  : "None"}{" "}
                                {rec.plus_code ? `(${rec.plus_code})` : ""}
                              </span>
                            </div>
                            {rec.whatsapp_link && (
                              <div class="detail-item" style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", alignItems: "center", padding: "8px 0" }}>
                                <span class="detail-item-label">WhatsApp:</span>
                                <a
                                  href={rec.whatsapp_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="url-text"
                                  style={{ fontWeight: 600, color: "var(--color-success)" }}
                                >
                                  {rec.whatsapp_link}
                                </a>
                                <button
                                  type="button"
                                  class="btn btn-secondary btn-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(rec.whatsapp_link || "");
                                  }}
                                >
                                  Copy WhatsApp Link
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-secondary btn-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(rec.phone_normalized || rec.phone || "");
                                  }}
                                >
                                  Copy Phone
                                </button>
                              </div>
                            )}
                            <div class="detail-item">
                              <span class="detail-item-label">Missing Fields:</span>
                              <span class="text-error">{rec.missing_fields?.join(", ") || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Error Fields:</span>
                              <span class="text-warning">{rec.error_fields?.join(", ") || "None"}</span>
                            </div>
                            <div class="detail-item">
                              <span class="detail-item-label">Attributes / Service Options:</span>
                              <span>
                                {[...(rec.service_options || []), ...(rec.attributes || [])].join(", ") ||
                                  "None"}
                              </span>
                            </div>
                            <div class="detail-item" style={{ gridColumn: "1 / -1", marginTop: "10px", display: "flex", gap: "12px", alignItems: "center" }}>
                              {onViewMediaReviews && (
                                <button
                                  type="button"
                                  class="btn btn-primary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewMediaReviews(rec);
                                  }}
                                >
                                  View Media & Reviews
                                </button>
                              )}
                              <a
                                href={rec.maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="url-text"
                              >
                                View on Google Maps ↗
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
