/**
 * Extension Popup Controller
 * Defined in PRD Section 18 & PRD Addendum
 */

import { extractPlaceIdentifier } from "../../adapters/google-maps/extractors/place-identifier";
import { computeLeadIntelligenceSummary } from "../../core/classification/lead-intelligence";
import { getRecordsBySession } from "../../core/storage/records-repo";
import { DetectedBusinessTarget } from "../../core/adapters/platform-adapter";
import { MediaReviewJob } from "../../core/schema/media-review-job";
import { ExtractionSession } from "../../core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS, applySpeedPreset, SpeedPreset } from "../../shared/settings";
import { renderIcon } from "../shared-components/icon";
import { LinkedInSession } from "../../core/schema/linkedin-profile";

// Mode switcher elements
const tabModeSearch = document.getElementById("tab-mode-search") as HTMLButtonElement;
const tabModeMedia = document.getElementById("tab-mode-media") as HTMLButtonElement;
const tabModeLinkedIn = document.getElementById("tab-mode-linkedin") as HTMLButtonElement | null;
const searchModeContainer = document.getElementById("search-mode-container")!;
const mediaModeContainer = document.getElementById("media-mode-container")!;
const linkedInModeContainer = document.getElementById("linkedin-mode-container") as HTMLElement | null;

// Header Elements
const searchQueryEl = document.getElementById("search-query")!;
const detectedCountEl = document.getElementById("detected-count")!;
const statusLabelEl = document.getElementById("status-label")!;
const statusDotEl = document.querySelector(".status-dot")!;
const alertBannerEl = document.getElementById("alert-banner")!;
const alertTextEl = document.getElementById("alert-text")!;
const alertIconEl = document.getElementById("alert-icon")!;

// Search Mode Progress & Stats
const progressFractionEl = document.getElementById("progress-fraction")!;
const progressBarFillEl = document.getElementById("progress-bar-fill")!;
const statSuccessfulEl = document.getElementById("stat-successful")!;
const statPartialEl = document.getElementById("stat-partial")!;
const statFailedEl = document.getElementById("stat-failed")!;
const statDuplicateEl = document.getElementById("stat-duplicate")!;

// Search Mode Controls
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const runningControls = document.getElementById("running-controls")!;
const btnPause = document.getElementById("btn-pause") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const pausedControls = document.getElementById("paused-controls")!;
const btnResume = document.getElementById("btn-resume") as HTMLButtonElement;
const btnStopPaused = document.getElementById("btn-stop-paused") as HTMLButtonElement;

// Search Mode Lead Intelligence Elements
const intelCountTotalEl = document.getElementById("intel-count-total")!;
const countWebsiteEl = document.getElementById("count-website")!;
const countSocialEl = document.getElementById("count-social")!;
const countNoWebsiteEl = document.getElementById("count-no-website")!;
const countPhoneDirectEl = document.getElementById("count-phone-direct")!;
const countFullContactEl = document.getElementById("count-full-contact")!;
const countCompleteGbpEl = document.getElementById("count-complete-gbp")!;
const countRatingHighEl = document.getElementById("count-rating-high")!;
const countReviewsHighEl = document.getElementById("count-reviews-high")!;
const countReputationRepairEl = document.getElementById("count-reputation-repair")!;
const countOppRevNoSiteEl = document.getElementById("count-opp-rev-no-site")!;
const countOppRateNoSiteEl = document.getElementById("count-opp-rate-no-site")!;
const btnOpenLeadIntelligence = document.getElementById("btn-open-lead-intelligence") as HTMLButtonElement | null;

// Search Mode Export
const btnExportCsv = document.getElementById("btn-export-csv") as HTMLButtonElement;
const btnExportJson = document.getElementById("btn-export-json") as HTMLButtonElement;
const btnOpenDashboard = document.getElementById("btn-open-dashboard")!;
const btnSettings = document.getElementById("btn-settings")!;
const footerStatusEl = document.getElementById("footer-status")!;

// Media Mode Elements
const detectedBizCard = document.getElementById("detected-biz-card")!;
const detectedBizName = document.getElementById("detected-biz-name")!;
const detectedBizAddress = document.getElementById("detected-biz-address")!;
const detectedBizNote = document.getElementById("detected-biz-note")!;
const btnUseDetectedBiz = document.getElementById("btn-use-detected-biz") as HTMLButtonElement;

const inputBizUrl = document.getElementById("input-biz-url") as HTMLInputElement;
const btnLoadBizUrl = document.getElementById("btn-load-biz-url") as HTMLButtonElement;
const bizUrlError = document.getElementById("biz-url-error")!;

const confirmedTargetCard = document.getElementById("confirmed-target-card")!;
const targetBizName = document.getElementById("target-biz-name")!;
const targetBizUrl = document.getElementById("target-biz-url")!;

const chkPhotos = document.getElementById("chk-photos") as HTMLInputElement;
const chkVideos = document.getElementById("chk-videos") as HTMLInputElement;
const chkReviews = document.getElementById("chk-reviews") as HTMLInputElement;

const mediaProgressSection = document.getElementById("media-progress-section")!;
const mediaTrackBadge = document.getElementById("media-track-badge")!;
const mediaTrackFraction = document.getElementById("media-track-fraction")!;
const mediaTrackBar = document.getElementById("media-track-bar")!;

const reviewTrackBadge = document.getElementById("review-track-badge")!;
const reviewTrackFraction = document.getElementById("review-track-fraction")!;
const reviewTrackBar = document.getElementById("review-track-bar")!;

const btnMediaStart = document.getElementById("btn-media-start") as HTMLButtonElement;
const mediaRunningControls = document.getElementById("media-running-controls")!;
const btnMediaPause = document.getElementById("btn-media-pause") as HTMLButtonElement;
const btnMediaStop = document.getElementById("btn-media-stop") as HTMLButtonElement;
const mediaPausedControls = document.getElementById("media-paused-controls")!;
const btnMediaResume = document.getElementById("btn-media-resume") as HTMLButtonElement;
const btnMediaStopPaused = document.getElementById("btn-media-stop-paused") as HTMLButtonElement;

const btnExportMediaCsv = document.getElementById("btn-export-media-csv") as HTMLButtonElement;
const btnExportReviewsCsv = document.getElementById("btn-export-reviews-csv") as HTMLButtonElement;
const btnMediaOpenDashboard = document.getElementById("btn-media-open-dashboard")!;

// State
let isOnGoogleMaps = false;
let detectedTarget: DetectedBusinessTarget | null = null;
let confirmedTarget: DetectedBusinessTarget | null = null;
let currentMediaJob: MediaReviewJob | null = null;
let currentLinkedInSession: LinkedInSession | null = null;

// LinkedIn UI elements
const liSearchQueryEl = document.getElementById("li-search-query");
const liDetectedCountEl = document.getElementById("li-detected-count");
const liAlertBannerEl = document.getElementById("li-alert-banner") as HTMLElement | null;
const liAlertTextEl = document.getElementById("li-alert-text");
const liProgressFractionEl = document.getElementById("li-progress-fraction");
const liProgressBarFillEl = document.getElementById("li-progress-bar-fill") as HTMLElement | null;
const liStatConnectedEl = document.getElementById("li-stat-connected");
const liStatSkippedEl = document.getElementById("li-stat-skipped");
const liStatFailedEl = document.getElementById("li-stat-failed");
const liStatPendingEl = document.getElementById("li-stat-pending");
const liBtnStart = document.getElementById("li-btn-start") as HTMLButtonElement | null;
const liRunningControls = document.getElementById("li-running-controls") as HTMLElement | null;
const liPausedControls = document.getElementById("li-paused-controls") as HTMLElement | null;
const liBtnPause = document.getElementById("li-btn-pause") as HTMLButtonElement | null;
const liBtnStop = document.getElementById("li-btn-stop") as HTMLButtonElement | null;
const liBtnResume = document.getElementById("li-btn-resume") as HTMLButtonElement | null;
const liBtnStopPaused = document.getElementById("li-btn-stop-paused") as HTMLButtonElement | null;
const liBtnExportCsv = document.getElementById("li-btn-export-csv") as HTMLButtonElement | null;
const liBtnExportJson = document.getElementById("li-btn-export-json") as HTMLButtonElement | null;

// Render settings & reset icons
btnSettings.innerHTML = renderIcon("settings", 16);
const btnResetSession = document.getElementById("btn-reset-session") as HTMLButtonElement | null;
if (btnResetSession) {
  btnResetSession.innerHTML = renderIcon("refresh", 16);
  btnResetSession.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, () => {
      if (chrome.runtime.lastError) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {});
        }
      });
    });
  });
}

// Mode switching
tabModeSearch.addEventListener("click", () => {
  tabModeSearch.classList.add("active");
  tabModeMedia.classList.remove("active");
  tabModeLinkedIn?.classList.remove("active");
  searchModeContainer.style.display = "block";
  mediaModeContainer.style.display = "none";
  if (linkedInModeContainer) linkedInModeContainer.style.display = "none";
});

tabModeMedia.addEventListener("click", () => {
  tabModeMedia.classList.add("active");
  tabModeSearch.classList.remove("active");
  tabModeLinkedIn?.classList.remove("active");
  searchModeContainer.style.display = "none";
  mediaModeContainer.style.display = "flex";
  if (linkedInModeContainer) linkedInModeContainer.style.display = "none";
});

tabModeLinkedIn?.addEventListener("click", () => {
  tabModeLinkedIn.classList.add("active");
  tabModeSearch.classList.remove("active");
  tabModeMedia.classList.remove("active");
  searchModeContainer.style.display = "none";
  mediaModeContainer.style.display = "none";
  if (linkedInModeContainer) linkedInModeContainer.style.display = "flex";

  // First load saved state
  chrome.runtime.sendMessage({ type: "GET_LINKEDIN_SESSION_STATE" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.session) updateLinkedInUI(res.session);
  });

  // Also trigger a fresh page scan on the active LinkedIn tab
  // (handles the case where extension was loaded/reloaded while already on LinkedIn)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id && tab.url?.includes("linkedin.com")) {
      chrome.tabs.sendMessage(tab.id, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }, () => {
        if (chrome.runtime.lastError) {
          // Content script not injected yet — inject then scan
          chrome.scripting.executeScript(
            { target: { tabId: tab.id! }, files: ["content-scripts/linkedin/index.js"] },
            () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id!, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => {});
              }, 500);
            }
          );
        }
      });
    }
  });
});

let currentSettings = DEFAULT_EXTRACTION_SETTINGS;

// Update Search Mode UI
async function updateSearchUI(session: ExtractionSession | null): Promise<void> {
  const maxTarget = session?.settingsSnapshot?.maxBusinesses || currentSettings.maxBusinesses || 0;
  updateSpeedUI(session?.settingsSnapshot || currentSettings);

  if (!session) {
    searchQueryEl.textContent = isOnGoogleMaps ? "Google Maps Detected" : "Open Google Maps to begin";
    detectedCountEl.textContent = isOnGoogleMaps
      ? `Ready to extract leads · Limit: ${maxTarget > 0 ? maxTarget : "Unlimited"}`
      : "No active search detected";
    statusLabelEl.textContent = isOnGoogleMaps ? "READY" : "INACTIVE";
    statusDotEl.className = isOnGoogleMaps ? "status-dot active" : "status-dot";
    btnStart.disabled = !isOnGoogleMaps;
    btnStart.textContent = "Start Extraction";
    btnStart.style.display = "block";
    runningControls.style.display = "none";
    pausedControls.style.display = "none";
    alertBannerEl.style.display = "none";
    progressFractionEl.textContent = "0 / 0";
    progressBarFillEl.style.width = "0%";
    statSuccessfulEl.textContent = "0";
    statPartialEl.textContent = "0";
    statFailedEl.textContent = "0";
    statDuplicateEl.textContent = "0";

    // Reset Lead Intelligence Metrics
    intelCountTotalEl.textContent = "0 Leads";
    countWebsiteEl.textContent = "0";
    countSocialEl.textContent = "0";
    countNoWebsiteEl.textContent = "0";
    countPhoneDirectEl.textContent = "0";
    countFullContactEl.textContent = "0";
    countCompleteGbpEl.textContent = "0";
    countRatingHighEl.textContent = "0";
    countReviewsHighEl.textContent = "0";
    countReputationRepairEl.textContent = "0";
    countOppRevNoSiteEl.textContent = "0";
    countOppRateNoSiteEl.textContent = "0";
    return;
  }

  // Search Context & Discovered Count
  searchQueryEl.textContent = session.searchContext.query || "Google Maps Search";
  const queueLength = session.queue.length;
  const pendingCount = session.queue.filter((i) => i.status === "queued").length;
  const validExtracted = session.successCount + session.partialCount;

  if (session.status === "running") {
    detectedCountEl.textContent = `${session.processedCount} processed · ${pendingCount} in queue (scrolling...)`;
  } else if (session.status === "completed") {
    const reasonText = session.completionReason === "limit_reached" ? "limit reached" : "results exhausted";
    detectedCountEl.textContent = `${validExtracted} leads extracted of ${maxTarget > 0 ? maxTarget : validExtracted} target limit (${reasonText})`;
  } else if (session.status === "paused") {
    detectedCountEl.textContent = `${pendingCount} remaining in queue · Limit: ${maxTarget > 0 ? maxTarget : "Unlimited"}`;
  } else {
    detectedCountEl.textContent = `${queueLength} businesses discovered · Limit: ${maxTarget > 0 ? maxTarget : "Unlimited"}`;
  }

  // Status & Dot
  statusLabelEl.textContent = session.status.toUpperCase();
  statusDotEl.className = "status-dot";
  if (session.status === "running") statusDotEl.classList.add("active");
  else if (session.status === "paused") statusDotEl.classList.add("warning");
  else if (session.status === "failed") statusDotEl.classList.add("error");

  // Progress Bar & Fraction (decoupled: shows Processed / Extraction Limit)
  if (maxTarget > 0) {
    progressFractionEl.textContent = `${session.processedCount} / ${maxTarget} leads`;
    const pct = Math.min(100, (session.processedCount / maxTarget) * 100);
    progressBarFillEl.style.width = `${pct}%`;
  } else {
    progressFractionEl.textContent = `${session.processedCount} leads`;
    progressBarFillEl.style.width = session.status === "completed" ? "100%" : "50%";
  }

  // Statistics
  statSuccessfulEl.textContent = String(session.successCount);
  statPartialEl.textContent = String(session.partialCount);
  statFailedEl.textContent = String(session.failedCount);
  statDuplicateEl.textContent = String(session.duplicateCount);

  // Lead Intelligence Computation
  try {
    const records = await getRecordsBySession(session.sessionId);
    const summary = computeLeadIntelligenceSummary(records, "general");

    intelCountTotalEl.textContent = `${summary.totalRecords} Leads`;
    countWebsiteEl.textContent = String(summary.websiteCount);
    countSocialEl.textContent = String(summary.socialOnlyCount);
    countNoWebsiteEl.textContent = String(summary.noWebsiteCount);
    countPhoneDirectEl.textContent = String(summary.phoneAvailableCount);
    countFullContactEl.textContent = String(summary.fullContactCount);
    countCompleteGbpEl.textContent = String(summary.completeProfileCount);
    countRatingHighEl.textContent = String(summary.rating45PlusCount);
    countReviewsHighEl.textContent = String(summary.reviews100PlusCount);
    countReputationRepairEl.textContent = String(summary.ratingUnder40Count);
    countOppRevNoSiteEl.textContent = String(summary.highReviewsNoWebsiteCount);
    countOppRateNoSiteEl.textContent = String(summary.highRatingNoWebsiteCount);
  } catch (err) {
    // Fallback using session counters if direct IndexedDB fetch fails
    intelCountTotalEl.textContent = `${session.processedCount} Leads`;
    countWebsiteEl.textContent = String(session.websiteCount);
    countSocialEl.textContent = String(session.socialCount);
    countNoWebsiteEl.textContent = String(session.noWebsiteCount);
  }

  // Controls Visibility
  if (session.status === "running") {
    btnStart.style.display = "none";
    runningControls.style.display = "flex";
    pausedControls.style.display = "none";
  } else if (session.status === "paused") {
    btnStart.style.display = "none";
    runningControls.style.display = "none";
    pausedControls.style.display = "flex";
  } else {
    btnStart.style.display = "block";
    btnStart.disabled = false;
    btnStart.textContent = session.status === "completed" ? "Restart Extraction" : "Start Extraction";
    runningControls.style.display = "none";
    pausedControls.style.display = "none";
  }

  // Alert Banner
  if (session.status === "paused" && session.pauseReason === "verification_required") {
    alertBannerEl.className = "alert-banner error";
    alertBannerEl.style.display = "flex";
    alertIconEl.innerHTML = renderIcon("alert-circle", 16);
    alertTextEl.textContent =
      "Google Maps requires verification. Extraction has paused. Complete the verification in the tab, then click Resume.";
  } else if (session.status === "paused" && session.pauseReason === "error_threshold") {
    alertBannerEl.className = "alert-banner warning";
    alertBannerEl.style.display = "flex";
    alertIconEl.innerHTML = renderIcon("alert-triangle", 16);
    alertTextEl.textContent = "Extraction paused after repeated errors. Check the Maps tab, then resume.";
  } else {
    alertBannerEl.style.display = "none";
  }

  footerStatusEl.textContent = `Session ${session.status} · Auto-saved locally`;
}

// Update Media & Reviews UI
function updateDetectedBizUI(target: DetectedBusinessTarget | null): void {
  detectedTarget = target;
  if (target) {
    detectedBizCard.style.display = "flex";
    detectedBizName.textContent = target.business_name;
    detectedBizAddress.textContent = target.address_preview || "Google Maps Business Listing";
    detectedBizNote.style.display = target.confidence === "low" ? "block" : "none";
    if (!confirmedTarget) {
      updateConfirmedTargetUI(target);
    }
  } else {
    detectedBizCard.style.display = "none";
  }
}

function updateConfirmedTargetUI(target: DetectedBusinessTarget | null): void {
  confirmedTarget = target;
  if (target) {
    confirmedTargetCard.style.display = "block";
    targetBizName.textContent = target.business_name;
    targetBizUrl.textContent = target.maps_url;
    btnMediaStart.disabled = false;
  } else {
    confirmedTargetCard.style.display = "none";
    btnMediaStart.disabled = true;
  }
}

function updateMediaJobUI(job: MediaReviewJob | null): void {
  currentMediaJob = job;
  if (!job) {
    mediaProgressSection.style.display = "none";
    btnMediaStart.style.display = "block";
    mediaRunningControls.style.display = "none";
    mediaPausedControls.style.display = "none";
    return;
  }

  mediaProgressSection.style.display = "block";

  // Media Track
  mediaTrackBadge.textContent = job.mediaStatus.toUpperCase();
  mediaTrackBadge.className = `chip ${
    job.mediaStatus === "running"
      ? "chip-accent"
      : job.mediaStatus === "complete"
      ? "chip-success"
      : "chip-neutral"
  }`;
  if (job.mediaProgress.photosExtracted > 0 || job.mediaProgress.photosFound > 0) {
    mediaTrackFraction.textContent = `${job.mediaProgress.photosExtracted} extracted · ${job.mediaProgress.photosFound} discovered`;
  } else {
    mediaTrackFraction.textContent = "0 extracted · 0 discovered";
  }
  const maxP = job.settingsSnapshot.maxPhotos > 0 ? job.settingsSnapshot.maxPhotos : Math.max(1, job.mediaProgress.photosFound);
  const mediaPct = job.mediaProgress.photosExtracted > 0 ? Math.min(100, (job.mediaProgress.photosExtracted / maxP) * 100) : 0;
  mediaTrackBar.style.width = `${mediaPct}%`;

  // Review Track
  reviewTrackBadge.textContent = job.reviewStatus.toUpperCase();
  reviewTrackBadge.className = `chip ${
    job.reviewStatus === "running"
      ? "chip-accent"
      : job.reviewStatus === "complete"
      ? "chip-success"
      : "chip-neutral"
  }`;
  if (job.reviewProgress.reviewsAvailable && job.reviewProgress.reviewsAvailable > 0) {
    reviewTrackFraction.textContent = `${job.reviewProgress.reviewsExtracted} / ${job.reviewProgress.reviewsAvailable} extracted (${job.reviewProgress.reviewsFound} discovered)`;
    const reviewPct = Math.min(100, (job.reviewProgress.reviewsExtracted / job.reviewProgress.reviewsAvailable) * 100);
    reviewTrackBar.style.width = `${reviewPct}%`;
  } else if (job.reviewProgress.reviewsExtracted > 0 || job.reviewProgress.reviewsFound > 0) {
    reviewTrackFraction.textContent = `${job.reviewProgress.reviewsExtracted} extracted · ${job.reviewProgress.reviewsFound} discovered`;
    const maxR = job.settingsSnapshot.maxReviews > 0 ? job.settingsSnapshot.maxReviews : Math.max(1, job.reviewProgress.reviewsFound);
    const reviewPct = Math.min(100, (job.reviewProgress.reviewsExtracted / maxR) * 100);
    reviewTrackBar.style.width = `${reviewPct}%`;
  } else {
    reviewTrackFraction.textContent = "0 extracted · 0 discovered";
    reviewTrackBar.style.width = "0%";
  }

  // Controls
  const isRunning = job.mediaStatus === "running" || job.reviewStatus === "running";
  const isPaused = job.mediaStatus === "paused" || job.reviewStatus === "paused";

  if (isRunning) {
    btnMediaStart.style.display = "none";
    mediaRunningControls.style.display = "flex";
    mediaPausedControls.style.display = "none";
  } else if (isPaused) {
    btnMediaStart.style.display = "none";
    mediaRunningControls.style.display = "none";
    mediaPausedControls.style.display = "flex";
  } else {
    btnMediaStart.style.display = "block";
    btnMediaStart.textContent = job.status === "completed" ? "Restart Job" : "Start Extraction";
    mediaRunningControls.style.display = "none";
    mediaPausedControls.style.display = "none";
  }
}

// Manual URL validation (PRD §6.3)
inputBizUrl.addEventListener("input", () => {
  const val = inputBizUrl.value.trim();
  bizUrlError.style.display = "none";

  if (!val) {
    btnLoadBizUrl.disabled = true;
    return;
  }

  try {
    const parsed = new URL(val);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("google.com") && !host.includes("goo.gl")) {
      bizUrlError.textContent = "This URL is not a Google Maps address.";
      bizUrlError.style.display = "block";
      btnLoadBizUrl.disabled = true;
      return;
    }

    if (parsed.pathname.includes("/maps/search/")) {
      bizUrlError.textContent = "This looks like a search results URL. Provide a URL for a single business.";
      bizUrlError.style.display = "block";
      btnLoadBizUrl.disabled = true;
      return;
    }

    btnLoadBizUrl.disabled = false;
  } catch {
    bizUrlError.textContent = "Enter a valid URL.";
    bizUrlError.style.display = "block";
    btnLoadBizUrl.disabled = true;
  }
});

btnLoadBizUrl.addEventListener("click", () => {
  const url = inputBizUrl.value.trim();
  if (!url) return;

  const placeId = extractPlaceIdentifier(url);
  const guessedName = url.match(/\/maps\/place\/([^/@?]+)/)?.[1]
    ? decodeURIComponent(url.match(/\/maps\/place\/([^/@?]+)/)![1].replace(/\+/g, " "))
    : "Pasted Business";

  updateConfirmedTargetUI({
    business_name: guessedName,
    address_preview: null,
    maps_url: url,
    confidence: placeId ? "high" : "low",
  });
});

btnUseDetectedBiz.addEventListener("click", () => {
  if (detectedTarget) {
    updateConfirmedTargetUI(detectedTarget);
  }
});

// Media Start/Pause/Resume/Stop
btnMediaStart.addEventListener("click", () => {
  const target = confirmedTarget || detectedTarget;
  if (!target) return;
  if (!confirmedTarget) updateConfirmedTargetUI(target);

  chrome.runtime.sendMessage({
    type: "START_MEDIA_REVIEW_JOB",
    target,
    settings: {
      extractPhotos: chkPhotos.checked,
      extractVideos: chkVideos.checked,
      extractReviews: chkReviews.checked,
    },
  });
});

btnMediaPause.addEventListener("click", () => {
  if (currentMediaJob) {
    chrome.runtime.sendMessage({ type: "PAUSE_MEDIA_REVIEW_JOB", jobId: currentMediaJob.jobId });
  }
});

btnMediaResume.addEventListener("click", () => {
  if (currentMediaJob) {
    chrome.runtime.sendMessage({ type: "RESUME_MEDIA_REVIEW_JOB", jobId: currentMediaJob.jobId });
  }
});

btnMediaStop.addEventListener("click", () => {
  if (confirm("Stop extraction? All extracted media and reviews will be preserved.")) {
    if (currentMediaJob) {
      chrome.runtime.sendMessage({ type: "STOP_MEDIA_REVIEW_JOB", jobId: currentMediaJob.jobId });
    }
  }
});

btnMediaStopPaused.addEventListener("click", () => {
  if (confirm("Stop extraction? All extracted media and reviews will be preserved.")) {
    if (currentMediaJob) {
      chrome.runtime.sendMessage({ type: "STOP_MEDIA_REVIEW_JOB", jobId: currentMediaJob.jobId });
    }
  }
});

btnExportMediaCsv.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    type: "EXPORT_MEDIA_REVIEWS",
    businessId: currentMediaJob?.businessId,
    format: "media_csv",
  });
});

btnExportReviewsCsv.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    type: "EXPORT_MEDIA_REVIEWS",
    businessId: currentMediaJob?.businessId,
    format: "reviews_csv",
  });
});

const btnExportCombinedJson = document.getElementById("btn-export-combined-json") as HTMLButtonElement | null;
btnExportCombinedJson?.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    type: "EXPORT_MEDIA_REVIEWS",
    businessId: currentMediaJob?.businessId,
    format: "combined_json",
  });
});

btnMediaOpenDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/ui/dashboard/dashboard.html") });
});

// Initial tab queries and state fetch
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0];
  if (
    activeTab?.id &&
    activeTab.url &&
    (activeTab.url.includes("google.com/maps") || activeTab.url.includes("maps.google.com"))
  ) {
    isOnGoogleMaps = true;
    chrome.runtime.sendMessage({ type: "ENSURE_CONTENT_SCRIPT", tabId: activeTab.id });
    chrome.tabs.sendMessage(activeTab.id, { type: "TRIGGER_PAGE_SCAN" }, () => {
      if (chrome.runtime.lastError) {
        // Handled after injection
      }
    });
  }

  chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.settings) {
      currentSettings = response.settings;
    }
    if (response?.session) {
      updateSearchUI(response.session);
    } else {
      updateSearchUI(null);
    }

    if (response?.detectedTarget) {
      updateDetectedBizUI(response.detectedTarget);
    }

    if (response?.mediaReviewJob) {
      updateMediaJobUI(response.mediaReviewJob);
      updateConfirmedTargetUI({
        business_name: response.mediaReviewJob.businessName,
        address_preview: null,
        maps_url: response.mediaReviewJob.sourceUrl,
        confidence: "high",
      });
    }
  });
});

// Message listener
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_UPDATED") {
    updateSearchUI(message.session);
  } else if (message.type === "SETTINGS_UPDATED") {
    currentSettings = message.settings;
    chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
      if (response?.session) updateSearchUI(response.session);
      else updateSearchUI(null);
    });
  } else if (message.type === "BUSINESS_TARGET_DETECTED") {
    updateDetectedBizUI(message.target);
  } else if (message.type === "MEDIA_REVIEW_JOB_UPDATED") {
    updateMediaJobUI(message.job);
  }
});

// Storage changes listener for instant settings reflection
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.extractionSettings) {
      currentSettings = changes.extractionSettings.newValue || DEFAULT_EXTRACTION_SETTINGS;
      chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
        if (response?.session) updateSearchUI(response.session);
        else updateSearchUI(null);
      });
    }
  });
}

// Search Mode Buttons
btnStart.addEventListener("click", () => {
  btnStart.disabled = true;
  btnStart.textContent = "Starting...";
  chrome.runtime.sendMessage({ type: "START_EXTRACTION" }, (response) => {
    if (chrome.runtime.lastError || response?.error) {
      btnStart.disabled = false;
      btnStart.textContent = "Start Extraction";
    }
  });
});

btnPause.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PAUSE_EXTRACTION" });
});

btnResume.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESUME_EXTRACTION" });
});

btnStop.addEventListener("click", () => {
  if (confirm("Stop extraction? Already extracted businesses will be saved.")) {
    chrome.runtime.sendMessage({ type: "STOP_EXTRACTION" });
  }
});

btnStopPaused.addEventListener("click", () => {
  if (confirm("Stop extraction? Already extracted businesses will be saved.")) {
    chrome.runtime.sendMessage({ type: "STOP_EXTRACTION" });
  }
});

btnExportCsv.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "EXPORT", format: "csv" });
});

btnExportJson.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "EXPORT", format: "json" });
});

btnOpenDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/ui/dashboard/dashboard.html") });
});

btnOpenLeadIntelligence?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/ui/dashboard/dashboard.html#lead-intelligence") });
});

btnSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Speed Mode Presets Control
const btnSpeedTurbo = document.getElementById("btn-speed-turbo") as HTMLButtonElement | null;
const btnSpeedFast = document.getElementById("btn-speed-fast") as HTMLButtonElement | null;
const btnSpeedStandard = document.getElementById("btn-speed-standard") as HTMLButtonElement | null;
const liveSpeedBadge = document.getElementById("live-speed-badge") as HTMLElement | null;

function updateSpeedUI(settings: typeof currentSettings): void {
  const preset = settings.speedPreset || "standard";
  btnSpeedTurbo?.classList.toggle("active", preset === "turbo");
  btnSpeedFast?.classList.toggle("active", preset === "fast");
  btnSpeedStandard?.classList.toggle("active", preset === "standard");

  if (liveSpeedBadge) {
    if (preset === "turbo") liveSpeedBadge.textContent = "Turbo (2-5s)";
    else if (preset === "fast") liveSpeedBadge.textContent = "Fast (4-7s)";
    else if (preset === "standard") liveSpeedBadge.textContent = "Human (5-10s)";
    else liveSpeedBadge.textContent = `Custom (${settings.minDelaySeconds}s-${settings.maxDelaySeconds}s)`;
  }
}

function handleSpeedPresetClick(preset: SpeedPreset): void {
  const updated = applySpeedPreset(preset, currentSettings);
  currentSettings = updated;
  updateSpeedUI(updated);
  chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings: updated });
}

btnSpeedTurbo?.addEventListener("click", () => handleSpeedPresetClick("turbo"));
btnSpeedFast?.addEventListener("click", () => handleSpeedPresetClick("fast"));
btnSpeedStandard?.addEventListener("click", () => handleSpeedPresetClick("standard"));

// Initial speed UI sync
updateSpeedUI(currentSettings);

// ============================================================
// LinkedIn Connect UI logic
// ============================================================

function updateLinkedInUI(session: LinkedInSession | null): void {
  currentLinkedInSession = session;

  if (!session) {
    if (liSearchQueryEl) liSearchQueryEl.textContent = "No LinkedIn search page detected";
    if (liDetectedCountEl) liDetectedCountEl.textContent = "Open a LinkedIn People search page to begin";
    if (liAlertBannerEl) liAlertBannerEl.style.display = "none";
    if (liProgressFractionEl) liProgressFractionEl.textContent = "0 / 0";
    if (liProgressBarFillEl) liProgressBarFillEl.style.width = "0%";
    if (liStatConnectedEl) liStatConnectedEl.textContent = "0";
    if (liStatSkippedEl) liStatSkippedEl.textContent = "0";
    if (liStatFailedEl) liStatFailedEl.textContent = "0";
    if (liStatPendingEl) liStatPendingEl.textContent = "0";
    if (liBtnStart) { liBtnStart.style.display = "block"; liBtnStart.disabled = true; }
    if (liRunningControls) liRunningControls.style.display = "none";
    if (liPausedControls) liPausedControls.style.display = "none";
    return;
  }

  // Query / count and Phase status
  let phaseText = "";
  if (session.status === "running" || session.status === "paused") {
    phaseText = session.phase === "scraping" 
      ? " — Phase 1: Scraping Pages" 
      : " — Phase 2: Connecting";
  }

  const queryText = (session.searchQuery || session.sourceUrl || "LinkedIn Search") + phaseText;
  if (liSearchQueryEl) liSearchQueryEl.textContent = queryText;

  const total = session.queue.length;
  const processed = session.processedCount;
  if (liDetectedCountEl) {
    if (session.phase === "scraping" && session.status === "running") {
      liDetectedCountEl.textContent = `${total} profiles discovered (Scanning...)`;
    } else {
      liDetectedCountEl.textContent = `${total} profiles discovered`;
    }
  }

  // Progress
  if (liProgressFractionEl)
    liProgressFractionEl.textContent = `${processed} / ${total}`;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  if (liProgressBarFillEl) liProgressBarFillEl.style.width = `${pct}%`;

  // Stats
  if (liStatConnectedEl) liStatConnectedEl.textContent = String(session.connectedCount);
  if (liStatSkippedEl) liStatSkippedEl.textContent = String(session.skippedCount);
  if (liStatFailedEl) liStatFailedEl.textContent = String(session.failedCount);
  if (liStatPendingEl) liStatPendingEl.textContent = String(session.pendingCount);

  // Alert for paused states
  if (session.status === "paused" && session.pauseReason === "error_threshold") {
    if (liAlertBannerEl) {
      liAlertBannerEl.style.display = "flex";
      liAlertBannerEl.className = "alert-banner alert-error";
    }
    if (liAlertTextEl)
      liAlertTextEl.textContent = "Too many consecutive errors. Check LinkedIn is open and accessible, then resume.";
  } else {
    if (liAlertBannerEl) liAlertBannerEl.style.display = "none";
  }

  // Controls
  const status = session.status;
  if (liBtnStart) liBtnStart.style.display = status === "idle" || status === "stopped" || status === "completed" ? "block" : "none";
  if (liBtnStart) liBtnStart.disabled = false;
  if (liRunningControls) liRunningControls.style.display = status === "running" ? "flex" : "none";
  if (liPausedControls) liPausedControls.style.display = status === "paused" ? "flex" : "none";

  if (liBtnStop) {
    liBtnStop.textContent = session.phase === "scraping" ? "Stop & Connect" : "Stop";
  }
  if (liBtnStopPaused) {
    liBtnStopPaused.textContent = session.phase === "scraping" ? "Stop & Connect" : "Stop";
  }
}

// Button wiring — LinkedIn
liBtnStart?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_LINKEDIN_SESSION" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.error) {
      if (liAlertBannerEl) liAlertBannerEl.style.display = "flex";
      if (liAlertTextEl) liAlertTextEl.textContent = res.error;
    }
    if (res?.session) updateLinkedInUI(res.session);
  });
});

liBtnPause?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PAUSE_LINKEDIN_SESSION" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.session) updateLinkedInUI(res.session);
  });
});

liBtnStop?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_LINKEDIN_SESSION" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.session) updateLinkedInUI(res.session);
  });
});

liBtnResume?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESUME_LINKEDIN_SESSION" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.session) updateLinkedInUI(res.session);
  });
});

liBtnStopPaused?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_LINKEDIN_SESSION" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.session) updateLinkedInUI(res.session);
  });
});

liBtnExportCsv?.addEventListener("click", () => {
  const sessionId = currentLinkedInSession?.sessionId;
  if (!sessionId) return;
  chrome.runtime.sendMessage({ type: "EXPORT_LINKEDIN_PROFILES", sessionId, format: "csv" });
});

liBtnExportJson?.addEventListener("click", () => {
  const sessionId = currentLinkedInSession?.sessionId;
  if (!sessionId) return;
  chrome.runtime.sendMessage({ type: "EXPORT_LINKEDIN_PROFILES", sessionId, format: "json" });
});

// Listen for LinkedIn session broadcasts from the service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "LINKEDIN_SESSION_UPDATED") {
    updateLinkedInUI(message.session);
  }
});

// Load initial LinkedIn state on popup open
chrome.runtime.sendMessage({ type: "GET_LINKEDIN_SESSION_STATE" }, (res) => {
  if (chrome.runtime.lastError) return;
  if (res?.session) updateLinkedInUI(res.session);
});
