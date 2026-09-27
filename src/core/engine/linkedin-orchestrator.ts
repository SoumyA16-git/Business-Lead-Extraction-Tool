/**
 * LinkedIn Scraping & Auto-Connect Orchestrator
 * Mirrors ExtractionOrchestrator pattern from core/engine/orchestrator.ts
 */

import { getJitteredDelayMs, delayMs } from "../../utils/time";
import {
  LinkedInSession,
  LinkedInSessionStatus,
  LinkedInPauseReason,
  LinkedInQueueItem,
  LinkedInProfileRecord,
  LinkedInWebsiteStatus,
  RawLinkedInCard,
} from "../schema/linkedin-profile";
import {
  saveLinkedInSession,
  saveLinkedInProfile,
} from "../storage/linkedin-repo";

// ---------------------------------------------------------------------------
// Callbacks injected by the service worker (mirrors OrchestratorCallbacks)
// ---------------------------------------------------------------------------
export interface LinkedInOrchestratorCallbacks {
  /** Send a message to the LinkedIn tab content script */
  sendToLinkedIn: (msg: unknown, timeoutMs?: number) => Promise<unknown>;
  /** Broadcast a message to any open popup / dashboard */
  broadcastToUI: (msg: unknown) => void;
}

// ---------------------------------------------------------------------------
// Helper: Generate UUID (browser-safe)
// ---------------------------------------------------------------------------
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------
export function createLinkedInSession(
  sourceUrl: string,
  searchQuery: string | null
): LinkedInSession {
  const now = new Date().toISOString();
  return {
    sessionId: generateUUID(),
    platform: "linkedin",
    sourceUrl,
    searchQuery,
    status: "idle",
    phase: "scraping",
    pauseReason: null,
    createdAt: now,
    updatedAt: now,
    queue: [],
    processedCount: 0,
    connectedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    alreadyConnectedCount: 0,
    pendingCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------
export function enqueueLinkedInCards(
  session: LinkedInSession,
  cards: RawLinkedInCard[]
): { addedCount: number } {
  const existingFingerprints = new Set(
    session.queue.map((q) => q.cardFingerprint)
  );
  let addedCount = 0;

  for (const card of cards) {
    if (existingFingerprints.has(card.cardFingerprint)) continue;
    existingFingerprints.add(card.cardFingerprint);

    const item: LinkedInQueueItem = {
      queueId: generateUUID(),
      sessionId: session.sessionId,
      discoveryIndex: card.discoveryIndex ?? session.queue.length,
      status: "queued",
      profileUrl: card.profileUrl,
      profileType: card.profileType,
      name: card.name,
      headline: card.headline,
      location: card.location,
      profileId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: card.cardFingerprint,
    };

    session.queue.push(item);
    addedCount++;
  }

  session.updatedAt = new Date().toISOString();
  return { addedCount };
}

function getNextQueuedItem(session: LinkedInSession): LinkedInQueueItem | null {
  return session.queue.find((i) => i.status === "queued") || null;
}

// ---------------------------------------------------------------------------
// Main Orchestrator class
// ---------------------------------------------------------------------------
const MAX_RETRIES = 2;
const MAX_CONSECUTIVE_FAILURES = 5;
const MIN_DELAY_S = 5;
const MAX_DELAY_S = 8;

export class LinkedInOrchestrator {
  private session: LinkedInSession;
  private callbacks: LinkedInOrchestratorCallbacks;
  private isLoopRunning = false;
  private consecutiveFailures = 0;
  private loopPromise: Promise<void> | null = null;

  constructor(
    session: LinkedInSession,
    callbacks: LinkedInOrchestratorCallbacks
  ) {
    this.session = session;
    this.callbacks = callbacks;
  }

  public getSession(): LinkedInSession {
    return this.session;
  }

  public setSession(session: LinkedInSession): void {
    this.session = session;
  }

  public getStatus(): LinkedInSessionStatus {
    return this.session.status;
  }

  // ---------- Lifecycle ----------------------------------------------------

  public async start(): Promise<void> {
    if (this.session.status === "running") return;
    this.session.status = "running";
    this.session.pauseReason = null;
    await saveLinkedInSession(this.session);
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session,
    });
    this.loopPromise = this.runLoop();
  }

  public async pause(reason: LinkedInPauseReason = "user"): Promise<void> {
    this.session.status = "paused";
    this.session.pauseReason = reason;
    await saveLinkedInSession(this.session);
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session,
    });
  }

  public async resume(): Promise<void> {
    if (this.session.status === "running") return;
    this.session.status = "running";
    this.session.pauseReason = null;
    this.consecutiveFailures = 0;
    await saveLinkedInSession(this.session);
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session,
    });
    this.loopPromise = this.runLoop();
  }

  public async stop(): Promise<void> {
    if (this.session.phase === "scraping") {
      // If stopped during scraping, transition to connecting
      this.session.phase = "connecting";
      await saveLinkedInSession(this.session);
      this.callbacks.broadcastToUI({
        type: "LINKEDIN_SESSION_UPDATED",
        session: this.session,
      });
      return;
    }

    this.session.status = "stopped";
    this.session.completionReason = "user_stopped";
    await saveLinkedInSession(this.session);
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session,
    });
  }

  public async waitForCompletion(): Promise<LinkedInSession> {
    if (this.loopPromise) await this.loopPromise;
    return this.session;
  }

  // ---------- Main processing loop -----------------------------------------

  private async runLoop(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    try {
      if (!this.session.phase) {
        this.session.phase = "scraping";
        await saveLinkedInSession(this.session);
      }

      if (this.session.phase === "scraping") {
        await this.runScrapingPhase();
      }

      // If scraping finished or we skipped it, and we're still running, do connecting
      if (this.session.phase === "connecting" && this.session.status === "running") {
        await this.runConnectingPhase();
      }
    } finally {
      this.isLoopRunning = false;
    }
  }

  // ---------- Phase 1: Scrape all pages -------------------------------------

  private async runScrapingPhase(): Promise<void> {
    while (this.session.phase === "scraping" && this.session.status === "running") {
      // 1. Scan the current page
      try {
        const res = (await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_SCAN_RESULT_CARDS" },
          12000
        )) as { cards?: RawLinkedInCard[] } | undefined;

        if (res?.cards && res.cards.length > 0) {
          const { addedCount } = enqueueLinkedInCards(this.session, res.cards);
          if (addedCount > 0) {
            await saveLinkedInSession(this.session);
            this.callbacks.broadcastToUI({
              type: "LINKEDIN_SESSION_UPDATED",
              session: this.session,
            });
          }
        }
      } catch (err) {
        console.debug("[LinkedInOrchestrator] Scan cards error:", err);
      }

      if (this.session.status !== "running" || this.session.phase !== "scraping") break;

      // 2. Check for next page
      try {
        const nextRes = (await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_CHECK_NEXT_PAGE" },
          5000
        )) as { hasNextPage: boolean } | undefined;

        if (nextRes?.hasNextPage) {
          // Click next page
          await this.callbacks.sendToLinkedIn(
            { type: "LINKEDIN_GO_NEXT_PAGE" },
            10000
          );
          // Wait for the new page to load
          await delayMs(4000 + Math.floor(Math.random() * 2000));
        } else {
          // No next page - switch to connecting phase
          this.session.phase = "connecting";
          await saveLinkedInSession(this.session);
          this.callbacks.broadcastToUI({
            type: "LINKEDIN_SESSION_UPDATED",
            session: this.session,
          });
          break;
        }
      } catch (err) {
        console.debug("[LinkedInOrchestrator] Next page check error:", err);
        // On error, we just fallback to connecting phase
        this.session.phase = "connecting";
        await saveLinkedInSession(this.session);
        this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
        break;
      }
    }
  }

  // ---------- Phase 2: Connect profiles -------------------------------------

  private async runConnectingPhase(): Promise<void> {
    while (this.session.phase === "connecting" && this.session.status === "running") {
      let nextItem = getNextQueuedItem(this.session);

      if (!nextItem) {
        this.session.status = "completed";
        this.session.completionReason = "results_exhausted";
        await saveLinkedInSession(this.session);
        this.callbacks.broadcastToUI({
          type: "LINKEDIN_SESSION_UPDATED",
          session: this.session,
        });
        break;
      }

      // Process the next profile
      await this.processProfile(nextItem);

      if (this.session.status !== "running") break;

      // Human-like jitter delay between profiles
      const delay = getJitteredDelayMs(MIN_DELAY_S, MAX_DELAY_S);
      if (delay > 0) await delayMs(delay);
    }
  }

  // ---------- Process a single profile item ---------------------------------

  private async processProfile(item: LinkedInQueueItem): Promise<void> {
    item.status = "processing";
    this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });

    try {
      // -----------------------------------------------------------------------
      // STEP 1: Navigate to the profile page
      // -----------------------------------------------------------------------
      await this.callbacks.sendToLinkedIn(
        { type: "LINKEDIN_OPEN_PROFILE", profileUrl: item.profileUrl, queueId: item.queueId },
        8000
      );

      // Wait for profile page to fully load (reduced for snappier action)
      await delayMs(1000 + Math.floor(Math.random() * 800));

      // -----------------------------------------------------------------------
      // STEP 2: Navigate to Contact Info overlay to extract website
      // -----------------------------------------------------------------------
      const extractRes1 = (await this.callbacks.sendToLinkedIn(
        { type: "LINKEDIN_EXTRACT_PROFILE", queueId: item.queueId },
        12000
      )) as { websiteStatus?: string; foundUrls?: string[]; navigating?: boolean } | undefined;

      let websiteStatus: LinkedInWebsiteStatus = "none";
      let foundUrls: string[] = [];
      let extractedHeadline: string = "";

      if (extractRes1?.navigating || extractRes1?.websiteStatus === "navigating_to_contact_info") {
        // Content script navigated to contact-info page — wait a bit less
        await delayMs(800 + Math.floor(Math.random() * 700));

        // Now extract from the contact info page
        const extractRes2 = (await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_EXTRACT_PROFILE", queueId: item.queueId },
          12000
        )) as { websiteStatus?: LinkedInWebsiteStatus; foundUrls?: string[]; headline?: string } | undefined;

        websiteStatus = extractRes2?.websiteStatus || "none";
        foundUrls = extractRes2?.foundUrls || [];
        extractedHeadline = extractRes2?.headline || "";
      } else {
        websiteStatus = (extractRes1?.websiteStatus as LinkedInWebsiteStatus) || "none";
        foundUrls = extractRes1?.foundUrls || [];
        extractedHeadline = (extractRes1 as any)?.headline || "";
      }

      if (extractedHeadline) {
        item.headline = extractedHeadline;
      }

      // -----------------------------------------------------------------------
      // STEP 3: Navigate back to the profile page to send the Connect request
      // -----------------------------------------------------------------------
      let connectionStatus: LinkedInProfileRecord["connectionStatus"] = "queued";

      if (websiteStatus === "website") {
        // Has a real website — skip, no need to navigate back
        connectionStatus = "skipped_has_website";
        item.status = "skipped";
        this.session.skippedCount += 1;
      } else {
        // BYPASS CONNECT & FOLLOW AS REQUESTED BY USER
        // We still save the profile as a potential lead for the messaging campaign
        connectionStatus = "queued";
        item.status = "complete";
        
        // We increment connectedCount just so the UI progress reflects that we "processed" it as a lead
        this.session.connectedCount += 1;
      }

      // -----------------------------------------------------------------------
      // STEP 4: Persist the profile record (with profileUrl saved)
      // -----------------------------------------------------------------------
      const profileId = generateUUID();
      item.profileId = profileId;

      const record: LinkedInProfileRecord = {
        profileId,
        sessionId: this.session.sessionId,
        profileUrl: item.profileUrl,      // profile URL saved for future use
        profileType: item.profileType,
        name: item.name,
        headline: item.headline || "",
        location: item.location || "",
        websiteStatus,
        foundUrls,
        connectionStatus,
        extractionTimestamp: new Date().toISOString(),
      };

      await saveLinkedInProfile(record);
      this.session.processedCount += 1;
      this.consecutiveFailures = 0;

      await saveLinkedInSession(this.session);
      this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile: record });
      this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.debug(`[LinkedInOrchestrator] Profile "${item.name}" failed (retry ${item.retryCount}):`, errorMessage);

      item.retryCount += 1;
      item.lastError = errorMessage;

      if (item.retryCount <= MAX_RETRIES) {
        item.status = "queued";
        await delayMs(3000 * item.retryCount);
      } else {
        item.status = "failed";
        this.session.failedCount += 1;
        this.session.processedCount += 1;

        // Save a failed record for visibility
        const profileId = generateUUID();
        item.profileId = profileId;
        const failedRecord: LinkedInProfileRecord = {
          profileId,
          sessionId: this.session.sessionId,
          profileUrl: item.profileUrl,
          profileType: item.profileType,
          name: item.name,
          headline: item.headline || "",
          location: item.location || "",
          websiteStatus: "none",
          foundUrls: [],
          connectionStatus: "failed",
          extractionTimestamp: new Date().toISOString(),
          error: errorMessage,
        };
        await saveLinkedInProfile(failedRecord);
        this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile: failedRecord });

        const isTransient =
          errorMessage.includes("timed out") ||
          errorMessage.includes("message channel closed") ||
          errorMessage.includes("Receiving end does not exist") ||
          errorMessage.includes("navigating");

        if (!isTransient) {
          this.consecutiveFailures += 1;
        }
      }

      // Auto-pause on too many consecutive failures
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.pause("error_threshold");
        return;
      }

      await saveLinkedInSession(this.session);
      this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
    }
  }
}
