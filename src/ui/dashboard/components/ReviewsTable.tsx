/**
 * Interactive Preact Reviews Table Component
 * Defined in PRD Addendum Section 23, 25, 26
 */

import { useState, useMemo } from "preact/hooks";
import { ReviewRecord } from "../../../core/schema/review-record";

interface ReviewsTableProps {
  reviewRecords: ReviewRecord[];
  onExportCsv?: () => void;
  onExportJson?: () => void;
}

export function ReviewsTable({ reviewRecords, onExportCsv, onExportJson }: ReviewsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [hasResponseFilter, setHasResponseFilter] = useState<string>("all");
  const [hasPhotosFilter, setHasPhotosFilter] = useState<string>("all");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filteredReviews = useMemo(() => {
    return reviewRecords.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.author_name.toLowerCase().includes(q) ||
          r.review_text.toLowerCase().includes(q) ||
          (r.owner_response?.text && r.owner_response.text.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (ratingFilter !== "all") {
        const minRating = parseFloat(ratingFilter);
        if (Math.floor(r.rating) !== minRating) return false;
      }

      if (hasResponseFilter === "yes" && !r.owner_response) return false;
      if (hasResponseFilter === "no" && r.owner_response) return false;

      if (hasPhotosFilter === "yes" && (!r.media || r.media.length === 0)) return false;
      if (hasPhotosFilter === "no" && r.media && r.media.length > 0) return false;

      return true;
    });
  }, [reviewRecords, searchQuery, ratingFilter, hasResponseFilter, hasPhotosFilter]);

  const renderStars = (rating: number) => {
    return (
      <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }} class="tabular-nums">
        {rating.toFixed(1)} / 5.0
      </span>
    );
  };

  return (
    <div class="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div class="card-header-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>Customer Reviews</h3>
          <p class="section-desc">
            Displaying {filteredReviews.length} of {reviewRecords.length} customer reviews extracted from Google Maps.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {onExportCsv && (
            <button class="btn btn-secondary btn-sm" onClick={onExportCsv} disabled={reviewRecords.length === 0}>
              Export Reviews CSV
            </button>
          )}
          {onExportJson && (
            <button class="btn btn-primary btn-sm" onClick={onExportJson} disabled={reviewRecords.length === 0}>
              Export Combined JSON
            </button>
          )}
        </div>
      </div>

      {/* Toolbar filters */}
      <div class="table-toolbar" style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          class="search-input"
          style={{ width: "240px" }}
          placeholder="Search author or review text..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
        />

        <div class="filter-group">
          <label class="filter-label">Rating:</label>
          <select
            class="filter-select"
            value={ratingFilter}
            onChange={(e) => setRatingFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Owner Response:</label>
          <select
            class="filter-select"
            value={hasResponseFilter}
            onChange={(e) => setHasResponseFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All</option>
            <option value="yes">Has Response</option>
            <option value="no">No Response</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Photos:</label>
          <select
            class="filter-select"
            value={hasPhotosFilter}
            onChange={(e) => setHasPhotosFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All</option>
            <option value="yes">With Photos</option>
            <option value="no">Text Only</option>
          </select>
        </div>
      </div>

      {/* Review List Table */}
      <div class="table-responsive" style={{ maxHeight: "650px", overflowY: "auto" }}>
        <table class="data-table">
          <thead>
            <tr>
              <th style={{ width: "160px" }}>Reviewer</th>
              <th style={{ width: "120px" }}>Rating</th>
              <th style={{ width: "110px" }}>Date</th>
              <th>Review Text & Photos</th>
              <th style={{ width: "220px" }}>Owner Response</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan={5} class="table-empty">
                  No reviews found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredReviews.map((r) => (
                <tr key={r.review_id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.author_name}</div>
                    {r.author_review_count !== null && (
                      <div class="text-secondary" style={{ fontSize: "11px" }}>
                        {r.author_review_count} reviews
                      </div>
                    )}
                    {r.author_profile_url ? (
                      <a
                        href={r.author_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="url-text"
                        style={{ fontSize: "11px" }}
                      >
                        Profile ↗
                      </a>
                    ) : null}
                  </td>
                  <td>{renderStars(r.rating)}</td>
                  <td>
                    <div style={{ fontSize: "12px" }}>{r.review_relative_time || "-"}</div>
                    {r.review_date && (
                      <div class="text-secondary tabular-nums" style={{ fontSize: "11px" }}>
                        {r.review_date.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, fontSize: "13px" }}>
                      {r.review_text || <span class="text-secondary">(No written text)</span>}
                    </div>

                    {/* Review Attached Photos */}
                    {r.media && r.media.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                        {r.media.map((item, idx) => (
                          <img
                            key={idx}
                            src={item.thumbnail_url || item.media_url}
                            alt="Review Photo"
                            style={{
                              width: "44px",
                              height: "44px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              cursor: "pointer",
                              border: "1px solid var(--color-border)",
                            }}
                            onClick={() => setLightboxUrl(item.media_url)}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.owner_response ? (
                      <div
                        style={{
                          backgroundColor: "var(--color-bg-app)",
                          padding: "8px",
                          borderRadius: "4px",
                          borderLeft: "3px solid var(--color-accent)",
                          fontSize: "12px",
                        }}
                      >
                        <div class="text-secondary" style={{ fontSize: "10px", textTransform: "uppercase", marginBottom: "2px" }}>
                          Response · {r.owner_response.date || "Recent"}
                        </div>
                        <div>{r.owner_response.text}</div>
                      </div>
                    ) : (
                      <span class="text-secondary" style={{ fontSize: "12px" }}>None</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Expanded Preview"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "8px", objectFit: "contain" }}
            />
            <div style={{ textAlign: "right", marginTop: "8px" }}>
              <button class="btn btn-secondary btn-sm" onClick={() => setLightboxUrl(null)}>
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
