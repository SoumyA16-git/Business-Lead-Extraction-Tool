/**
 * Background Service Worker
 * Defined in PRD Sections 14, 22, and 24
 */

import { extractPlaceIdentifier } from "../adapters/google-maps/extractors/place-identifier";
import { DetectedBusinessTarget } from "../core/adapters/platform-adapter";
import { MediaReviewOrchestrator } from "../core/engine/media-review-orchestrator";
import { ExtractionOrchestrator } from "../core/engine/orchestrator";
import { createExtractionSession, enqueueDiscoveredCards } from "../core/engine/queue";
import { toCsv } from "../core/export/csv";
import { toJson } from "../core/export/json";
import { toVcf } from "../core/export/vcf";
import {
  serializeCombinedJson,
  serializeMediaCsv,
  serializeReviewsCsv,
} from "../core/export/media-reviews-export";
import { BusinessRecord, RawBusinessData } from "../core/schema/business-record";
import { MediaReviewJob } from "../core/schema/media-review-job";
import { ExtractionSession, QueueItem } from "../core/schema/session";
import { clearEntireDatabase, getDb } from "../core/storage/db";
import {
  getMediaRecordsByBusiness,
  getMediaReviewJob,
  getReviewRecordsByBusiness,
  saveMediaReviewJob,
} from "../core/storage/media-reviews-repo";
import { getRecord, getRecordsBySession } from "../core/storage/records-repo";
import {
  bulkDeleteSessions,
  deleteSession,
  getAllSessions,
  getSession,
  renameSession,
  saveSession,
} from "../core/storage/sessions-repo";
import { ExtensionMessage } from "../shared/messages";
import { DEFAULT_EXTRACTION_SETTINGS, validateSettings } from "../shared/settings";
import { WhatsAppOrchestrator } from "../core/engine/whatsapp-orchestrator";
import {
  getAllOutreachRecords,
  getOutreachTemplates,
  saveOutreachTemplate,
  deleteOutreachTemplate,
} from "../core/storage/whatsapp-outreach-repo";
import {
  DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
} from "../core/schema/whatsapp-outreach";
import { LinkedInOrchestrator, createLinkedInSession, enqueueLinkedInCards } from "../core/engine/linkedin-orchestrator";
import {
  saveLinkedInSession,
  getLinkedInSession,
  getAllLinkedInSessions,
  deleteLinkedInSession,
  getProfilesBySession,
} from "../core/storage/linkedin-repo";
import { toLinkedInCsv, toLinkedInJson } from "../core/export/linkedin-export";
import { LinkedInSession } from "../core/schema/linkedin-profile";
import { LinkedInCampaignOrchestrator } from "../core/engine/linkedin-campaign-orchestrator";

let activeSession: ExtractionSession | null = null;
let activeTabId: number | null = null;
let orchestrator: ExtractionOrchestrator | null = null;

let activeMediaReviewJob: MediaReviewJob | null = null;
let mediaReviewOrchestrator: MediaReviewOrchestrator | null = null;
let lastDetectedBusinessTarget: DetectedBusinessTarget | null = null;

let activeWhatsAppOrchestrator: WhatsAppOrchestrator | null = null;
let whatsAppTabId: number | null = null;

let activeLinkedInSession: LinkedInSession | null = null;
let linkedInTabId: number | null = null;
let linkedInOrchestrator: LinkedInOrchestrator | null = null;
let activeLinkedInCampaign: LinkedInCampaignOrchestrator | null = null;

async function ensureWhatsAppTab(): Promise<number> {
  if (whatsAppTabId) {
    try {
      const tab = await chrome.tabs.get(whatsAppTabId);
      if (tab && tab.url && tab.url.includes("web.whatsapp.com")) {
        return whatsAppTabId;
      }
    } catch {
      whatsAppTabId = null;
    }
  }

  const tabs = await chrome.tabs.query({ url: "*://web.whatsapp.com/*" });
  if (tabs.length > 0 && tabs[0].id) {
    whatsAppTabId = tabs[0].id;
    return whatsAppTabId;
  }

  const newTab = await chrome.tabs.create({
    url: "https://web.whatsapp.com",
    pinned: true,
    active: false,
  });
  whatsAppTabId = newTab.id || null;
  if (!whatsAppTabId) {
    throw new Error("Failed to create WhatsApp Web tab");
  }

  await new Promise((r) => setTimeout(r, 3500));
  return whatsAppTabId;
}

async function navigateWhatsAppTab(url: string): Promise<void> {
  const tabId = await ensureWhatsAppTab();
  await chrome.tabs.update(tabId, { url });
}

async function ensureWhatsAppContentScriptInjected(tabId: number): Promise<void> {
  try {
    const pingRes = await chrome.tabs.sendMessage(tabId, { type: "CHECK_WHATSAPP_STATE" }).catch(() => null);
    if (!pingRes) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-scripts/whatsapp-web/index.js"],
      });
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    console.debug("[Service Worker] Could not inject WhatsApp content script:", err);
  }
}

// LinkedIn helpers
async function ensureLinkedInContentScriptInjected(tabId: number): Promise<void> {
  try {
    const pingRes = (await chrome.tabs.sendMessage(tabId, { type: "PING" }).catch(() => null)) as
      | { pong?: boolean }
      | undefined;
    if (!pingRes?.pong) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-scripts/linkedin/index.js"],
      });
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) {
    console.debug("[Service Worker] Could not inject LinkedIn content script:", err);
  }
}

async function sendToLinkedIn(msg: unknown, timeoutMs = 18000): Promise<unknown> {
  if (!linkedInTabId) {
    const tabs = await chrome.tabs.query({ url: "*://www.linkedin.com/*" });
    if (tabs[0]?.id) linkedInTabId = tabs[0].id;
  }

  if (!linkedInTabId) {
    throw new Error("No active LinkedIn tab found. Please open LinkedIn in your browser.");
  }

  await ensureLinkedInContentScriptInjected(linkedInTabId);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, reason: `LinkedIn script timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    chrome.tabs.sendMessage(linkedInTabId!, msg, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ success: false, reason: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function getLinkedInOrchestrator(): LinkedInOrchestrator {
  if (!activeLinkedInSession) {
    throw new Error("No active LinkedIn session");
  }
  if (!linkedInOrchestrator || linkedInOrchestrator.getSession().sessionId !== activeLinkedInSession.sessionId) {
    linkedInOrchestrator = new LinkedInOrchestrator(activeLinkedInSession, {
      sendToLinkedIn,
      broadcastToUI,
    });
  }
  return linkedInOrchestrator;
}

async function sendToWhatsAppTab(msg: unknown, timeoutMs = 180000): Promise<unknown> {
  const tabId = await ensureWhatsAppTab();
  await ensureWhatsAppContentScriptInjected(tabId);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, reason: `WhatsApp script timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, msg, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ success: false, reason: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function broadcastToUI(msg: unknown): void {
  try {
    chrome.runtime.sendMessage(msg).catch(() => {
      // No open popup or dashboard listening
    });
  } catch {
    // ignore
  }
}

async function sendToContent(msg: unknown, timeoutMs = 28000): Promise<unknown> {
  if (!activeTabId) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (
        tabs[0]?.id &&
        tabs[0].url &&
        (tabs[0].url.includes("google.com/maps") || tabs[0].url.includes("maps.google.com"))
      ) {
        activeTabId = tabs[0].id;
      } else {
        const allMapsTabs = await chrome.tabs.query({ url: "*://*.google.com/maps/*" });
        if (allMapsTabs[0]?.id) {
          activeTabId = allMapsTabs[0].id;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!activeTabId) {
    throw new Error("No active Google Maps tab connected");
  }

  await ensureContentScriptInjected(activeTabId);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Content script message timed out after ${timeoutMs}ms: ${(msg as any)?.type}`));
    }, timeoutMs);

    chrome.tabs.sendMessage(activeTabId!, msg, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        console.debug("[Service Worker] sendToContent error:", chrome.runtime.lastError.message);
        resolve(undefined);
        return;
      }
      resolve(response);
    });
  });
}

async function requestRawExtraction(queueItem: QueueItem): Promise<RawBusinessData> {
  const res = (await sendToContent({
    type: "OPEN_BUSINESS",
    queueId: queueItem.queueId,
    cardRef: queueItem.cardRef,
    name: queueItem.name,
    discoveryIndex: queueItem.discoveryIndex,
  })) as { raw?: RawBusinessData; error?: string } | undefined;

  if (res?.raw && res.raw.name) {
    return res.raw;
  }

  if (res?.error) {
    if (res.error === "verification_required") {
      throw new Error("verification_required");
    }
    // If detail panel threw an error, check if queueItem already holds discovered feed data
    if (queueItem.name && (queueItem.phone || queueItem.address || queueItem.category || queueItem.website)) {
      console.log(`[Service Worker] Recovering lead "${queueItem.name}" from queueItem data after detail error:`, res.error);
      return {
        name: queueItem.name,
        primaryCategory: queueItem.category || "Local Business",
        rating: queueItem.rating ?? null,
        reviewCount: queueItem.reviewCount ?? null,
        address: queueItem.address || null,
        phone: queueItem.phone || null,
        websiteUrl: queueItem.website || null,
        mapsUrl: queueItem.cardRef || null,
        placeIdentifier: extractPlaceIdentifier(queueItem.cardRef),
      };
    }
    throw new Error(`Target detail panel error: ${res.error}`);
  }

  if (queueItem.name && (queueItem.phone || queueItem.address || queueItem.category || queueItem.website)) {
    return {
      name: queueItem.name,
      primaryCategory: queueItem.category || "Local Business",
      rating: queueItem.rating ?? null,
      reviewCount: queueItem.reviewCount ?? null,
      address: queueItem.address || null,
      phone: queueItem.phone || null,
      websiteUrl: queueItem.website || null,
      mapsUrl: queueItem.cardRef || null,
      placeIdentifier: extractPlaceIdentifier(queueItem.cardRef),
    };
  }

  throw new Error("Empty raw extraction received from target detail panel");
}

function getOrchestrator(): ExtractionOrchestrator {
  if (!activeSession) {
    throw new Error("No active session initialized");
  }
  if (!orchestrator || orchestrator.getSession().sessionId !== activeSession.sessionId) {
    orchestrator = new ExtractionOrchestrator(activeSession, {
      sendToContent,
      broadcastToUI,
      requestRawExtraction,
    });
  }
  return orchestrator;
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    const pingRes = (await chrome.tabs.sendMessage(tabId, { type: "PING" }).catch(() => null)) as
      | { pong?: boolean }
      | undefined;
    if (!pingRes?.pong) {
      console.log("[Service Worker] Content script not responding in tab", tabId, "- injecting...");
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-scripts/google-maps/index.js"],
      });
    }
  } catch (err) {
    console.debug("[Service Worker] Could not inject content script:", err);
  }
}

// Service worker startup: recover active session pointer from local storage
async function initializeWorker(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(["activeSessionId", "extractionSettings"]);
    if (data.activeSessionId) {
      const recovered = await getSession(data.activeSessionId);
      if (recovered && recovered.status !== "stopped" && recovered.status !== "completed") {
        activeSession = recovered;
        // Keep paused if recovering from restart
        if (activeSession.status === "running") {
          activeSession.status = "paused";
          activeSession.pauseReason = "user";
          await saveSession(activeSession);
        }
      }
    }

    const jobData = await chrome.storage.local.get("activeMediaReviewJobId");
    if (jobData.activeMediaReviewJobId) {
      const recoveredJob = await getMediaReviewJob(jobData.activeMediaReviewJobId);
      if (recoveredJob && recoveredJob.status !== "stopped" && recoveredJob.status !== "completed") {
        activeMediaReviewJob = recoveredJob;
        if (activeMediaReviewJob.status === "running") {
          activeMediaReviewJob.status = "paused";
          await saveMediaReviewJob(activeMediaReviewJob);
        }
      }
    }
  } catch (err) {
    console.debug("[Service Worker] Initialization error:", err);
  }
}

initializeWorker();

const WORKER_HANDLED_MESSAGES = new Set([
  "GET_CURRENT_STATE",
  "GET_SETTINGS",
  "UPDATE_SETTINGS",
  "ENSURE_CONTENT_SCRIPT",
  "START_EXTRACTION",
  "PAUSE_EXTRACTION",
  "RESUME_EXTRACTION",
  "STOP_EXTRACTION",
  "RETRY_FAILED",
  "CLEAR_SESSION",
  "GET_ALL_SESSIONS",
  "LOAD_SESSION",
  "DELETE_SESSION",
  "BULK_DELETE_SESSIONS",
  "RENAME_SESSION",
  "SET_ACTIVE_SESSION",
  "SEARCH_PAGE_DETECTED",
  "BUSINESS_CARDS_DISCOVERED",
  "CARDS_DISCOVERED",
  "VERIFICATION_DETECTED",
  "PAGE_SCAN_COMPLETED",
  "CLOSE_ACTIVE_SESSION",
  "CLEAR_ALL_DATA",
  "EXPORT",
  "BUSINESS_PAGE_DETECTED",
  "MEDIA_ITEMS_DISCOVERED",
  "REVIEWS_DISCOVERED",
  "MEDIA_DISCOVERY_EXHAUSTED",
  "REVIEWS_DISCOVERY_EXHAUSTED",
  "START_MEDIA_REVIEW_JOB",
  "PAUSE_MEDIA_REVIEW_JOB",
  "RESUME_MEDIA_REVIEW_JOB",
  "STOP_MEDIA_REVIEW_JOB",
  "GET_MEDIA_REVIEW_JOB",
  "GET_MEDIA_RECORDS",
  "GET_REVIEW_RECORDS",
  "EXPORT_MEDIA_REVIEWS",
  "START_WHATSAPP_CAMPAIGN",
  "PAUSE_WHATSAPP_CAMPAIGN",
  "RESUME_WHATSAPP_CAMPAIGN",
  "STOP_WHATSAPP_CAMPAIGN",
  "GET_WHATSAPP_CAMPAIGN_STATE",
  "GET_WHATSAPP_OUTREACH_HISTORY",
  "GET_WHATSAPP_TEMPLATES",
  "SAVE_WHATSAPP_TEMPLATE",
  "DELETE_WHATSAPP_TEMPLATE",
  "LINKEDIN_PAGE_DETECTED",
  "LINKEDIN_PROFILE_CARDS_DISCOVERED",
  "START_LINKEDIN_SESSION",
  "PAUSE_LINKEDIN_SESSION",
  "RESUME_LINKEDIN_SESSION",
  "STOP_LINKEDIN_SESSION",
  "GET_LINKEDIN_SESSION_STATE",
  "GET_ALL_LINKEDIN_SESSIONS",
  "GET_LINKEDIN_PROFILES",
  "DELETE_LINKEDIN_SESSION",
  "EXPORT_LINKEDIN_PROFILES",
  "START_LINKEDIN_CAMPAIGN",
]);

// Message routing
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // Validate sender and ensure message is handled by worker
  if (sender.id !== chrome.runtime.id) return false;
  if (!message || !message.type || !WORKER_HANDLED_MESSAGES.has(message.type)) {
    return false; // Do not hold message channel open for UI broadcast messages
  }

  if (sender.tab?.id) {
    activeTabId = sender.tab.id;
  }

  (async () => {
    try {
      switch (message.type) {
        case "GET_CURRENT_STATE": {
          const stored = await chrome.storage.local.get(["activeSessionId", "extractionSettings"]);
          const currentSettings = stored.extractionSettings || DEFAULT_EXTRACTION_SETTINGS;

          if (!activeSession) {
            // Check storage for a previously active session
            if (stored.activeSessionId) {
              activeSession = (await getSession(stored.activeSessionId)) || null;
            }
          }

          // Ensure the content script is alive in the current Google Maps tab
          // but do NOT create or modify any session here.
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (
              tab?.id &&
              tab.url &&
              (tab.url.includes("google.com/maps") || tab.url.includes("maps.google.com"))
            ) {
              activeTabId = tab.id;
              await ensureContentScriptInjected(tab.id);
              chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
            }
          } catch (err) {
            console.debug("[Service Worker] Tab check on GET_CURRENT_STATE error:", err);
          }

          let records: BusinessRecord[] = [];
          if (activeSession) {
            records = await getRecordsBySession(activeSession.sessionId);
          }
          sendResponse({
            session: activeSession,
            records,
            settings: currentSettings,
            mediaReviewJob: activeMediaReviewJob,
            detectedTarget: lastDetectedBusinessTarget,
          });
          break;
        }

        case "GET_SETTINGS": {
          const stored = await chrome.storage.local.get("extractionSettings");
          const settings = stored.extractionSettings || DEFAULT_EXTRACTION_SETTINGS;
          sendResponse({ success: true, settings });
          break;
        }

        case "UPDATE_SETTINGS": {
          const newSettings = validateSettings(message.settings || {});
          await chrome.storage.local.set({ extractionSettings: newSettings });

          // Propagate immediately into activeSession without requiring clear data
          if (activeSession) {
            activeSession.settingsSnapshot = {
              ...activeSession.settingsSnapshot,
              ...newSettings,
            };
            await saveSession(activeSession);
            if (orchestrator) {
              orchestrator.setSession(activeSession);
            }
            broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
          }

          broadcastToUI({ type: "SETTINGS_UPDATED", settings: newSettings });
          sendResponse({ success: true, settings: newSettings });
          break;
        }

        case "ENSURE_CONTENT_SCRIPT": {
          let targetTabId = message.tabId || activeTabId;
          if (!targetTabId) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) targetTabId = tabs[0].id;
          }
          if (targetTabId) {
            activeTabId = targetTabId;
            await ensureContentScriptInjected(targetTabId);
            chrome.tabs.sendMessage(targetTabId, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
          }
          sendResponse({ success: true });
          break;
        }

        case "GET_ALL_SESSIONS": {
          const sessions = await getAllSessions();
          sendResponse({ sessions });
          break;
        }

        case "LOAD_SESSION": {
          const session = await getSession(message.sessionId);
          if (session) {
            activeSession = session;
            await chrome.storage.local.set({ activeSessionId: session.sessionId });
            orchestrator = null;
            broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
          }
          let sessionRecords: BusinessRecord[] = [];
          if (activeSession) {
            sessionRecords = await getRecordsBySession(activeSession.sessionId);
          }
          sendResponse({ session: activeSession, records: sessionRecords });
          break;
        }

        case "SET_ACTIVE_SESSION": {
          const session = await getSession(message.sessionId);
          if (session) {
            activeSession = session;
            await chrome.storage.local.set({ activeSessionId: session.sessionId });
            orchestrator = null;
            broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
          }
          sendResponse({ session: activeSession });
          break;
        }

        case "RENAME_SESSION": {
          await renameSession(message.sessionId, message.newName);
          if (activeSession && activeSession.sessionId === message.sessionId) {
            activeSession.customName = message.newName;
            broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
          }
          sendResponse({ success: true });
          break;
        }

        case "DELETE_SESSION": {
          await deleteSession(message.sessionId);
          if (activeSession && activeSession.sessionId === message.sessionId) {
            await chrome.storage.local.remove("activeSessionId");
            activeSession = null;
            orchestrator = null;
            broadcastToUI({ type: "SESSION_UPDATED", session: null });
          }
          sendResponse({ success: true });
          break;
        }

        case "BULK_DELETE_SESSIONS": {
          await bulkDeleteSessions(message.sessionIds);
          if (activeSession && message.sessionIds.includes(activeSession.sessionId)) {
            await chrome.storage.local.remove("activeSessionId");
            activeSession = null;
            orchestrator = null;
            broadcastToUI({ type: "SESSION_UPDATED", session: null });
          }
          sendResponse({ success: true });
          break;
        }

        case "ACCURATE_SLEEP": {
          setTimeout(() => {
            sendResponse({ success: true });
          }, (message as any).ms || 0);
          break;
        }

        case "SEARCH_PAGE_DETECTED": {
          const newQuery = message.searchContext.query?.toLowerCase().trim() || "";
          const existingQuery = activeSession?.searchContext.query?.toLowerCase().trim() || "";
          const isSameQuery = Boolean(existingQuery && newQuery && existingQuery === newQuery);
          const sessionStatus = activeSession?.status;

          // If no active session, or session was completed/stopped/failed, or query changed in idle/paused state:
          // instantiate a fresh, isolated session for this search.
          const shouldCreateFreshSession =
            !activeSession ||
            sessionStatus === "completed" ||
            sessionStatus === "stopped" ||
            sessionStatus === "failed" ||
            (!isSameQuery && sessionStatus !== "running");

          if (shouldCreateFreshSession) {
            const stored = await chrome.storage.local.get("extractionSettings");
            const settings = stored.extractionSettings || DEFAULT_EXTRACTION_SETTINGS;
            activeSession = createExtractionSession(
              message.sourceUrl,
              message.searchContext,
              "google_maps",
              settings
            );
            await saveSession(activeSession);
            await chrome.storage.local.set({ activeSessionId: activeSession.sessionId });
            orchestrator = null;
          } else if (activeSession && sessionStatus === "idle" && isSameQuery) {
            // Same query + idle: just refresh the sourceUrl & searchContext
            activeSession.sourceUrl = message.sourceUrl;
            activeSession.searchContext = message.searchContext;
            await saveSession(activeSession);
          }

          broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
          sendResponse({ session: activeSession });
          break;
        }

        case "BUSINESS_CARDS_DISCOVERED": {
          if (activeSession && activeSession.status !== "stopped" && activeSession.status !== "completed") {
            const { addedCount } = enqueueDiscoveredCards(activeSession, message.cards);
            if (addedCount > 0) {
              await saveSession(activeSession);
              broadcastToUI({ type: "SESSION_UPDATED", session: activeSession });
            }
          }
          sendResponse({ success: true });
          break;
        }

        case "VERIFICATION_DETECTED": {
          if (activeSession && activeSession.status === "running") {
            const orch = getOrchestrator();
            await orch.pause("verification_required");
          }
          sendResponse({ success: true });
          break;
        }

        case "START_EXTRACTION": {
          if (!activeTabId) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) activeTabId = tabs[0].id;
          }
          if (activeTabId) {
            await ensureContentScriptInjected(activeTabId);
          }
          if (!activeSession && activeTabId) {
            try {
              await chrome.tabs.sendMessage(activeTabId, { type: "TRIGGER_PAGE_SCAN" });
            } catch (err) {
              console.debug("[Service Worker] Rescan during START_EXTRACTION error:", err);
            }
          }

          // Always fetch current saved settings from chrome.storage.local
          const stored = await chrome.storage.local.get("extractionSettings");
          const latestSettings = stored.extractionSettings || DEFAULT_EXTRACTION_SETTINGS;

          // If activeSession was already completed/stopped, start fresh for current search
          if (activeSession && (activeSession.status === "completed" || activeSession.status === "stopped")) {
            activeSession = createExtractionSession(
              activeSession.sourceUrl,
              activeSession.searchContext,
              "google_maps",
              latestSettings
            );
            await saveSession(activeSession);
            await chrome.storage.local.set({ activeSessionId: activeSession.sessionId });
            orchestrator = null;
            if (activeTabId) {
              try {
                await chrome.tabs.sendMessage(activeTabId, { type: "TRIGGER_PAGE_SCAN" });
              } catch {
                // ignore
              }
            }
          }

          if (!activeSession) {
            sendResponse({ error: "No active search session found. Please ensure Google Maps search results are open." });
            return;
          }

          // Always merge latest saved settings & any message overrides into activeSession
          activeSession.settingsSnapshot = {
            ...latestSettings,
            ...activeSession.settingsSnapshot,
            ...(message.settings || {}),
          };
          await saveSession(activeSession);

          const orch = getOrchestrator();
          orch.setSession(activeSession);
          await orch.start();
          sendResponse({ success: true, session: activeSession });
          break;
        }

        case "PAUSE_EXTRACTION": {
          if (activeSession) {
            const orch = getOrchestrator();
            await orch.pause("user");
          }
          sendResponse({ success: true, session: activeSession });
          break;
        }

        case "RESUME_EXTRACTION": {
          if (activeSession) {
            const orch = getOrchestrator();
            await orch.resume();
          }
          sendResponse({ success: true, session: activeSession });
          break;
        }

        case "STOP_EXTRACTION": {
          if (activeSession) {
            const orch = getOrchestrator();
            await orch.stop();
          }
          sendResponse({ success: true, session: activeSession });
          break;
        }

        case "RETRY_FAILED": {
          if (activeSession) {
            const orch = getOrchestrator();
            await orch.retryFailed();
          }
          sendResponse({ success: true, session: activeSession });
          break;
        }

        case "CLOSE_ACTIVE_SESSION":
        case "CLEAR_SESSION": {
          if (activeSession) {
            await deleteSession(activeSession.sessionId);
            await chrome.storage.local.remove("activeSessionId");
            activeSession = null;
            orchestrator = null;
          }
          broadcastToUI({ type: "SESSION_UPDATED", session: null });
          if (activeTabId) {
            try {
              await ensureContentScriptInjected(activeTabId);
              chrome.tabs.sendMessage(activeTabId, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
            } catch { }
          }
          sendResponse({ success: true });
          break;
        }

        case "CLEAR_ALL_DATA": {
          await clearEntireDatabase();
          await chrome.storage.local.remove(["activeSessionId", "activeMediaReviewJobId"]);
          activeSession = null;
          orchestrator = null;
          activeMediaReviewJob = null;
          mediaReviewOrchestrator = null;
          lastDetectedBusinessTarget = null;
          broadcastToUI({ type: "SESSION_UPDATED", session: null });
          broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: null });
          if (activeTabId) {
            try {
              await ensureContentScriptInjected(activeTabId);
              chrome.tabs.sendMessage(activeTabId, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
            } catch { }
          }
          sendResponse({ success: true });
          break;
        }

        case "EXPORT": {
          if (!activeSession) {
            sendResponse({ error: "No session to export" });
            return;
          }
          const records = await getRecordsBySession(activeSession.sessionId);
          const sanitizedQuery = (activeSession.searchContext.query || "leads")
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase();
          const timestamp = new Date()
            .toISOString()
            .replace(/[-:]/g, "")
            .slice(0, 15);

          // Prefer inline exportSettings from the dashboard (avoids relying on stale DB snapshot)
          const exportSettings = message.exportSettings || activeSession.settingsSnapshot;

          if (message.format === "csv" || message.format === "both") {
            const csvData = toCsv(records, {
              missingPlaceholder: exportSettings.csvMissingPlaceholder,
              includeDuplicates: exportSettings.includeDuplicateRecords,
              includeInternalIdentifiers: exportSettings.includeInternalIdentifiers,
            });
            const filename = `business-leads_${sanitizedQuery}_${timestamp}.csv`;
            const base64Csv = btoa(unescape(encodeURIComponent(csvData)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${base64Csv}`,
              filename,
              saveAs: false,
            });
          }

          if (message.format === "json" || message.format === "both") {
            const jsonData = toJson(activeSession, records, {
              includeDuplicates: exportSettings.includeDuplicateRecords,
            });
            const filename = `business-leads_${sanitizedQuery}_${timestamp}.json`;
            const base64Json = btoa(unescape(encodeURIComponent(jsonData)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${base64Json}`,
              filename,
              saveAs: false,
            });
          }

          if (message.format === "vcf" || message.format === "both") {
            const vcfData = toVcf(records);
            const filename = `business-contacts_${sanitizedQuery}_${timestamp}.vcf`;
            const base64Vcf = btoa(unescape(encodeURIComponent(vcfData)));
            await chrome.downloads.download({
              url: `data:text/vcard;charset=utf-8;base64,${base64Vcf}`,
              filename,
              saveAs: false,
            });
          }

          sendResponse({ success: true });
          break;
        }


        case "BUSINESS_PAGE_DETECTED": {
          lastDetectedBusinessTarget = message.target;
          broadcastToUI({ type: "BUSINESS_TARGET_DETECTED", target: message.target });
          sendResponse({ success: true });
          break;
        }

        case "MEDIA_ITEMS_DISCOVERED": {
          if (activeMediaReviewJob && mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.handleMediaDiscovered(message.items);
          }
          sendResponse({ success: true });
          break;
        }

        case "REVIEWS_DISCOVERED": {
          if (activeMediaReviewJob && mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.handleReviewsDiscovered(
              message.reviews,
              (message as any).reportedCount
            );
          }
          sendResponse({ success: true });
          break;
        }

        case "MEDIA_DISCOVERY_EXHAUSTED": {
          if (activeMediaReviewJob && mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.handleMediaExhausted();
          }
          sendResponse({ success: true });
          break;
        }

        case "REVIEWS_DISCOVERY_EXHAUSTED": {
          if (activeMediaReviewJob && mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.handleReviewsExhausted();
          }
          sendResponse({ success: true });
          break;
        }

        case "START_MEDIA_REVIEW_JOB": {
          if (!activeTabId) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) activeTabId = tabs[0].id;
          }
          if (activeTabId) {
            await ensureContentScriptInjected(activeTabId);
          }

          const target = message.target;
          const placeId = extractPlaceIdentifier(target.maps_url);
          const businessId = placeId || `biz_${Date.now()}`;

          activeMediaReviewJob = MediaReviewOrchestrator.createJob(
            target,
            businessId,
            message.settings
          );
          await saveMediaReviewJob(activeMediaReviewJob);
          await chrome.storage.local.set({ activeMediaReviewJobId: activeMediaReviewJob.jobId });

          mediaReviewOrchestrator = new MediaReviewOrchestrator(activeMediaReviewJob, {
            sendToContent,
            broadcastToUI,
          });

          await mediaReviewOrchestrator.start();
          sendResponse({ success: true, job: activeMediaReviewJob });
          break;
        }

        case "PAUSE_MEDIA_REVIEW_JOB": {
          if (mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.pause(message.track || "all");
          }
          sendResponse({ success: true, job: activeMediaReviewJob });
          break;
        }

        case "RESUME_MEDIA_REVIEW_JOB": {
          if (mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.resume(message.track || "all");
          }
          sendResponse({ success: true, job: activeMediaReviewJob });
          break;
        }

        case "STOP_MEDIA_REVIEW_JOB": {
          if (mediaReviewOrchestrator) {
            await mediaReviewOrchestrator.stop();
          }
          sendResponse({ success: true, job: activeMediaReviewJob });
          break;
        }

        case "GET_MEDIA_REVIEW_JOB": {
          if (message.jobId) {
            const job = await getMediaReviewJob(message.jobId);
            sendResponse({ job: job || activeMediaReviewJob, target: lastDetectedBusinessTarget });
          } else {
            sendResponse({ job: activeMediaReviewJob, target: lastDetectedBusinessTarget });
          }
          break;
        }

        case "GET_MEDIA_RECORDS": {
          const bizId = message.businessId || activeMediaReviewJob?.businessId || "";
          const media = await getMediaRecordsByBusiness(bizId);
          sendResponse({ media });
          break;
        }

        case "GET_REVIEW_RECORDS": {
          const bizId = message.businessId || activeMediaReviewJob?.businessId || "";
          const reviews = await getReviewRecordsByBusiness(bizId);
          sendResponse({ reviews });
          break;
        }

        case "EXPORT_MEDIA_REVIEWS": {
          const bizId = message.businessId || activeMediaReviewJob?.businessId || "";
          const media = await getMediaRecordsByBusiness(bizId);
          const reviews = await getReviewRecordsByBusiness(bizId);
          let business: BusinessRecord | null = null;
          if (bizId) {
            const found = await getRecord(bizId);
            business = found || null;
          }

          const sanitizedName = (business?.business_name || activeMediaReviewJob?.businessName || "business")
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase();
          const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

          const bizDisplayName = business?.business_name || activeMediaReviewJob?.businessName || "";

          if (message.format === "media_csv" || message.format === "all") {
            const csvData = serializeMediaCsv(media, {}, bizDisplayName);
            const filename = `business-media_${sanitizedName}_${timestamp}.csv`;
            const base64Csv = btoa(unescape(encodeURIComponent(csvData)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${base64Csv}`,
              filename,
              saveAs: false,
            });
          }

          if (message.format === "reviews_csv" || message.format === "all") {
            const csvData = serializeReviewsCsv(reviews, {}, bizDisplayName);
            const filename = `business-reviews_${sanitizedName}_${timestamp}.csv`;
            const base64Csv = btoa(unescape(encodeURIComponent(csvData)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${base64Csv}`,
              filename,
              saveAs: false,
            });
          }

          if (message.format === "combined_json" || message.format === "all") {
            const jsonData = serializeCombinedJson(business, media, reviews);
            const filename = `business-complete_${sanitizedName}_${timestamp}.json`;
            const base64Json = btoa(unescape(encodeURIComponent(jsonData)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${base64Json}`,
              filename,
              saveAs: false,
            });
          }

          sendResponse({ success: true });
          break;
        }

        case "START_WHATSAPP_CAMPAIGN": {
          if (activeWhatsAppOrchestrator && activeWhatsAppOrchestrator.getStatus() === "running") {
            activeWhatsAppOrchestrator.stop();
          }

          const leads = message.leads || [];
          const template = message.template || "";
          const templatePool = Array.isArray(message.templatePool) ? message.templatePool : undefined;
          const sessionId = message.sessionId || activeSession?.sessionId || "manual";
          const settings = message.settings || DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS;

          activeWhatsAppOrchestrator = new WhatsAppOrchestrator(
            leads,
            template,
            sessionId,
            settings,
            {
              sendToWhatsAppTab,
              navigateWhatsAppTab,
              broadcastToUI,
            },
            {
              templatePool,
            }
          );

          activeWhatsAppOrchestrator.start().catch((err) => {
            console.error("[Service Worker] WhatsApp campaign error:", err);
          });

          sendResponse({ success: true });
          break;
        }

        case "PAUSE_WHATSAPP_CAMPAIGN": {
          if (activeWhatsAppOrchestrator) {
            activeWhatsAppOrchestrator.pause();
          }
          sendResponse({ success: true });
          break;
        }

        case "RESUME_WHATSAPP_CAMPAIGN": {
          if (activeWhatsAppOrchestrator) {
            activeWhatsAppOrchestrator.resume();
          }
          sendResponse({ success: true });
          break;
        }

        case "STOP_WHATSAPP_CAMPAIGN": {
          if (activeWhatsAppOrchestrator) {
            activeWhatsAppOrchestrator.stop();
            activeWhatsAppOrchestrator = null;
          }
          broadcastToUI({
            type: "WHATSAPP_CAMPAIGN_PROGRESS",
            progress: {
              status: "stopped",
              totalEligible: 0,
              processedCount: 0,
              sentCount: 0,
              skippedDuplicateCount: 0,
              invalidNumberCount: 0,
              failedCount: 0,
              consecutiveErrors: 0,
              currentBusinessName: undefined,
              nextDelaySeconds: undefined,
            },
          });
          sendResponse({ success: true });
          break;
        }

        case "GET_WHATSAPP_CAMPAIGN_STATE": {
          sendResponse({
            progress: activeWhatsAppOrchestrator ? activeWhatsAppOrchestrator.getProgress() : null,
          });
          break;
        }

        case "GET_WHATSAPP_OUTREACH_HISTORY": {
          const records = await getAllOutreachRecords();
          sendResponse({ records });
          break;
        }

        case "GET_WHATSAPP_TEMPLATES": {
          const templates = await getOutreachTemplates();
          sendResponse({ templates });
          break;
        }

        case "SAVE_WHATSAPP_TEMPLATE": {
          await saveOutreachTemplate(message.template);
          sendResponse({ success: true });
          break;
        }

        case "DELETE_WHATSAPP_TEMPLATE": {
          await deleteOutreachTemplate(message.templateId);
          sendResponse({ success: true });
          break;
        }

        // ----------------------------------------------------------------
        // LinkedIn handlers
        // ----------------------------------------------------------------

        case "LINKEDIN_PAGE_DETECTED": {
          // Content script reports it's on a LinkedIn people search page
          if (sender.tab?.id) linkedInTabId = sender.tab.id;
          const liUrl = (message as any).sourceUrl as string;
          const liQuery = (message as any).searchQuery as string | null;

          // Create a new session if none active or current is done
          const shouldCreate =
            !activeLinkedInSession ||
            activeLinkedInSession.status === "completed" ||
            activeLinkedInSession.status === "stopped" ||
            activeLinkedInSession.status === "failed";

          if (shouldCreate) {
            activeLinkedInSession = createLinkedInSession(liUrl, liQuery);
            await saveLinkedInSession(activeLinkedInSession);
            await chrome.storage.local.set({ activeLinkedInSessionId: activeLinkedInSession.sessionId });
            linkedInOrchestrator = null;
          } else if (activeLinkedInSession && activeLinkedInSession.status === "idle") {
            activeLinkedInSession.sourceUrl = liUrl;
            activeLinkedInSession.searchQuery = liQuery;
            await saveLinkedInSession(activeLinkedInSession);
          }

          broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: activeLinkedInSession });
          sendResponse({ session: activeLinkedInSession });
          break;
        }

        case "LINKEDIN_PROFILE_CARDS_DISCOVERED": {
          if (
            activeLinkedInSession &&
            activeLinkedInSession.status !== "stopped" &&
            activeLinkedInSession.status !== "completed"
          ) {
            const { addedCount } = enqueueLinkedInCards(
              activeLinkedInSession,
              (message as any).cards
            );
            if (addedCount > 0) {
              await saveLinkedInSession(activeLinkedInSession);
              broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: activeLinkedInSession });
            }
          }
          sendResponse({ success: true });
          break;
        }

        case "START_LINKEDIN_SESSION": {
          // Find LinkedIn tab from all open tabs (in case linkedInTabId was lost on service worker restart)
          if (!linkedInTabId) {
            const allLiTabs = await chrome.tabs.query({ url: "*://www.linkedin.com/*" });
            const liSearchTab = allLiTabs.find(
              (t) => t.url?.includes("/search/results/people") || t.url?.includes("/search/results/all")
            ) || allLiTabs[0];
            if (liSearchTab?.id) linkedInTabId = liSearchTab.id;
          }

          if (!activeLinkedInSession) {
            // If still no session, try to create one from the current LinkedIn tab URL
            if (linkedInTabId) {
              const liTab = await chrome.tabs.get(linkedInTabId);
              if (liTab?.url) {
                let searchQuery: string | null = null;
                try { searchQuery = new URL(liTab.url).searchParams.get("keywords"); } catch { }
                activeLinkedInSession = createLinkedInSession(liTab.url, searchQuery);
                await saveLinkedInSession(activeLinkedInSession);
                await chrome.storage.local.set({ activeLinkedInSessionId: activeLinkedInSession.sessionId });
                linkedInOrchestrator = null;
              }
            }
          }

          if (!activeLinkedInSession) {
            sendResponse({ error: "No active LinkedIn session. Open a LinkedIn People search page first." });
            return;
          }

          if (linkedInTabId) {
            await ensureLinkedInContentScriptInjected(linkedInTabId);
            // Initial card scan
            try {
              const scanRes = (await sendToLinkedIn({ type: "LINKEDIN_SCAN_RESULT_CARDS" }, 12000)) as
                | { cards?: any[] }
                | undefined;
              if (scanRes?.cards?.length) {
                enqueueLinkedInCards(activeLinkedInSession, scanRes.cards);
                await saveLinkedInSession(activeLinkedInSession);
              }
            } catch (e) {
              console.debug("[Service Worker] LinkedIn initial scan error:", e);
            }
          }

          const liOrch = getLinkedInOrchestrator();
          await liOrch.start();
          sendResponse({ success: true, session: activeLinkedInSession });
          break;
        }

        case "PAUSE_LINKEDIN_SESSION": {
          if (activeLinkedInSession) {
            const liOrch = getLinkedInOrchestrator();
            await liOrch.pause("user");
          }
          sendResponse({ success: true, session: activeLinkedInSession });
          break;
        }

        case "RESUME_LINKEDIN_SESSION": {
          if (activeLinkedInSession) {
            const liOrch = getLinkedInOrchestrator();
            await liOrch.resume();
          }
          sendResponse({ success: true, session: activeLinkedInSession });
          break;
        }

        case "STOP_LINKEDIN_SESSION": {
          if (activeLinkedInSession) {
            const liOrch = getLinkedInOrchestrator();
            await liOrch.stop();
          }
          sendResponse({ success: true, session: activeLinkedInSession });
          break;
        }

        case "GET_LINKEDIN_SESSION_STATE": {
          // Recover stored session
          const storedLi = await chrome.storage.local.get("activeLinkedInSessionId");
          if (!activeLinkedInSession && storedLi.activeLinkedInSessionId) {
            activeLinkedInSession = (await getLinkedInSession(storedLi.activeLinkedInSessionId)) || null;
          }

          // Find and ping LinkedIn tab to trigger page scan (works after extension reload)
          try {
            const liTabs = await chrome.tabs.query({ url: "*://www.linkedin.com/*" });
            const liSearchTab = liTabs.find(
              (t) => t.url?.includes("/search/results/people") || t.url?.includes("/search/results/all")
            );
            if (liSearchTab?.id) {
              linkedInTabId = liSearchTab.id;
              await ensureLinkedInContentScriptInjected(liSearchTab.id);
              chrome.tabs.sendMessage(liSearchTab.id, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => { });
            }
          } catch (e) {
            console.debug("[Service Worker] LinkedIn tab discovery error:", e);
          }

          sendResponse({ session: activeLinkedInSession });
          break;
        }

        case "GET_ALL_LINKEDIN_SESSIONS": {
          const liSessions = await getAllLinkedInSessions();
          sendResponse({ sessions: liSessions });
          break;
        }

        case "GET_LINKEDIN_PROFILES": {
          const profiles = await getProfilesBySession((message as any).sessionId);
          sendResponse({ profiles });
          break;
        }

        case "DELETE_LINKEDIN_SESSION": {
          await deleteLinkedInSession((message as any).sessionId);
          if (
            activeLinkedInSession &&
            activeLinkedInSession.sessionId === (message as any).sessionId
          ) {
            await chrome.storage.local.remove("activeLinkedInSessionId");
            activeLinkedInSession = null;
            linkedInOrchestrator = null;
            broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: null });
          }
          sendResponse({ success: true });
          break;
        }

        case "EXPORT_LINKEDIN_PROFILES": {
          const sessionId = (message as any).sessionId || activeLinkedInSession?.sessionId;
          if (!sessionId) {
            sendResponse({ error: "No LinkedIn session to export" });
            return;
          }
          const liSession = await getLinkedInSession(sessionId);
          const liProfiles = await getProfilesBySession(sessionId);
          const sanitizedQuery = (liSession?.searchQuery || "linkedin-leads")
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase();
          const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

          if ((message as any).format === "csv" || (message as any).format === "both") {
            const csvData = toLinkedInCsv(liProfiles);
            const filename = `linkedin-connect_${sanitizedQuery}_${timestamp}.csv`;
            const base64Csv = btoa(unescape(encodeURIComponent(csvData)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${base64Csv}`,
              filename,
              saveAs: false,
            });
          }

          if ((message as any).format === "json" || (message as any).format === "both") {
            const jsonData = toLinkedInJson(liSession!, liProfiles);
            const filename = `linkedin-connect_${sanitizedQuery}_${timestamp}.json`;
            const base64Json = btoa(unescape(encodeURIComponent(jsonData)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${base64Json}`,
              filename,
              saveAs: false,
            });
          }

          sendResponse({ success: true });
          break;
        }

        case "START_LINKEDIN_CAMPAIGN": {
          const sessionId = (message as any).sessionId;
          if (!sessionId) {
            sendResponse({ error: "Missing session ID" });
            return;
          }

          if (activeLinkedInCampaign) {
            await activeLinkedInCampaign.stop();
          }

          activeLinkedInCampaign = new LinkedInCampaignOrchestrator(sessionId, {
            broadcastToUI: (msg) => {
              chrome.runtime.sendMessage(msg).catch(() => { });
            },
            openTab: async (url) => {
              const tab = await chrome.tabs.create({ url, active: false });
              return tab.id as number;
            },
            closeTab: async (tabId) => {
              await chrome.tabs.remove(tabId).catch(() => { });
            },
            sendMessageToTab: async (tabId, msg) => {
              return await chrome.tabs.sendMessage(tabId, msg).catch(() => null);
            },
          });

          await activeLinkedInCampaign.start();
          sendResponse({ success: true });
          break;
        }

        case "PAUSE_LINKEDIN_CAMPAIGN": {
          if (activeLinkedInCampaign) {
            activeLinkedInCampaign.pause();
          }
          sendResponse({ success: true });
          break;
        }

        case "STOP_LINKEDIN_CAMPAIGN": {
          if (activeLinkedInCampaign) {
            await activeLinkedInCampaign.stop();
            activeLinkedInCampaign = null;
          }
          sendResponse({ success: true });
          break;
        }

        case "GET_LINKEDIN_CAMPAIGN_STATE": {
          if (activeLinkedInCampaign) {
            sendResponse({ progress: activeLinkedInCampaign.getProgress() });
          } else {
            sendResponse({ progress: null });
          }
          break;
        }

        default: {
          sendResponse({ unhandled: true });
          break;
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ error: errMsg });
    }
  })();

  return true; // async sendResponse
});

// Auto-detect and connect when switching to or updating a Google Maps tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && (tab.url.includes("google.com/maps") || tab.url.includes("maps.google.com"))) {
      activeTabId = tab.id || null;
      if (tab.id) {
        await ensureContentScriptInjected(tab.id);
        const tabIdSnapshot = tab.id;
        setTimeout(() => {
          chrome.tabs.sendMessage(tabIdSnapshot, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
        }, 150);
      }
    }
    // LinkedIn tab detection
    if (tab.url && tab.url.includes("linkedin.com/search/results/people")) {
      linkedInTabId = tab.id || null;
      if (tab.id) {
        await ensureLinkedInContentScriptInjected(tab.id);
        const tabIdSnapshot = tab.id;
        setTimeout(() => {
          chrome.tabs.sendMessage(tabIdSnapshot, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => { });
        }, 200);
      }
    }
  } catch {
    // ignore
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.includes("google.com/maps") || tab.url.includes("maps.google.com"))
  ) {
    activeTabId = tabId;
    await ensureContentScriptInjected(tabId);
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "TRIGGER_PAGE_SCAN" }).catch(() => { });
    }, 200);
  }

  // LinkedIn page load detection
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("linkedin.com/search/results/people")
  ) {
    linkedInTabId = tabId;
    await ensureLinkedInContentScriptInjected(tabId);
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => { });
    }, 300);
  }
});

// Run once on load to fix corrupted DB state from older campaign bugs
(async () => {
  try {
    const db = await getDb();
    const profiles = await db.getAll("linkedin_profiles");
    let fixed = 0;
    for (const p of profiles) {
      if (p.error && p.campaignMessageSent) {
        p.campaignMessageSent = false;
        await db.put("linkedin_profiles", p);
        fixed++;
      }
    }
    if (fixed > 0) {
      console.log(`[DB FIX] Reset ${fixed} failed LinkedIn profiles for retry.`);
    }
  } catch (e) {
    console.error("[DB FIX] Failed to fix corrupted DB state:", e);
  }
})();
