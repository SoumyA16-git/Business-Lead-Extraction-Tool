/**
 * Dashboard Main Controller
 * Defined in PRD Sections 19, 20, and 41
 */

import { render, h } from "preact";
import { BusinessesTable } from "./components/BusinessesTable";
import { MediaLibraryTable } from "./components/MediaLibraryTable";
import { ReviewsTable } from "./components/ReviewsTable";
import { WhatsAppOutreachPanel } from "./components/WhatsAppOutreachPanel";
import { LinkedInDataTable } from "./components/LinkedInDataTable";
import { BusinessRecord } from "../../core/schema/business-record";
import { MediaRecord } from "../../core/schema/media-record";
import { ReviewRecord } from "../../core/schema/review-record";
import { ExtractionSession } from "../../core/schema/session";
import { LinkedInProfileRecord, LinkedInSession } from "../../core/schema/linkedin-profile";
import {
  computeLeadIntelligence,
  computeLeadIntelligenceSummary,
  NICHE_PROFILES,
  SignalExplanation,
} from "../../core/classification/lead-intelligence";
import { getSessionDisplayName, isSessionStale } from "../../utils/session";

// State
let currentSession: ExtractionSession | null = null;
let currentRecords: BusinessRecord[] = [];
let allSessions: ExtractionSession[] = [];
let selectedSessionIdsForBulk = new Set<string>();
let activeRenameSessionId: string | null = null;
let activeConfirmCallback: (() => void) | null = null;
let activeNicheProfileId = "general";

// LinkedIn State
let allLinkedInSessions: LinkedInSession[] = [];
let currentLinkedInRecords: LinkedInProfileRecord[] = [];

const sessionSelectEl = document.getElementById("session-select") as HTMLSelectElement;
const dashSearchInfoEl = document.getElementById("dash-search-info")!;
const dashBtnClearAll = document.getElementById("dash-btn-clear-all") as HTMLButtonElement | null;
const dashBtnOptions = document.getElementById("dash-btn-options")!;
const preactTableRoot = document.getElementById("preact-table-root")!;
const preactMediaRoot = document.getElementById("preact-media-root")!;
const preactReviewsRoot = document.getElementById("preact-reviews-root")!;
const preactOutreachRoot = document.getElementById("preact-outreach-root");
const preactLinkedinTableRoot = document.getElementById("preact-linkedin-table-root");
const mediaBusinessSelect = document.getElementById("media-business-select") as HTMLSelectElement | null;
const reviewsBusinessSelect = document.getElementById("reviews-business-select") as HTMLSelectElement | null;
const linkedinSessionSelect = document.getElementById("linkedin-session-select") as HTMLSelectElement | null;
const btnExportLinkedinCsv = document.getElementById("btn-export-linkedin-csv") as HTMLButtonElement | null;
const btnExportLinkedinJson = document.getElementById("btn-export-linkedin-json") as HTMLButtonElement | null;

// Lead Intelligence Tab Elements
const nicheProfileSelect = document.getElementById("niche-profile-select") as HTMLSelectElement | null;
const nicheTargetDesc = document.getElementById("niche-target-desc");
const intelAvgScore = document.getElementById("intel-avg-score");
const intelHighOppCount = document.getElementById("intel-high-opp-count");
const intelPhoneCount = document.getElementById("intel-phone-count");
const intelCompleteProfilesCount = document.getElementById("intel-complete-profiles-count");
const intelAvgRating = document.getElementById("intel-avg-rating");

const oppHighFraction = document.getElementById("opp-high-fraction");
const oppHighBar = document.getElementById("opp-high-bar");
const oppMedFraction = document.getElementById("opp-med-fraction");
const oppMedBar = document.getElementById("opp-med-bar");
const oppLowFraction = document.getElementById("opp-low-fraction");
const oppLowBar = document.getElementById("opp-low-bar");

const sigCountHighRevNoSite = document.getElementById("sig-count-high-rev-no-site");
const sigCountHighRateNoSite = document.getElementById("sig-count-high-rate-no-site");
const sigCountSocialOnly = document.getElementById("sig-count-social-only");
const sigCountRepairNeeded = document.getElementById("sig-count-repair-needed");
const sigCountIncompleteActive = document.getElementById("sig-count-incomplete-active");

const btnFilterHighOpp = document.getElementById("btn-filter-high-opp");
const btnFilterNoSite = document.getElementById("btn-filter-no-site");
const btnFilterNeedsRepair = document.getElementById("btn-filter-needs-repair");

// Signal Explanation Modal Elements
const signalModal = document.getElementById("signal-modal");
const signalModalTitle = document.getElementById("signal-modal-title");
const signalModalCategory = document.getElementById("signal-modal-category");
const signalModalDescription = document.getElementById("signal-modal-description");
const signalModalEvidence = document.getElementById("signal-modal-evidence");
const signalModalClose = document.getElementById("signal-modal-close");

let currentMediaRecords: MediaRecord[] = [];
let currentReviewRecords: ReviewRecord[] = [];
let selectedMediaBusinessId = "all";
let selectedReviewsBusinessId = "all";

// Overview Tab Elements
const ovTotalEl = document.getElementById("ov-total")!;
const ovCompleteEl = document.getElementById("ov-complete")!;
const ovPartialEl = document.getElementById("ov-partial")!;
const ovFailedEl = document.getElementById("ov-failed")!;
const ovDuplicateEl = document.getElementById("ov-duplicate")!;
const ovQueryEl = document.getElementById("ov-query")!;
const ovUrlEl = document.getElementById("ov-url")!;
const ovStatusEl = document.getElementById("ov-status")!;
const ovCreatedEl = document.getElementById("ov-created")!;
const ovUpdatedEl = document.getElementById("ov-updated")!;

// Missing Data & Segments
const missingDataList = document.getElementById("missing-data-list")!;
const segWebsite = document.getElementById("seg-website")!;
const segSocial = document.getElementById("seg-social")!;
const segNone = document.getElementById("seg-none")!;
const errorsList = document.getElementById("errors-list")!;
const btnRetryFailed = document.getElementById("btn-retry-failed")!;

// Export Elements
const expPlaceholder = document.getElementById("exp-placeholder") as HTMLInputElement;
const expIncludeDupes = document.getElementById("exp-include-dupes") as HTMLInputElement;
const expIncludeIds = document.getElementById("exp-include-ids") as HTMLInputElement;
const dashBtnExportCsv = document.getElementById("dash-btn-export-csv")!;
const dashBtnExportJson = document.getElementById("dash-btn-export-json")!;
const dashBtnExportVcf = document.getElementById("dash-btn-export-vcf")!;

// Sessions Tab Elements
const sessionSearchInput = document.getElementById("session-search-input") as HTMLInputElement;
const sessionsCountLabel = document.getElementById("sessions-count-label")!;
const sessionsTableBody = document.getElementById("sessions-table-body")!;
const selectAllSessionsCheckbox = document.getElementById("select-all-sessions") as HTMLInputElement;
const btnBulkDelete = document.getElementById("btn-bulk-delete") as HTMLButtonElement;
const btnClearAllSessions = document.getElementById("btn-clear-all-sessions") as HTMLButtonElement | null;

// Modal Elements
const renameModal = document.getElementById("rename-modal")!;
const renameModalInput = document.getElementById("rename-modal-input") as HTMLInputElement;
const renameModalCancel = document.getElementById("rename-modal-cancel")!;
const renameModalSave = document.getElementById("rename-modal-save")!;

const confirmModal = document.getElementById("confirm-modal")!;
const confirmModalTitle = document.getElementById("confirm-modal-title")!;
const confirmModalMessage = document.getElementById("confirm-modal-message")!;
const confirmModalCancel = document.getElementById("confirm-modal-cancel")!;
const confirmModalConfirm = document.getElementById("confirm-modal-confirm")!;

// Tab Switching
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const targetTab = btn.getAttribute("data-tab");
    document.getElementById(`tab-${targetTab}`)?.classList.add("active");

    if (targetTab === "sessions") {
      refreshAllSessions();
    } else if (targetTab === "media" || targetTab === "reviews") {
      fetchMediaAndReviews();
    } else if (targetTab === "whatsapp-outreach") {
      renderWhatsAppOutreach();
    } else if (targetTab === "linkedin-data") {
      fetchLinkedInData();
    }
  });
});

mediaBusinessSelect?.addEventListener("change", (e) => {
  selectedMediaBusinessId = (e.target as HTMLSelectElement).value;
  fetchMediaAndReviews();
});

reviewsBusinessSelect?.addEventListener("change", (e) => {
  selectedReviewsBusinessId = (e.target as HTMLSelectElement).value;
  fetchMediaAndReviews();
});

/**
 * Loads and switches current dashboard view to a specific session
 */
function loadSessionById(sessionId: string): void {
  chrome.runtime.sendMessage({ type: "LOAD_SESSION", sessionId }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.session) {
      currentSession = response.session;
      currentRecords = response.records || [];
      renderDashboard();
    }
  });
}

/**
 * Refreshes the sessions list from IndexedDB via service worker
 */
function refreshAllSessions(): void {
  chrome.runtime.sendMessage({ type: "GET_ALL_SESSIONS" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.sessions) {
      allSessions = response.sessions;
      updateSessionDropdown();
      renderSessionsTable();
    }
  });
}

function updateSessionDropdown(): void {
  if (!sessionSelectEl) return;
  sessionSelectEl.innerHTML = "";

  if (allSessions.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No saved sessions";
    sessionSelectEl.appendChild(opt);
    return;
  }

  allSessions.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.sessionId;
    const name = getSessionDisplayName(s);
    const savedCount = (s.successCount || 0) + (s.partialCount || 0);
    const failedNote = s.failedCount ? `, ${s.failedCount} failed` : "";
    opt.textContent = `${name} (${savedCount} saved${failedNote})`;
    if (currentSession && s.sessionId === currentSession.sessionId) {
      opt.selected = true;
    }
    sessionSelectEl.appendChild(opt);
  });
}

sessionSelectEl?.addEventListener("change", (e) => {
  const selectedId = (e.target as HTMLSelectElement).value;
  if (selectedId) {
    loadSessionById(selectedId);
  }
});

function renderSessionsTable(): void {
  if (!sessionsTableBody) return;

  const q = sessionSearchInput?.value?.toLowerCase()?.trim() || "";
  const filtered = allSessions.filter((s) => {
    if (!q) return true;
    const name = getSessionDisplayName(s).toLowerCase();
    const query = (s.searchContext.query || "").toLowerCase();
    return name.includes(q) || query.includes(q);
  });

  sessionsCountLabel.textContent = `${filtered.length} of ${allSessions.length} sessions`;

  if (filtered.length === 0) {
    sessionsTableBody.innerHTML = `
      <tr>
        <td colSpan="8" style="text-align: center; padding: 24px;">No matching sessions found.</td>
      </tr>
    `;
    return;
  }

  sessionsTableBody.innerHTML = filtered
    .map((s) => {
      const isSelected = selectedSessionIdsForBulk.has(s.sessionId);
      const isCurrent = currentSession?.sessionId === s.sessionId;
      const stale = isSessionStale(s.createdAt);
      const displayName = getSessionDisplayName(s);
      const dateStr = new Date(s.createdAt).toLocaleDateString();

      let statusChipClass = "chip-neutral";
      if (s.status === "completed") statusChipClass = "chip-success";
      else if (s.status === "running") statusChipClass = "chip-accent";
      else if (s.status === "paused") statusChipClass = "chip-warning";

      return `
        <tr style="${isCurrent ? "background-color: var(--color-accent-tint);" : ""}">
          <td><input type="checkbox" class="session-row-checkbox" data-id="${s.sessionId}" ${
        isSelected ? "checked" : ""
      }></td>
          <td>
            <strong>${displayName}</strong>
            ${isCurrent ? ' <span class="chip chip-accent">VIEWING</span>' : ""}
          </td>
          <td>${s.searchContext.query || "-"}</td>
          <td class="tabular-nums">${dateStr}</td>
          <td><span class="chip ${statusChipClass}">${s.status}</span></td>
          <td class="tabular-nums">${s.processedCount}</td>
          <td>
            ${
              stale
                ? '<span class="chip chip-stale" title="Created more than 14 days ago">STALE (&gt;14d)</span>'
                : '<span class="chip chip-success">FRESH</span>'
            }
          </td>
          <td>
            <div class="session-action-btns">
              <button class="btn btn-secondary btn-xs btn-view-session" data-id="${s.sessionId}">View</button>
              <button class="btn btn-secondary btn-xs btn-rename-session" data-id="${s.sessionId}" data-name="${displayName}">Rename</button>
              ${
                s.status !== "completed" && s.status !== "running"
                  ? `<button class="btn btn-primary btn-xs btn-resume-session" data-id="${s.sessionId}">Resume</button>`
                  : ""
              }
              <button class="btn btn-danger btn-xs btn-delete-session" data-id="${s.sessionId}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach event handlers
  document.querySelectorAll(".session-row-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = (e.target as HTMLInputElement).getAttribute("data-id")!;
      if ((e.target as HTMLInputElement).checked) {
        selectedSessionIdsForBulk.add(id);
      } else {
        selectedSessionIdsForBulk.delete(id);
      }
      updateBulkButtonState();
    });
  });

  document.querySelectorAll(".btn-view-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id")!;
      loadSessionById(id);
      // Switch to Businesses tab
      document.querySelector('[data-tab="businesses"]')?.dispatchEvent(new Event("click"));
    });
  });

  document.querySelectorAll(".btn-rename-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id")!;
      const currentName = btn.getAttribute("data-name") || "";
      openRenameModal(id, currentName);
    });
  });

  document.querySelectorAll(".btn-resume-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id")!;
      chrome.runtime.sendMessage({ type: "SET_ACTIVE_SESSION", sessionId: id }, () => {
        if (chrome.runtime.lastError) return;
        chrome.runtime.sendMessage({ type: "RESUME_EXTRACTION" }, () => {
          if (chrome.runtime.lastError) return;
          loadSessionById(id);
        });
      });
    });
  });

  document.querySelectorAll(".btn-delete-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id")!;
      openConfirmModal("Delete Session", "Are you sure you want to delete this session and all its leads?", () => {
        chrome.runtime.sendMessage({ type: "DELETE_SESSION", sessionId: id }, () => {
          if (chrome.runtime.lastError) return;
          refreshAllSessions();
          if (currentSession?.sessionId === id) {
            currentSession = null;
            currentRecords = [];
            renderDashboard();
          }
        });
      });
    });
  });
}

function updateBulkButtonState(): void {
  if (!btnBulkDelete) return;
  const count = selectedSessionIdsForBulk.size;
  btnBulkDelete.disabled = count === 0;
  btnBulkDelete.textContent = count > 0 ? `Delete Selected (${count})` : "Delete Selected";
}

selectAllSessionsCheckbox?.addEventListener("change", (e) => {
  const isChecked = (e.target as HTMLInputElement).checked;
  if (isChecked) {
    allSessions.forEach((s) => selectedSessionIdsForBulk.add(s.sessionId));
  } else {
    selectedSessionIdsForBulk.clear();
  }
  renderSessionsTable();
  updateBulkButtonState();
});

sessionSearchInput?.addEventListener("input", () => {
  renderSessionsTable();
});

btnBulkDelete?.addEventListener("click", () => {
  const count = selectedSessionIdsForBulk.size;
  if (count === 0) return;
  openConfirmModal(
    "Delete Multiple Sessions",
    `Are you sure you want to permanently delete ${count} selected sessions?`,
    () => {
      const ids = Array.from(selectedSessionIdsForBulk);
      chrome.runtime.sendMessage({ type: "BULK_DELETE_SESSIONS", sessionIds: ids }, () => {
        if (chrome.runtime.lastError) return;
        selectedSessionIdsForBulk.clear();
        updateBulkButtonState();
        refreshAllSessions();
        if (currentSession && ids.includes(currentSession.sessionId)) {
          currentSession = null;
          currentRecords = [];
          renderDashboard();
        }
      });
    }
  );
});

function promptClearAllData(): void {
  openConfirmModal(
    "Clear All Stored Data",
    "Are you sure you want to permanently delete ALL extraction sessions, business leads, media library files, and reviews? This will completely wipe your local database.",
    () => {
      chrome.runtime.sendMessage({ type: "CLEAR_ALL_DATA" }, () => {
        if (chrome.runtime.lastError) return;
        currentSession = null;
        currentRecords = [];
        allSessions = [];
        currentMediaRecords = [];
        currentReviewRecords = [];
        selectedSessionIdsForBulk.clear();
        updateBulkButtonState();
        refreshAllSessions();
        renderDashboard();
        fetchMediaAndReviews();
      });
    }
  );
}

dashBtnClearAll?.addEventListener("click", promptClearAllData);
btnClearAllSessions?.addEventListener("click", promptClearAllData);

// Modal Logic
function openRenameModal(sessionId: string, currentTitle: string): void {
  activeRenameSessionId = sessionId;
  renameModalInput.value = currentTitle;
  renameModal.style.display = "flex";
  renameModalInput.focus();
}

renameModalCancel?.addEventListener("click", () => {
  renameModal.style.display = "none";
  activeRenameSessionId = null;
});

renameModalSave?.addEventListener("click", () => {
  const newName = renameModalInput.value.trim();
  if (activeRenameSessionId && newName) {
    chrome.runtime.sendMessage(
      { type: "RENAME_SESSION", sessionId: activeRenameSessionId, newName },
      () => {
        if (chrome.runtime.lastError) return;
        renameModal.style.display = "none";
        activeRenameSessionId = null;
        refreshAllSessions();
        if (currentSession && currentSession.sessionId === activeRenameSessionId) {
          currentSession.customName = newName;
          renderDashboard();
        }
      }
    );
  }
});

function openConfirmModal(title: string, message: string, onConfirm: () => void): void {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  activeConfirmCallback = onConfirm;
  confirmModal.style.display = "flex";
}

confirmModalCancel?.addEventListener("click", () => {
  confirmModal.style.display = "none";
  activeConfirmCallback = null;
});

confirmModalConfirm?.addEventListener("click", () => {
  if (activeConfirmCallback) {
    activeConfirmCallback();
  }
  confirmModal.style.display = "none";
  activeConfirmCallback = null;
});

// Signal Modal and Lead Intelligence Helpers
function openSignalModal(signal: SignalExplanation): void {
  if (!signalModal) return;
  if (signalModalTitle) signalModalTitle.textContent = signal.label;
  if (signalModalCategory) signalModalCategory.textContent = signal.category.toUpperCase().replace(/_/g, " ");
  if (signalModalDescription) signalModalDescription.textContent = signal.description;
  if (signalModalEvidence) signalModalEvidence.textContent = signal.evidence;
  signalModal.style.display = "flex";
}

signalModalClose?.addEventListener("click", () => {
  if (signalModal) signalModal.style.display = "none";
});

nicheProfileSelect?.addEventListener("change", (e) => {
  activeNicheProfileId = (e.target as HTMLSelectElement).value;
  renderDashboard();
});

function switchToBusinessesTab(): void {
  tabButtons.forEach((b) => b.classList.remove("active"));
  tabPanels.forEach((p) => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="businesses"]')?.classList.add("active");
  document.getElementById("tab-businesses")?.classList.add("active");
}

btnFilterHighOpp?.addEventListener("click", switchToBusinessesTab);
btnFilterNoSite?.addEventListener("click", switchToBusinessesTab);
btnFilterNeedsRepair?.addEventListener("click", switchToBusinessesTab);

function renderLeadIntelligenceTab(): void {
  const summary = computeLeadIntelligenceSummary(currentRecords, activeNicheProfileId);
  const total = summary.totalRecords || 1;

  if (nicheTargetDesc) {
    nicheTargetDesc.textContent =
      NICHE_PROFILES[activeNicheProfileId]?.targetDescription ||
      "Select a qualification profile to highlight ideal prospects.";
  }

  // Calculate Average Maturity Score
  let scoreSum = 0;
  let nonDupeCount = 0;
  for (const r of currentRecords) {
    if (r.extraction_status === "duplicate") continue;
    const intel = computeLeadIntelligence(r, activeNicheProfileId);
    scoreSum += intel.digitalMaturityScore;
    nonDupeCount++;
  }
  const avgScore = nonDupeCount > 0 ? Math.round(scoreSum / nonDupeCount) : 0;

  if (intelAvgScore) intelAvgScore.textContent = String(avgScore);
  if (intelHighOppCount) intelHighOppCount.textContent = String(summary.highOpportunityCount);
  if (intelPhoneCount) intelPhoneCount.textContent = String(summary.phoneAvailableCount);
  if (intelCompleteProfilesCount) intelCompleteProfilesCount.textContent = String(summary.completeProfileCount);
  if (intelAvgRating) {
    intelAvgRating.textContent = summary.averageRating !== null ? `${summary.averageRating} / 5.0` : "-";
  }

  // Fractions & Bars
  const highPct = Math.round((summary.highOpportunityCount / total) * 100);
  const medPct = Math.round((summary.mediumOpportunityCount / total) * 100);
  const lowPct = Math.round((summary.lowOpportunityCount / total) * 100);

  if (oppHighFraction) oppHighFraction.textContent = `${summary.highOpportunityCount} (${highPct}%)`;
  if (oppHighBar) oppHighBar.style.width = `${highPct}%`;

  if (oppMedFraction) oppMedFraction.textContent = `${summary.mediumOpportunityCount} (${medPct}%)`;
  if (oppMedBar) oppMedBar.style.width = `${medPct}%`;

  if (oppLowFraction) oppLowFraction.textContent = `${summary.lowOpportunityCount} (${lowPct}%)`;
  if (oppLowBar) oppLowBar.style.width = `${lowPct}%`;

  // Signal Counts
  if (sigCountHighRevNoSite) sigCountHighRevNoSite.textContent = String(summary.highReviewsNoWebsiteCount);
  if (sigCountHighRateNoSite) sigCountHighRateNoSite.textContent = String(summary.highRatingNoWebsiteCount);
  if (sigCountSocialOnly) sigCountSocialOnly.textContent = String(summary.socialOnlyCount);
  if (sigCountRepairNeeded) sigCountRepairNeeded.textContent = String(summary.lowRatingActiveReviewsCount);
  if (sigCountIncompleteActive) sigCountIncompleteActive.textContent = String(summary.incompleteActiveListingCount);
}

function renderDashboard(): void {
  // Update header search info
  if (currentSession) {
    const displayName = getSessionDisplayName(currentSession);
    dashSearchInfoEl.textContent = `Viewing: "${displayName}" (${currentSession.status})`;
    ovTotalEl.textContent = String(currentSession.processedCount);
    ovCompleteEl.textContent = String(currentSession.successCount);
    ovPartialEl.textContent = String(currentSession.partialCount);
    ovFailedEl.textContent = String(currentSession.failedCount);
    ovDuplicateEl.textContent = String(currentSession.duplicateCount);

    ovQueryEl.textContent = currentSession.searchContext.query || "N/A";
    ovUrlEl.textContent = currentSession.sourceUrl || "N/A";
    ovStatusEl.textContent = currentSession.status.toUpperCase();
    ovCreatedEl.textContent = new Date(currentSession.createdAt).toLocaleString();
    ovUpdatedEl.textContent = new Date(currentSession.updatedAt).toLocaleString();

    segWebsite.textContent = String(currentSession.websiteCount);
    segSocial.textContent = String(currentSession.socialCount);
    segNone.textContent = String(currentSession.noWebsiteCount);
  } else {
    dashSearchInfoEl.textContent = "No session selected";
    ovTotalEl.textContent = "0";
    ovCompleteEl.textContent = "0";
    ovPartialEl.textContent = "0";
    ovFailedEl.textContent = "0";
    ovDuplicateEl.textContent = "0";
    ovQueryEl.textContent = "N/A";
    ovUrlEl.textContent = "N/A";
    ovStatusEl.textContent = "NONE";
    ovCreatedEl.textContent = "-";
    ovUpdatedEl.textContent = "-";
    segWebsite.textContent = "0";
    segSocial.textContent = "0";
    segNone.textContent = "0";
  }

  populateBusinessDropdowns();
  renderLeadIntelligenceTab();

  // Render Preact Table
  if (preactTableRoot) {
    render(
      h(BusinessesTable, {
        records: currentRecords,
        activeNicheProfileId,
        onNicheProfileChange: (newNicheId) => {
          activeNicheProfileId = newNicheId;
          if (nicheProfileSelect) nicheProfileSelect.value = newNicheId;
          renderLeadIntelligenceTab();
        },
        onExplainSignal: (signal) => {
          openSignalModal(signal);
        },
        onViewMediaReviews: (rec) => {
          selectedMediaBusinessId = rec.record_id;
          selectedReviewsBusinessId = rec.record_id;
          if (mediaBusinessSelect) mediaBusinessSelect.value = rec.record_id;
          if (reviewsBusinessSelect) reviewsBusinessSelect.value = rec.record_id;

          tabButtons.forEach((b) => b.classList.remove("active"));
          tabPanels.forEach((p) => p.classList.remove("active"));
          document.querySelector('.tab-btn[data-tab="media"]')?.classList.add("active");
          document.getElementById("tab-media")?.classList.add("active");

          fetchMediaAndReviews();
        },
        onOpenWhatsAppOutreach: () => {
          tabButtons.forEach((b) => b.classList.remove("active"));
          tabPanels.forEach((p) => p.classList.remove("active"));
          document.querySelector('.tab-btn[data-tab="whatsapp-outreach"]')?.classList.add("active");
          document.getElementById("tab-whatsapp-outreach")?.classList.add("active");
          renderWhatsAppOutreach();
        },
      }),
      preactTableRoot
    );
  }

  renderMediaTable();
  renderReviewsTable();
  renderWhatsAppOutreach();

  // Render Missing Data Counts
  if (missingDataList) {
    const missingCounts: Record<string, number> = {};
    for (const r of currentRecords) {
      for (const f of r.missing_fields || []) {
        missingCounts[f] = (missingCounts[f] || 0) + 1;
      }
    }

    missingDataList.innerHTML = Object.entries(missingCounts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([field, count]) => `
        <div class="stat-row-item">
          <span>Missing <strong>${field}</strong></span>
          <span class="tabular-nums font-medium">${count} records (${Math.round(
          (count / Math.max(1, currentRecords.length)) * 100
        )}%)</span>
        </div>
      `
      )
      .join("");

    if (Object.keys(missingCounts).length === 0) {
      missingDataList.innerHTML = '<p class="text-secondary">No missing data flagged yet.</p>';
    }
  }

  // Render Errors List
  if (errorsList) {
    const failedQueue = currentSession?.queue.filter((q) => q.status === "failed") || [];
    if (failedQueue.length === 0) {
      errorsList.innerHTML = '<p class="text-secondary">No unrecoverable extraction errors.</p>';
    } else {
      errorsList.innerHTML = failedQueue
        .map(
          (q) => `
        <div class="stat-row-item" style="border-left: 3px solid var(--color-error)">
          <div>
            <strong>${q.name}</strong>
            <p class="text-error text-caption">${q.lastError || "Unknown error"}</p>
          </div>
          <span class="text-caption text-secondary">Retries: ${q.retryCount}</span>
        </div>
      `
        )
        .join("");
    }
  }

  updateSessionDropdown();
}

function populateBusinessDropdowns(): void {
  if (mediaBusinessSelect) {
    const prevVal = mediaBusinessSelect.value || selectedMediaBusinessId;
    mediaBusinessSelect.innerHTML = '<option value="all">All Businesses</option>';
    currentRecords.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.record_id;
      opt.textContent = r.business_name || "Unnamed Business";
      if (r.record_id === prevVal) opt.selected = true;
      mediaBusinessSelect.appendChild(opt);
    });
  }

  if (reviewsBusinessSelect) {
    const prevVal = reviewsBusinessSelect.value || selectedReviewsBusinessId;
    reviewsBusinessSelect.innerHTML = '<option value="all">All Businesses</option>';
    currentRecords.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.record_id;
      opt.textContent = r.business_name || "Unnamed Business";
      if (r.record_id === prevVal) opt.selected = true;
      reviewsBusinessSelect.appendChild(opt);
    });
  }
}

function fetchMediaAndReviews(): void {
  const bId = selectedMediaBusinessId === "all" ? undefined : selectedMediaBusinessId;
  chrome.runtime.sendMessage({ type: "GET_MEDIA_RECORDS", businessId: bId }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.media) {
      currentMediaRecords = res.media;
      renderMediaTable();
    }
  });

  const revBId = selectedReviewsBusinessId === "all" ? undefined : selectedReviewsBusinessId;
  chrome.runtime.sendMessage({ type: "GET_REVIEW_RECORDS", businessId: revBId }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.reviews) {
      currentReviewRecords = res.reviews;
      renderReviewsTable();
    }
  });
}

function renderMediaTable(): void {
  if (preactMediaRoot) {
    render(
      h(MediaLibraryTable, {
        mediaRecords: currentMediaRecords,
        onExportCsv: () => {
          chrome.runtime.sendMessage({
            type: "EXPORT_MEDIA_REVIEWS",
            businessId: selectedMediaBusinessId === "all" ? undefined : selectedMediaBusinessId,
            format: "media_csv",
          });
        },
        onExportJson: () => {
          chrome.runtime.sendMessage({
            type: "EXPORT_MEDIA_REVIEWS",
            businessId: selectedMediaBusinessId === "all" ? undefined : selectedMediaBusinessId,
            format: "combined_json",
          });
        },
      }),
      preactMediaRoot
    );
  }
}

function renderReviewsTable(): void {
  if (preactReviewsRoot) {
    render(
      h(ReviewsTable, {
        reviewRecords: currentReviewRecords,
        onExportCsv: () => {
          chrome.runtime.sendMessage({
            type: "EXPORT_MEDIA_REVIEWS",
            businessId: selectedReviewsBusinessId === "all" ? undefined : selectedReviewsBusinessId,
            format: "reviews_csv",
          });
        },
        onExportJson: () => {
          chrome.runtime.sendMessage({
            type: "EXPORT_MEDIA_REVIEWS",
            businessId: selectedReviewsBusinessId === "all" ? undefined : selectedReviewsBusinessId,
            format: "combined_json",
          });
        },
      }),
      preactReviewsRoot
    );
  }
}

function renderWhatsAppOutreach(): void {
  if (preactOutreachRoot) {
    render(
      h(WhatsAppOutreachPanel, {
        records: currentRecords,
        sessionId: currentSession?.sessionId,
        onRefreshRecords: () => {
          if (currentSession) {
            loadSessionById(currentSession.sessionId);
          }
        },
      }),
      preactOutreachRoot
    );
  }
}

// Initial Data Fetch
chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
  if (chrome.runtime.lastError) return;
  if (response?.session) {
    currentSession = response.session;
    currentRecords = response.records || [];
  }
  refreshAllSessions();
  renderDashboard();
  fetchMediaAndReviews();

  // Hash Navigation (e.g. #lead-intelligence or #whatsapp-outreach)
  if (window.location.hash === "#lead-intelligence") {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="lead-intelligence"]')?.classList.add("active");
    document.getElementById("tab-lead-intelligence")?.classList.add("active");
  } else if (window.location.hash === "#whatsapp-outreach") {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="whatsapp-outreach"]')?.classList.add("active");
    document.getElementById("tab-whatsapp-outreach")?.classList.add("active");
    renderWhatsAppOutreach();
  }
});

// Live Updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_UPDATED") {
    if (!message.session) {
      currentSession = null;
      currentRecords = [];
      renderDashboard();
    } else if (
      !currentSession ||
      currentSession.sessionId === message.session.sessionId
    ) {
      currentSession = message.session;
      renderDashboard();
    }
    refreshAllSessions();
  } else if (message.type === "RECORD_SAVED") {
    if (currentSession) {
      const existingIndex = currentRecords.findIndex(
        (r) => r.record_id === message.record.record_id
      );
      if (existingIndex >= 0) {
        currentRecords[existingIndex] = message.record;
      } else {
        currentRecords.push(message.record);
      }
      renderDashboard();
    }
  } else if (message.type === "MEDIA_RECORD_SAVED") {
    currentMediaRecords.push(message.record);
    renderMediaTable();
  } else if (message.type === "REVIEW_RECORD_SAVED") {
    currentReviewRecords.push(message.record);
    renderReviewsTable();
  }
});

// Retry Failed
btnRetryFailed?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RETRY_FAILED" });
});

// Options navigation
dashBtnOptions?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Export triggers
dashBtnExportCsv?.addEventListener("click", () => {
  const exportSettings = currentSession ? {
    csvMissingPlaceholder: expPlaceholder?.value || "",
    includeDuplicateRecords: expIncludeDupes?.checked ?? false,
    includeInternalIdentifiers: expIncludeIds?.checked ?? false,
  } : undefined;

  chrome.runtime.sendMessage(
    { type: "EXPORT", format: "csv", exportSettings },
    (response) => {
      if (chrome.runtime.lastError) {
        // Service worker was suspended — retry once after a short delay
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "EXPORT", format: "csv", exportSettings }, () => {
            if (chrome.runtime.lastError) console.warn("[Dashboard] CSV export failed:", chrome.runtime.lastError.message);
          });
        }, 800);
        return;
      }
      if (response?.error) {
        console.warn("[Dashboard] CSV export error:", response.error);
      }
    }
  );
});

dashBtnExportJson?.addEventListener("click", () => {
  const exportSettings = currentSession ? {
    includeDuplicateRecords: expIncludeDupes?.checked ?? false,
  } : undefined;

  chrome.runtime.sendMessage(
    { type: "EXPORT", format: "json", exportSettings },
    (response) => {
      if (chrome.runtime.lastError) {
        // Service worker was suspended — retry once after a short delay
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "EXPORT", format: "json", exportSettings }, () => {
            if (chrome.runtime.lastError) console.warn("[Dashboard] JSON export failed:", chrome.runtime.lastError.message);
          });
        }, 800);
        return;
      }
      if (response?.error) {
        console.warn("[Dashboard] JSON export error:", response.error);
      }
    }
  );
});

dashBtnExportVcf?.addEventListener("click", () => {
  const exportSettings = currentSession ? {
    includeDuplicateRecords: expIncludeDupes?.checked ?? false,
  } : undefined;

  chrome.runtime.sendMessage(
    { type: "EXPORT", format: "vcf", exportSettings },
    (response) => {
      if (chrome.runtime.lastError) {
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "EXPORT", format: "vcf", exportSettings }, () => {
            if (chrome.runtime.lastError) console.warn("[Dashboard] VCF export failed:", chrome.runtime.lastError.message);
          });
        }, 800);
        return;
      }
      if (response?.error) {
        console.warn("[Dashboard] VCF export error:", response.error);
      }
    }
  );
});

// ============================================================
// LinkedIn Dashboard Logic
// ============================================================

function fetchLinkedInData(): void {
  chrome.runtime.sendMessage({ type: "GET_ALL_LINKEDIN_SESSIONS" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.sessions) {
      allLinkedInSessions = res.sessions;
      populateLinkedInDropdown();
    }
  });
}

function populateLinkedInDropdown(): void {
  if (!linkedinSessionSelect) return;
  const prevVal = linkedinSessionSelect.value;
  linkedinSessionSelect.innerHTML = "";
  
  if (allLinkedInSessions.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No LinkedIn sessions found";
    linkedinSessionSelect.appendChild(opt);
    currentLinkedInRecords = [];
    renderLinkedInTable();
    return;
  }

  allLinkedInSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  allLinkedInSessions.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.sessionId;
    const dateStr = new Date(s.updatedAt).toLocaleString();
    opt.textContent = `${s.customName || s.searchQuery || "LinkedIn Search"} (${dateStr}) - ${s.processedCount} profiles`;
    linkedinSessionSelect.appendChild(opt);
  });

  if (prevVal && allLinkedInSessions.some(s => s.sessionId === prevVal)) {
    linkedinSessionSelect.value = prevVal;
  }

  fetchProfilesForSelectedLinkedInSession();
}

function fetchProfilesForSelectedLinkedInSession(): void {
  if (!linkedinSessionSelect) return;
  const sessionId = linkedinSessionSelect.value;
  if (!sessionId) return;
  
  chrome.runtime.sendMessage({ type: "GET_LINKEDIN_PROFILES", sessionId }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.profiles) {
      currentLinkedInRecords = res.profiles;
      renderLinkedInTable();
    }
  });
}

import { LinkedInCampaignPanel } from "./components/LinkedInCampaignPanel";

function renderLinkedInTable(): void {
  if (preactLinkedinTableRoot) {
    const sessionId = linkedinSessionSelect?.value || "";
    render(
      h("div", null,
        sessionId ? h(LinkedInCampaignPanel, { sessionId }) : null,
        h(LinkedInDataTable, { records: currentLinkedInRecords })
      ),
      preactLinkedinTableRoot
    );
  }
}

if (linkedinSessionSelect) {
  linkedinSessionSelect.addEventListener("change", fetchProfilesForSelectedLinkedInSession);
}

if (btnExportLinkedinCsv) {
  btnExportLinkedinCsv.addEventListener("click", () => {
    if (linkedinSessionSelect?.value) {
      chrome.runtime.sendMessage({ type: "EXPORT_LINKEDIN_PROFILES", sessionId: linkedinSessionSelect.value, format: "csv" });
    }
  });
}

if (btnExportLinkedinJson) {
  btnExportLinkedinJson.addEventListener("click", () => {
    if (linkedinSessionSelect?.value) {
      chrome.runtime.sendMessage({ type: "EXPORT_LINKEDIN_PROFILES", sessionId: linkedinSessionSelect.value, format: "json" });
    }
  });
}
