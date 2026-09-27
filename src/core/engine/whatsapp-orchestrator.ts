/**
 * WhatsApp Cold Outreach Orchestrator & Campaign State Machine
 * Defined in PRD: Automated WhatsApp Cold Outreach & Duplicate Prevention Engine
 */

import { BusinessRecord } from "../schema/business-record";
import {
  WhatsAppCampaignSettings,
  WhatsAppOutreachRecord,
} from "../schema/whatsapp-outreach";
import { composePersonalizedMessage } from "../outreach/spintax";
import {
  getAllMessagedPhones,
  saveOutreachRecord,
} from "../storage/whatsapp-outreach-repo";

export type CampaignStatus = "idle" | "running" | "paused" | "stopped" | "completed";

export interface CampaignProgress {
  status: CampaignStatus;
  totalEligible: number;
  processedCount: number;
  sentCount: number;
  skippedDuplicateCount: number;
  invalidNumberCount: number;
  failedCount: number;
  currentBusinessName?: string;
  nextDelaySeconds?: number;
  consecutiveErrors: number;
  errorAlert?: string;
}

export interface OrchestratorCallbacks {
  sendToWhatsAppTab: (msg: unknown) => Promise<any>;
  navigateWhatsAppTab: (url: string) => Promise<void>;
  broadcastToUI: (msg: unknown) => void;
}

export class WhatsAppOrchestrator {
  private status: CampaignStatus = "idle";
  private queue: BusinessRecord[] = [];
  private template: string;
  private settings: WhatsAppCampaignSettings;
  private sessionId: string;
  private callbacks: OrchestratorCallbacks;

  private progress: CampaignProgress = {
    status: "idle",
    totalEligible: 0,
    processedCount: 0,
    sentCount: 0,
    skippedDuplicateCount: 0,
    invalidNumberCount: 0,
    failedCount: 0,
    consecutiveErrors: 0,
  };

  private isHalted = false;
  private sleepAbortReject: ((reason?: any) => void) | null = null;
  private tabStabilizeDelayMs: number;
  private templatePool: string[] = [];

  constructor(
    leads: BusinessRecord[],
    template: string,
    sessionId: string,
    settings: WhatsAppCampaignSettings,
    callbacks: OrchestratorCallbacks,
    options?: { tabStabilizeDelayMs?: number; templatePool?: string[] }
  ) {
    this.queue = leads;
    this.template = template;
    this.sessionId = sessionId;
    this.settings = settings;
    this.callbacks = callbacks;
    this.progress.totalEligible = leads.length;
    this.tabStabilizeDelayMs = options?.tabStabilizeDelayMs ?? (settings.minDelaySeconds === 0 ? 0 : 2500);
    this.templatePool = options?.templatePool && options.templatePool.length > 0 ? options.templatePool : [];
  }

  public getProgress(): CampaignProgress {
    return { ...this.progress };
  }

  public getStatus(): CampaignStatus {
    return this.status;
  }

  private broadcastUpdate(): void {
    this.callbacks.broadcastToUI({
      type: "WHATSAPP_CAMPAIGN_PROGRESS",
      progress: this.getProgress(),
    });
  }

  private logActivity(
    businessName: string,
    phone: string,
    status: WhatsAppOutreachRecord["status"],
    messageSnippet: string,
    errorMessage?: string
  ): void {
    this.callbacks.broadcastToUI({
      type: "WHATSAPP_CAMPAIGN_LOG",
      entry: {
        timestamp: new Date().toISOString(),
        businessName,
        phone,
        status,
        messageSnippet,
        errorMessage,
      },
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.sleepAbortReject = null;
        resolve();
      }, ms);

      this.sleepAbortReject = () => {
        clearTimeout(timer);
        this.sleepAbortReject = null;
        reject(new Error("ABORTED"));
      };
    });
  }

  public async start(): Promise<void> {
    if (this.status === "running") return;
    this.status = "running";
    this.isHalted = false;
    this.progress.status = "running";
    this.broadcastUpdate();

    // Prepare duplicate filter lookup
    let messagedPhones = new Set<string>();
    if (this.settings.skipPreviouslyMessaged) {
      try {
        messagedPhones = await getAllMessagedPhones();
      } catch (e) {
        console.warn("[WhatsApp Orchestrator] Could not load messaged phones", e);
      }
    }

    // Process leads sequentially
    for (let i = 0; i < this.queue.length; i++) {
      if (this.isHalted || (this.status as CampaignStatus) === "stopped") {
        break;
      }

      while ((this.status as CampaignStatus) === "paused") {
        if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;
        await new Promise((res) => setTimeout(res, 500));
      }

      if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;

      // Check batch size limit
      if (this.progress.sentCount >= this.settings.batchSizeLimit) {
        this.progress.errorAlert = `Batch limit reached (${this.settings.batchSizeLimit} messages). Pausing campaign.`;
        break;
      }

      const lead = this.queue[i];
      const rawPhone = lead.phone_normalized || lead.phone || "";
      const cleanDigits = rawPhone.replace(/\D/g, "");

      if (!cleanDigits || cleanDigits.length < 8) {
        this.progress.processedCount++;
        this.progress.failedCount++;
        this.logActivity(lead.business_name, rawPhone, "failed", "-", "Invalid phone format");
        this.broadcastUpdate();
        continue;
      }

      // Check duplicate status
      if (this.settings.skipPreviouslyMessaged && messagedPhones.has(cleanDigits)) {
        this.progress.processedCount++;
        this.progress.skippedDuplicateCount++;
        this.logActivity(
          lead.business_name,
          rawPhone,
          "skipped_duplicate",
          "-",
          "Already messaged previously"
        );
        this.broadcastUpdate();
        continue;
      }

      // Get Gemini API Key
      const apiKey = await new Promise<string>((resolve) => {
        chrome.storage.local.get("extractionSettings", (data) => {
          resolve(data?.extractionSettings?.geminiApiKey || "");
        });
      });

      this.progress.currentBusinessName = lead.business_name;
      this.broadcastUpdate();

      // 1. Navigate to WhatsApp Web tab WITHOUT TEXT to verify the number first
      const verifyUrl = `https://web.whatsapp.com/send?phone=${cleanDigits}`;
      let verificationResult: any = null;

      try {
        await this.callbacks.navigateWhatsAppTab(verifyUrl);

        // Small delay to allow tab DOM to initiate
        if (this.tabStabilizeDelayMs > 0) {
          await this.sleep(this.tabStabilizeDelayMs);
        }

        // Send verification command to content script
        try {
          verificationResult = await this.callbacks.sendToWhatsAppTab({
            type: "VERIFY_WHATSAPP_NUMBER",
          });
        } catch (err: unknown) {
          verificationResult = { success: false, status: "error", error: err instanceof Error ? err.message : String(err) };
          console.error("[WhatsAppOrchestrator] Fatal error during verification:", err);
        }

        const outreachId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        if (verificationResult && verificationResult.status === "invalid_number") {
          this.progress.invalidNumberCount++;
          this.progress.processedCount++;
          
          await saveOutreachRecord({
            outreach_id: outreachId,
            record_id: lead.record_id,
            session_id: this.sessionId,
            business_name: lead.business_name,
            phone_normalized: rawPhone,
            sent_text: "-",
            status: "invalid_number",
            sent_timestamp: new Date().toISOString(),
            error_message: "Phone number is not registered on WhatsApp",
          });

          this.logActivity(
            lead.business_name,
            rawPhone,
            "invalid_number",
            "-",
            "Not on WhatsApp (Dialog auto-dismissed — instant skip)"
          );
          
          this.broadcastUpdate();
          
          // Fast cooldown (1.5s)
          if (this.tabStabilizeDelayMs > 0 && i < this.queue.length - 1 && (this.status as CampaignStatus) === "running") {
            this.progress.nextDelaySeconds = 1;
            this.broadcastUpdate();
            await this.sleep(1500);
            this.progress.nextDelaySeconds = undefined;
            this.broadcastUpdate();
          }
          
          continue; // Skip AI generation completely!
        } else if (verificationResult && verificationResult.status === "auth_required") {
          this.progress.errorAlert = "WhatsApp Web requires QR login. Campaign paused.";
          this.status = "paused";
          this.progress.status = "paused";
          this.broadcastUpdate();
          return;
        } else if (verificationResult && !verificationResult.success) {
           // Timeout or some other error, log it as failed and skip
          this.progress.failedCount++;
          this.progress.processedCount++;
          this.progress.consecutiveErrors++;

          await saveOutreachRecord({
            outreach_id: outreachId,
            record_id: lead.record_id,
            session_id: this.sessionId,
            business_name: lead.business_name,
            phone_normalized: rawPhone,
            sent_text: "-",
            status: "failed",
            sent_timestamp: new Date().toISOString(),
            error_message: verificationResult?.status || "Unknown verification failure",
          });

          this.logActivity(
            lead.business_name,
            rawPhone,
            "failed",
            "-",
            verificationResult?.status || "Verification failed"
          );
          
          this.broadcastUpdate();
          continue;
        }
        
        // 2. If valid (ready), Generate AI Message
        let personalizedMessage = "";
        if (apiKey) {
          const targetLang = this.settings.aiLanguage || "English";
          const greetings = ["Hi", "Hello", "Hey"];
          const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
          const prompt = `I am a web developer sending a cold WhatsApp message to a local business owner who does NOT have a website. Their business name is '${lead.business_name}' and their category is '${lead.primary_category || 'Local Business'}'.
Write a personalized, highly human-sounding, and conversational message in very simple, easy-to-understand ${targetLang}. 
You must keep this exact layout and logical structure. Completely VARY your wording and synonyms for the first half (the problem and solution part) so no two messages look the same, BUT you MUST use the exact words for the ending:
"${randomGreeting} {Greeting Name if any, else *Business Name*}, I noticed you don't have a website yet. I know that for a {Category} business, the biggest challenge is {identify a very specific problem they face getting customers}. A professional website solves this by {how a website fixes it}. We recently built one for a competitor in your area and they've seen great growth. Can I send you a free demo mockup I made for you?"

CRITICAL RULES:
1. If ${targetLang} is not English, translate the structure gracefully but keep the meaning identical.
2. The word "competitor" MUST be present in every single message.
3. The exact phrase "Can I send you a free demo mockup I made for you?" MUST be used at the end of every single message.
4. Do NOT sound robotic. Do not use placeholders, fill them in with the actual business details. 
5. Format the business name in bold using WhatsApp formatting (like *Business Name*).

STRICT OUTPUT REQUIREMENT:
Generate EXACTLY ONE message. DO NOT provide multiple options. DO NOT include any introductory or concluding text (e.g., "Here is the message:"). OUTPUT ONLY THE FINAL RAW MESSAGE TEXT.`;
          let retries = 3;
          while (retries > 0 && !personalizedMessage) {
            try {
              this.logActivity(lead.business_name, rawPhone, "pending", "-", `Generating AI message (Attempt ${4 - retries}/3)...`);
              this.broadcastUpdate();
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);

              const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.7 }
                })
              });
              clearTimeout(timeoutId);
              
              const aiData = await aiRes.json();
              if (aiData.candidates && aiData.candidates[0]?.content?.parts?.[0]?.text) {
                personalizedMessage = aiData.candidates[0].content.parts[0].text.trim();
                this.logActivity(lead.business_name, rawPhone, "pending", personalizedMessage, "AI message generated");
                this.broadcastUpdate();
                await this.sleep(2000);
              } else {
                throw new Error(aiData.error?.message || "No candidates returned.");
              }
            } catch (err: any) {
              console.error(`[WhatsAppOrchestrator] Gemini API Error (Retries left: ${retries - 1}):`, err);
              this.logActivity(lead.business_name, rawPhone, "pending", "-", `API Error: ${err.message || err}. Retrying...`);
              this.broadcastUpdate();
              retries--;
              if (retries > 0) {
                await this.sleep(3000);
              }
            }
          }
        }

        if (!personalizedMessage) {
          let errorMsg = "";
          if (!apiKey) {
            errorMsg = "Gemini API Key missing. Skipping AI generation.";
          } else {
            errorMsg = "Gemini AI generation failed entirely. Skipping.";
          }
          this.logActivity(lead.business_name, rawPhone, "failed", "-", errorMsg);
          
          await saveOutreachRecord({
            outreach_id: outreachId,
            record_id: lead.record_id,
            session_id: this.sessionId,
            business_name: lead.business_name,
            phone_normalized: rawPhone,
            sent_text: "-",
            status: "failed",
            sent_timestamp: new Date().toISOString(),
            error_message: errorMsg,
          });

          this.progress.failedCount++;
          this.progress.processedCount++;
          this.broadcastUpdate();
          
          // Fast cooldown (1.5s)
          if (this.tabStabilizeDelayMs > 0 && i < this.queue.length - 1 && (this.status as CampaignStatus) === "running") {
            this.progress.nextDelaySeconds = 1;
            this.broadcastUpdate();
            await this.sleep(1500);
            this.progress.nextDelaySeconds = undefined;
            this.broadcastUpdate();
          }
          continue;
        }
        
        // Satisfy TS unused variable error
        console.debug("Templates temporarily unused:", this.template, this.templatePool, composePersonalizedMessage);

        // 3. Execute Send
        // Update UI to indicate human typing simulation
        this.logActivity(lead.business_name, rawPhone, "pending", personalizedMessage, "Typing message (human simulation)...");
        this.broadcastUpdate();
        
        // Because we already verified the number and the chat is open and ready, we can just send the text directly.
        let result: any;
        try {
          result = await this.callbacks.sendToWhatsAppTab({
            type: "EXECUTE_WHATSAPP_SEND",
            text: personalizedMessage,
            leadId: lead.record_id,
          });
        } catch (err: unknown) {
          result = { success: false, reason: err instanceof Error ? err.message : String(err) };
          console.error("[WhatsAppOrchestrator] Fatal error sending to tab:", err);
        }

        if (result && result.success) {
          this.progress.sentCount++;
          this.progress.processedCount++;
          this.progress.consecutiveErrors = 0;
          messagedPhones.add(cleanDigits);

          await saveOutreachRecord({
            outreach_id: outreachId,
            record_id: lead.record_id,
            session_id: this.sessionId,
            business_name: lead.business_name,
            phone_normalized: rawPhone,
            sent_text: personalizedMessage,
            status: "sent",
            sent_timestamp: new Date().toISOString(),
          });

          this.logActivity(
            lead.business_name,
            rawPhone,
            "sent",
            personalizedMessage.slice(0, 60) + "..."
          );
        } else {
          this.progress.failedCount++;
          this.progress.processedCount++;
          this.progress.consecutiveErrors++;

          await saveOutreachRecord({
            outreach_id: outreachId,
            record_id: lead.record_id,
            session_id: this.sessionId,
            business_name: lead.business_name,
            phone_normalized: rawPhone,
            sent_text: personalizedMessage,
            status: "failed",
            sent_timestamp: new Date().toISOString(),
            error_message: result?.reason || "Unknown send failure",
          });

          this.logActivity(
            lead.business_name,
            rawPhone,
            "failed",
            "-",
            result?.reason || "Send failed"
          );
        }
        this.broadcastUpdate();

        // Apply delay before next lead:
        if (i < this.queue.length - 1 && (this.status as CampaignStatus) === "running") {
          if (!result?.success) {
            if (this.tabStabilizeDelayMs > 0) {
              this.progress.nextDelaySeconds = 1;
              this.broadcastUpdate();
              await this.sleep(1500);
              this.progress.nextDelaySeconds = undefined;
              this.broadcastUpdate();
            }
          } else {
            // Full anti-ban delay for successfully sent messages
            const minD = Math.max(6, this.settings.minDelaySeconds);
            const maxD = Math.max(minD + 1, this.settings.maxDelaySeconds);
            const delaySec = Math.floor(Math.random() * (maxD - minD + 1)) + minD;

            this.progress.nextDelaySeconds = delaySec;
            this.broadcastUpdate();

            for (let s = delaySec; s > 0; s--) {
              if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;
              while ((this.status as CampaignStatus) === "paused") {
                if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;
                await new Promise((res) => setTimeout(res, 500));
              }
              if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;

              this.progress.nextDelaySeconds = s;
              this.broadcastUpdate();
              await this.sleep(1000);
            }

            this.progress.nextDelaySeconds = undefined;
            this.broadcastUpdate();
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.message === "ABORTED") {
          if (this.isHalted || (this.status as CampaignStatus) === "stopped") {
            break;
          }
          // If aborted due to pause, wait until resumed
          while ((this.status as CampaignStatus) === "paused") {
            if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;
            await new Promise((res) => setTimeout(res, 500));
          }
          if (this.isHalted || (this.status as CampaignStatus) === "stopped") break;
          continue;
        }
        this.progress.failedCount++;
        this.progress.processedCount++;
        this.progress.consecutiveErrors++;
        this.broadcastUpdate();
      }
    }

    if ((this.status as CampaignStatus) !== "stopped" && (this.status as CampaignStatus) !== "paused") {
      this.status = "completed";
      this.progress.status = "completed";
      this.progress.currentBusinessName = undefined;
      this.progress.nextDelaySeconds = undefined;
    }
    this.broadcastUpdate();
  }

  public pause(): void {
    this.status = "paused";
    this.progress.status = "paused";
    if (this.sleepAbortReject) {
      this.sleepAbortReject();
    }
    this.broadcastUpdate();
  }

  public resume(): void {
    this.status = "running";
    this.progress.status = "running";
    this.progress.errorAlert = undefined;
    this.broadcastUpdate();
  }

  public stop(): void {
    this.status = "stopped";
    this.isHalted = true;
    this.progress.status = "stopped";
    this.progress.currentBusinessName = undefined;
    this.progress.nextDelaySeconds = undefined;
    if (this.sleepAbortReject) {
      this.sleepAbortReject();
    }
    this.broadcastUpdate();
  }
}
