/**
 * Interactive Preact Media Library Component
 * Defined in PRD Addendum Section 22, 24, 26
 */

import { useState, useMemo } from "preact/hooks";
import { MediaRecord } from "../../../core/schema/media-record";

interface MediaLibraryTableProps {
  mediaRecords: MediaRecord[];
  onExportCsv?: () => void;
  onExportJson?: () => void;
}

export function MediaLibraryTable({ mediaRecords, onExportCsv, onExportJson }: MediaLibraryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filteredMedia = useMemo(() => {
    return mediaRecords.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.caption && m.caption.toLowerCase().includes(q)) ||
          m.media_url.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (contextFilter !== "all" && m.source_context !== contextFilter) return false;
      if (statusFilter !== "all" && m.extraction_status !== statusFilter) return false;

      return true;
    });
  }, [mediaRecords, searchQuery, typeFilter, contextFilter, statusFilter]);

  const formatDuration = (sec: number | null) => {
    if (!sec) return "-";
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div class="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div class="card-header-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>Media Library</h3>
          <p class="section-desc">
            Displaying {filteredMedia.length} of {mediaRecords.length} public photos and videos extracted from Google Maps.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {onExportCsv && (
            <button class="btn btn-secondary btn-sm" onClick={onExportCsv} disabled={mediaRecords.length === 0}>
              Export Media CSV
            </button>
          )}
          {onExportJson && (
            <button class="btn btn-primary btn-sm" onClick={onExportJson} disabled={mediaRecords.length === 0}>
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
          placeholder="Search by title, caption, or URL..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
        />

        <div class="filter-group">
          <label class="filter-label">Type:</label>
          <select
            class="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Types</option>
            <option value="photo">Photos Only</option>
            <option value="video">Videos Only</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Source Context:</label>
          <select
            class="filter-select"
            value={contextFilter}
            onChange={(e) => setContextFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Contexts</option>
            <option value="business_gallery">Business Gallery</option>
            <option value="business_profile">Profile Cover</option>
            <option value="review_media">Review Photos</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Status:</label>
          <select
            class="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="duplicate">Duplicate</option>
          </select>
        </div>
      </div>

      {/* Media Grid / Table */}
      <div class="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
        <table class="data-table">
          <thead>
            <tr>
              <th style={{ width: "70px" }}>Preview</th>
              <th>Type</th>
              <th>Title / Caption</th>
              <th>Duration</th>
              <th>Context</th>
              <th>Status</th>
              <th>Direct Asset URL</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedia.length === 0 ? (
              <tr>
                <td colSpan={7} class="table-empty">
                  No media assets found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredMedia.map((rec) => (
                <tr key={rec.media_id}>
                  <td>
                    {rec.media_url ? (
                      <img
                        src={rec.thumbnail_url || rec.media_url}
                        alt={rec.title || "Media Preview"}
                        style={{
                          width: "50px",
                          height: "50px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          cursor: "pointer",
                          border: "1px solid var(--color-border)",
                        }}
                        onClick={() => setLightboxUrl(rec.media_url)}
                      />
                    ) : (
                      <span class="chip chip-neutral" style={{ fontSize: "11px" }}>No Img</span>
                    )}
                  </td>
                  <td>
                    <span class={`chip ${rec.type === "video" ? "chip-accent" : "chip-neutral"}`}>
                      {rec.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{rec.title || "(Untitled Asset)"}</div>
                    {rec.caption && rec.caption !== rec.title && (
                      <div class="text-secondary" style={{ fontSize: "12px", marginTop: "2px" }}>
                        {rec.caption}
                      </div>
                    )}
                  </td>
                  <td class="tabular-nums">{formatDuration(rec.duration)}</td>
                  <td>
                    <span class="chip chip-neutral" style={{ fontSize: "11px" }}>
                      {rec.source_context.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <span
                      class={`chip ${
                        rec.extraction_status === "success"
                          ? "chip-success"
                          : rec.extraction_status === "duplicate"
                          ? "chip-neutral"
                          : "chip-warning"
                      }`}
                    >
                      {rec.extraction_status}
                    </span>
                  </td>
                  <td>
                    <a
                      href={rec.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="url-text"
                      style={{ fontSize: "12px" }}
                    >
                      Open Link ↗
                    </a>
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
