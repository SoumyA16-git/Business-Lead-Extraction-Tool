import { getProfilesBySession, saveLinkedInProfile } from "../storage/linkedin-repo";

export interface LinkedInCampaignOrchestratorCallbacks {
  broadcastToUI: (msg: any) => void;
  openTab: (url: string) => Promise<number>;
  closeTab: (tabId: number) => Promise<void>;
  sendMessageToTab: (tabId: number, msg: any) => Promise<any>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Hardcoded messages per user request for website development leads
const PERSON_MESSAGES = [
  "Hi {name}, I noticed your profile and was impressed by your work. I specialize in building high-converting websites and funnels. Would you be open to a quick chat about upgrading your online presence?",
  "Hello {name}! I help professionals like you establish a premium web presence. Are you currently looking to revamp or build a new website?",
  "Hi {name}, I'm reaching out because I design custom websites that help professionals stand out. I'd love to connect and share some ideas for your personal brand.",
  "Hey {name}, great profile! If you ever need a professional website or landing page to showcase your services, let's connect. I'd love to help.",
  "Hi {name}, just wanted to connect. I build tailored websites for industry experts and thought you might be interested in a quick brainstorm session about your digital presence."
];

const COMPANY_MESSAGES = [
  "Hi, I noticed {name} on LinkedIn and love what you're doing. I help businesses scale with high-converting websites and funnels. Would you be open to a quick chat?",
  "Hello team at {name}! A strong digital presence is key to growth. I specialize in building custom websites for businesses in your space. Are you looking to upgrade your current site?",
  "Hi, I help companies like {name} generate more leads through optimized web design. I'd love to connect and see if we can help you grow.",
  "Hey there, great page! I build professional websites and landing pages for businesses. Let me know if {name} needs any help standing out online.",
  "Hi, I was exploring your page and wanted to connect. If {name} ever needs a website revamp or a new funnel to drive sales, I'd love to assist."
];

export interface CampaignProgress {
  status: "idle" | "running" | "paused" | "stopped" | "completed";
  totalEligible: number;
  processedCount: number;
  sentCount: number;
  skippedDuplicateCount: number;
  invalidNumberCount: number; // Reused for missing profile URL
  failedCount: number;
  consecutiveErrors: number;
  statusText?: string;
}

export class LinkedInCampaignOrchestrator {
  private sessionId: string;
  private callbacks: LinkedInCampaignOrchestratorCallbacks;
  private isLoopRunning = false;
  private loopPromise: Promise<void> | null = null;
  private currentTabId: number | null = null;
  
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

  private settings: { aiLanguage?: "English" | "Hindi" | "Hinglish" };

  constructor(sessionId: string, callbacks: LinkedInCampaignOrchestratorCallbacks, settings?: { aiLanguage?: "English" | "Hindi" | "Hinglish" }) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.settings = settings || {};
  }

  public getProgress(): CampaignProgress {
    return this.progress;
  }

  private broadcastProgress() {
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_CAMPAIGN_PROGRESS",
      progress: this.progress,
    });
  }

  private broadcastLog(entry: any) {
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_CAMPAIGN_LOG",
      entry,
    });
  }

  public async start(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    this.progress.status = "running";
    this.broadcastProgress();
    this.loopPromise = this.loop();
  }

  public pause(): void {
    this.isLoopRunning = false;
    this.progress.status = "paused";
    this.broadcastProgress();
  }

  public async stop(): Promise<void> {
    this.isLoopRunning = false;
    this.progress.status = "stopped";
    this.broadcastProgress();
    
    if (this.currentTabId) {
      await this.callbacks.closeTab(this.currentTabId);
      this.currentTabId = null;
    }
    if (this.loopPromise) {
      await this.loopPromise;
    }
  }

  private async waitForPageLoadAndMessage(tabId: number, msg: any): Promise<any> {
    // Retry polling logic instead of fixed sleep
    for (let i = 0; i < 15; i++) {
      if (!this.isLoopRunning) return null;
      await sleep(1000);
      try {
        const ping = await this.callbacks.sendMessageToTab(tabId, { type: "PING" });
        if (ping?.pong) {
          // Content script is ready! Now wait 2 more seconds for DOM to settle
          await sleep(2000);
          return await this.callbacks.sendMessageToTab(tabId, msg);
        }
      } catch (e) {
        // Ignore errors, content script likely not injected yet
      }
    }
    return { success: false, reason: "timeout_waiting_for_page" };
  }

  private async loop(): Promise<void> {
    try {
      const sessionProfiles = await getProfilesBySession(this.sessionId);
      
      const pendingProfiles = sessionProfiles.filter(p => !p.campaignMessageSent);
      
      this.progress.totalEligible = sessionProfiles.length;
      this.progress.processedCount = sessionProfiles.length - pendingProfiles.length;
      this.progress.skippedDuplicateCount = this.progress.processedCount;
      this.broadcastProgress();

      console.log(`[LinkedInCampaignOrchestrator] Starting campaign for ${pendingProfiles.length} profiles.`);

      for (const profile of pendingProfiles) {
        if (!this.isLoopRunning) break;

        this.progress.processedCount++;
        
        if (!profile.profileUrl) {
          this.progress.invalidNumberCount++;
          this.broadcastProgress();
          continue;
        }

        console.log(`[LinkedInCampaignOrchestrator] Messaging: ${profile.name} (${profile.profileUrl})`);

        try {
          this.currentTabId = await this.callbacks.openTab(profile.profileUrl);

          // Get Gemini API Key
          const apiKey = await new Promise<string>((resolve) => {
            chrome.storage.local.get("extractionSettings", (data) => {
              resolve(data?.extractionSettings?.geminiApiKey || "");
            });
          });

          // Determine message
          let personalizedMsg = "";
          if (apiKey) {
            const targetLang = this.settings.aiLanguage || "English";
            const prompt = `I am a web developer sending a cold DM to a founder on LinkedIn who does NOT have a website. The recipient's name is '${profile.name}' and their bio is '${profile.headline || 'Not available'}'.
Write a personalized, highly human-sounding, and conversational message in simple ${targetLang}.
Use this exact structure: "Hi {Greeting Name}, I noticed you don't have a website yet. I know that for a {Bio/Category} business, the biggest challenge is {identify a very specific problem they face getting customers, e.g. relying only on referrals}. A professional website solves this by {how a website fixes it, e.g. allowing direct bookings/calls}. We recently built one for a competitor in your area and they've seen great growth. Can I send you a free demo mockup I made for *your business*?"
CRITICAL RULES:
1. If ${targetLang} is not English, translate the structure gracefully but keep the meaning identical.
2. You MUST include the sentence about the competitor seeing great growth. Do NOT remove it.
3. You MUST end the message with the free demo hook.
4. Do NOT sound robotic. Do not use placeholders, fill them in with the actual business details. 
5. Format any business names in bold (like *Business Name*).`;
            try {
              console.log(`[LinkedInCampaignOrchestrator] Requesting Gemini message for ${profile.name}...`);
              
              // Broadcast UI update
              this.progress.statusText = `Generating AI message for ${profile.name}...`;
              this.broadcastProgress();

              let retries = 3;
              while (retries > 0 && !personalizedMsg) {
                try {
                  this.progress.statusText = `Generating AI message for ${profile.name} (Attempt ${4 - retries}/3)...`;
                  this.broadcastProgress();
                  
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
                    personalizedMsg = aiData.candidates[0].content.parts[0].text.trim();
                    console.log(`[LinkedInCampaignOrchestrator] Generated AI message for ${profile.name}.`);
                    
                    // Broadcast UI update with generated message
                    this.progress.statusText = `AI Message ready: ${personalizedMsg.slice(0, 60)}...`;
                    this.broadcastProgress();
                    
                    // Wait 2 seconds so the user can read the generated message in the dashboard
                    await new Promise((res) => setTimeout(res, 2000));
                  } else {
                    throw new Error(aiData.error?.message || "No candidates returned.");
                  }
                } catch (err: any) {
                  console.error(`[LinkedInCampaignOrchestrator] Gemini API Error (Retries left: ${retries - 1}):`, err);
                  retries--;
                  if (retries > 0) {
                    await new Promise((res) => setTimeout(res, 3000)); // 3 second backoff
                  }
                }
              }
            } catch (err) {
              console.error("[LinkedInCampaignOrchestrator] Failed during AI wrapper:", err);
            }
          }

          if (!personalizedMsg) {
            this.progress.statusText = "Gemini AI generation failed (Possible 503 error). Skipping.";
            this.broadcastProgress();
            
            this.broadcastLog({
              timestamp: new Date().toISOString(),
              profileName: profile.name,
              url: profile.profileUrl,
              status: "failed",
              errorMessage: "Gemini AI generation failed. Skipping."
            });
            this.progress.failedCount++;
            continue; // Temporary: Skip sending entirely instead of falling back to template
          }

          // Satisfy TS unused variable error
          console.debug("Templates temporarily unused:", COMPANY_MESSAGES, PERSON_MESSAGES, randInt);

          // Send message using the robust retry logic
          const res = await this.waitForPageLoadAndMessage(this.currentTabId, {
            type: "LINKEDIN_SEND_DM",
            queueId: profile.profileId,
            message: personalizedMsg
          });

          if (!this.isLoopRunning) break;

          if (res?.success) {
            console.log(`[LinkedInCampaignOrchestrator] Message sent to ${profile.name}.`);
            profile.campaignMessageSent = true;
            profile.campaignMessageDate = new Date().toISOString();
            delete profile.error;
            await saveLinkedInProfile(profile);
            
            this.progress.sentCount++;
            this.progress.consecutiveErrors = 0;
            
            this.broadcastLog({
              timestamp: profile.campaignMessageDate,
              profileName: profile.name,
              url: profile.profileUrl,
              status: "sent",
              messageSnippet: personalizedMsg.slice(0, 60) + "..."
            });
            this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile });
          } else {
            console.warn(`[LinkedInCampaignOrchestrator] Failed to message ${profile.name}. Reason: ${res?.reason}`);
            this.progress.failedCount++;
            this.progress.consecutiveErrors++;
            
            this.broadcastLog({
              timestamp: new Date().toISOString(),
              profileName: profile.name,
              url: profile.profileUrl,
              status: "failed",
              errorMessage: res?.reason || "unknown_error"
            });
          }
        } catch (e) {
          console.error(`[LinkedInCampaignOrchestrator] Error processing ${profile.name}:`, e);
          this.progress.failedCount++;
          this.progress.consecutiveErrors++;
          
          this.broadcastLog({
            timestamp: new Date().toISOString(),
            profileName: profile.name,
            url: profile.profileUrl,
            status: "failed",
            errorMessage: String(e)
          });
        }
        
        this.broadcastProgress();

        // Close the tab
        if (this.currentTabId) {
          await this.callbacks.closeTab(this.currentTabId);
          this.currentTabId = null;
        }

        if (!this.isLoopRunning) break;

        // Human-like delay between messages
        const delay = randInt(5000, 10000);
        console.log(`[LinkedInCampaignOrchestrator] Waiting ${delay}ms before next profile...`);
        await sleep(delay);
      }
      
      if (this.isLoopRunning) {
        this.progress.status = "completed";
        this.broadcastProgress();
      }
    } catch (e) {
      console.error("[LinkedInCampaignOrchestrator] Fatal error:", e);
      this.progress.status = "stopped";
      this.broadcastProgress();
    } finally {
      this.isLoopRunning = false;
      if (this.currentTabId) {
        await this.callbacks.closeTab(this.currentTabId).catch(() => {});
        this.currentTabId = null;
      }
    }
  }
}
