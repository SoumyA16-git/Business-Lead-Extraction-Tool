/**
 * WhatsApp Outreach Preact Panel Component
 * Defined in PRD: Automated WhatsApp Cold Outreach & Duplicate Prevention Engine
 */

import { useState, useEffect, useMemo } from "preact/hooks";
import { BusinessRecord } from "../../../core/schema/business-record";
import {
  OutreachTemplate,
  WhatsAppCampaignSettings,
  DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS,
  DEFAULT_OUTREACH_TEMPLATE,
} from "../../../core/schema/whatsapp-outreach";
import {
  generateSpintaxPreviews,
  composePersonalizedMessage,
} from "../../../core/outreach/spintax";
import { CampaignProgress } from "../../../core/engine/whatsapp-orchestrator";

interface WhatsAppOutreachPanelProps {
  records: BusinessRecord[];
  sessionId?: string;
  onRefreshRecords?: () => void;
}

interface LogEntry {
  timestamp: string;
  businessName: string;
  phone: string;
  status: "sent" | "invalid_number" | "failed" | "skipped_duplicate";
  messageSnippet: string;
  errorMessage?: string;
}

export function WhatsAppOutreachPanel({
  records,
  sessionId,
  onRefreshRecords: _onRefreshRecords,
}: WhatsAppOutreachPanelProps) {
  // Settings & Templates State
  const [settings, setSettings] = useState<WhatsAppCampaignSettings>(
    DEFAULT_WHATSAPP_CAMPAIGN_SETTINGS
  );
  const [templates, setTemplates] = useState<OutreachTemplate[]>([
    DEFAULT_OUTREACH_TEMPLATE,
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    DEFAULT_OUTREACH_TEMPLATE.template_id
  );
  const [templateText, setTemplateText] = useState<string>(
    DEFAULT_OUTREACH_TEMPLATE.content
  );
  const [useRandomPool, setUseRandomPool] = useState<boolean>(true);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);

  // Target Filter State
  const [targetFilter, setTargetFilter] = useState<"no_website" | "no_website_and_social" | "all_with_phone">("no_website");
  const [forceResend, setForceResend] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<"English" | "Hindi" | "Hinglish">("English");

  // Outreach History & Deduplication Cache
  const [messagedPhoneSet, setMessagedPhoneSet] = useState<Set<string>>(new Set());
  const [totalSentCount, setTotalSentCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Orchestrator Progress State
  const [progress, setProgress] = useState<CampaignProgress>({
    status: "idle",
    totalEligible: 0,
    processedCount: 0,
    sentCount: 0,
    skippedDuplicateCount: 0,
    invalidNumberCount: 0,
    failedCount: 0,
    consecutiveErrors: 0,
  });

  // Previews
  const [showPreviews, setShowPreviews] = useState(false);

  // Load Templates & History on mount
  useEffect(() => {
    loadTemplates();
    loadOutreachHistory();
    fetchCurrentProgress();

    // Listen to background progress broadcasts
    const messageListener = (msg: any) => {
      if (msg.type === "WHATSAPP_CAMPAIGN_PROGRESS") {
        setProgress(msg.progress);
        if (msg.progress.status === "completed" || msg.progress.status === "stopped") {
          loadOutreachHistory();
        }
      }
      if (msg.type === "WHATSAPP_CAMPAIGN_LOG") {
        setLogs((prev) => [msg.entry, ...prev.slice(0, 99)]);
        // Real-time update of messagedPhoneSet and totalSentCount to keep top counts accurate immediately
        if (msg.entry.status === "sent" && msg.entry.phone) {
          setTotalSentCount((prev) => prev + 1);
          setMessagedPhoneSet((prev) => {
            const next = new Set(prev);
            next.add(msg.entry.phone);
            const digits = msg.entry.phone.replace(/\D/g, "");
            if (digits) next.add(digits);
            return next;
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const loadTemplates = () => {
    chrome.runtime.sendMessage({ type: "GET_WHATSAPP_TEMPLATES" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.templates && res.templates.length > 0) {
        setTemplates(res.templates);
        const def = res.templates.find((t: OutreachTemplate) => t.is_default) || res.templates[0];
        setSelectedTemplateId(def.template_id);
        setTemplateText(def.content);
      }
    });
  };

  const loadOutreachHistory = () => {
    chrome.runtime.sendMessage({ type: "GET_WHATSAPP_OUTREACH_HISTORY" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.records) {
        const sentPhones = new Set<string>();
        const initialLogs: LogEntry[] = [];
        let sentCounter = 0;

        for (const r of res.records) {
          if (r.status === "sent") {
            sentCounter++;
            sentPhones.add(r.phone_normalized);
            const digits = r.phone_normalized.replace(/\D/g, "");
            if (digits) sentPhones.add(digits);
          }
          if (initialLogs.length < 50) {
            initialLogs.push({
              timestamp: r.sent_timestamp,
              businessName: r.business_name,
              phone: r.phone_normalized,
              status: r.status,
              messageSnippet: r.sent_text ? r.sent_text.slice(0, 60) + "..." : "-",
              errorMessage: r.error_message,
            });
          }
        }
        setTotalSentCount(sentCounter);
        setMessagedPhoneSet(sentPhones);
        setLogs(initialLogs);
      }
    });
  };

  const fetchCurrentProgress = () => {
    chrome.runtime.sendMessage({ type: "GET_WHATSAPP_CAMPAIGN_STATE" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.progress) {
        setProgress(res.progress);
      }
    });
  };

  // Filter eligible targets
  const { eligibleLeads, alreadyMessagedCount, noPhoneCount } = useMemo(() => {
    let eligible: BusinessRecord[] = [];
    let messagedCount = 0;
    let missingPhoneCount = 0;

    for (const rec of records) {
      const rawPhone = rec.phone_normalized || rec.phone || "";
      const hasPhone = rawPhone.replace(/\D/g, "").length >= 8;

      if (!hasPhone) {
        missingPhoneCount++;
        continue;
      }

      // Check website status filter
      if (targetFilter === "no_website" && rec.website_status !== "none") {
        continue;
      }
      if (
        targetFilter === "no_website_and_social" &&
        rec.website_status !== "none" &&
        rec.website_status !== "social_only"
      ) {
        continue;
      }

      // Deduplication check
      const cleanDigits = rawPhone.replace(/\D/g, "");
      const isAlreadyMessaged =
        messagedPhoneSet.has(rawPhone) ||
        (cleanDigits.length >= 8 && messagedPhoneSet.has(cleanDigits));
      if (isAlreadyMessaged) {
        messagedCount++;
        if (!forceResend) {
          continue;
        }
      }

      eligible.push(rec);
    }

    return {
      eligibleLeads: eligible,
      alreadyMessagedCount: messagedCount,
      noPhoneCount: missingPhoneCount,
    };
  }, [records, targetFilter, messagedPhoneSet, forceResend]);

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = templates.find((t) => t.template_id === templateId);
    if (found) {
      setTemplateText(found.content);
    }
  };

  // Insert variable into template
  const insertVariable = (variable: string) => {
    setTemplateText((prev) => prev + ` {${variable}}`);
  };

  // Save new template
  const handleSaveTemplate = () => {
    if (!newTemplateTitle.trim() || !templateText.trim()) return;
    const newTpl: OutreachTemplate = {
      template_id: `tpl_${Date.now()}`,
      title: newTemplateTitle.trim(),
      content: templateText,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    chrome.runtime.sendMessage(
      { type: "SAVE_WHATSAPP_TEMPLATE", template: newTpl },
      () => {
        if (chrome.runtime.lastError) return;
        setTemplates((prev) => [...prev, newTpl]);
        setSelectedTemplateId(newTpl.template_id);
        setShowSaveTemplateModal(false);
        setNewTemplateTitle("");
      }
    );
  };

  // Campaign controls
  const handleStartCampaign = () => {
    if (eligibleLeads.length === 0) return;
    setProgress((prev) => ({ ...prev, status: "running", errorAlert: undefined }));
    chrome.runtime.sendMessage(
      {
        type: "START_WHATSAPP_CAMPAIGN",
        leads: eligibleLeads,
        template: templateText,
        templatePool: useRandomPool && templates.length > 0 ? templates.map((t) => t.content) : undefined,
        sessionId: sessionId || "dashboard_outreach",
        settings: {
          ...settings,
          skipPreviouslyMessaged: !forceResend,
          aiLanguage,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          console.debug("[WhatsApp Panel] Start Campaign error:", chrome.runtime.lastError.message);
        }
        fetchCurrentProgress();
      }
    );
  };

  const handlePauseCampaign = () => {
    setProgress((prev) => ({ ...prev, status: "paused" }));
    chrome.runtime.sendMessage({ type: "PAUSE_WHATSAPP_CAMPAIGN" }, () => {
      if (chrome.runtime.lastError) return;
      fetchCurrentProgress();
    });
  };

  const handleResumeCampaign = () => {
    setProgress((prev) => ({ ...prev, status: "running", errorAlert: undefined }));
    chrome.runtime.sendMessage({ type: "RESUME_WHATSAPP_CAMPAIGN" }, () => {
      if (chrome.runtime.lastError) return;
      fetchCurrentProgress();
    });
  };

  const handleStopCampaign = () => {
    if (confirm("Are you sure you want to stop the outreach campaign?")) {
      setProgress((prev) => ({
        ...prev,
        status: "stopped",
        currentBusinessName: undefined,
        nextDelaySeconds: undefined,
      }));
      chrome.runtime.sendMessage({ type: "STOP_WHATSAPP_CAMPAIGN" }, () => {
        if (chrome.runtime.lastError) return;
        fetchCurrentProgress();
        loadOutreachHistory();
      });
    }
  };

  // Previews
  const previewItems = useMemo(() => {
    const sample = eligibleLeads[0] || records[0];
    if (!sample) return [];
    if (useRandomPool && templates.length > 1) {
      return templates.slice(0, 3).map((t, idx) => ({
        label: `Sample ${idx + 1}: ${t.title}`,
        text: composePersonalizedMessage(t.content, sample),
      }));
    }
    return generateSpintaxPreviews(templateText, sample, 3).map((text, idx) => ({
      label: `Variant ${idx + 1}`,
      text,
    }));
  }, [templateText, eligibleLeads, records, useRandomPool, templates]);

  const isRunning = progress.status === "running";
  const isPaused = progress.status === "paused";
  const totalInJob = progress.totalEligible || eligibleLeads.length;
  const progressPercent = totalInJob > 0 ? Math.min(100, Math.round((progress.processedCount / totalInJob) * 100)) : 0;

  return (
    <div class="whatsapp-outreach-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Banner & Target Selection */}
      <div class="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              WhatsApp Cold Outreach
              <span
                class={`chip ${
                  isRunning
                    ? "chip-success"
                    : isPaused
                    ? "chip-warning"
                    : progress.status === "completed"
                    ? "chip-accent"
                    : "chip-neutral"
                }`}
              >
                {progress.status.toUpperCase()}
              </span>
            </h3>
            <p class="section-desc" style={{ margin: "4px 0 0 0" }}>
              Automated single-tab outreach to leads without websites with Spintax rotation and anti-ban safeguards.
            </p>
          </div>

          {/* Filter Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label class="field-label" style={{ fontWeight: 600, margin: 0 }}>AI Language:</label>
              <select
                class="session-select"
                value={aiLanguage}
                disabled={isRunning}
                onChange={(e) => setAiLanguage((e.target as HTMLSelectElement).value as any)}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Hinglish">Hinglish</option>
              </select>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label class="field-label" style={{ fontWeight: 600, margin: 0 }}>Target Scope:</label>
              <select
                class="session-select"
                value={targetFilter}
                disabled={isRunning}
                onChange={(e) => setTargetFilter((e.target as HTMLSelectElement).value as any)}
              >
                <option value="no_website">No Website Only (Recommended)</option>
                <option value="no_website_and_social">No Website + Social-Only</option>
                <option value="all_with_phone">All Businesses with Phone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lead Statistics Overview */}
        <div style={{ display: "flex", gap: "16px", marginTop: "16px", flexWrap: "wrap" }}>
          <div class="metric-card" style={{ flex: 1, minWidth: "160px" }}>
            <span class="metric-label">Eligible for Outreach</span>
            <span class="metric-val text-accent tabular-nums">{eligibleLeads.length}</span>
            <span class="text-caption text-secondary">Ready to message</span>
          </div>

          <div class="metric-card" style={{ flex: 1, minWidth: "160px" }}>
            <span class="metric-label">Skipped (Already Messaged)</span>
            <span class="metric-val text-success tabular-nums">{alreadyMessagedCount}</span>
            <span class="text-caption text-secondary">Protected by Dedup</span>
          </div>

          <div class="metric-card" style={{ flex: 1, minWidth: "160px" }}>
            <span class="metric-label">Skipped (No Valid Phone)</span>
            <span class="metric-val text-secondary tabular-nums">{noPhoneCount}</span>
            <span class="text-caption text-secondary">Missing mobile number</span>
          </div>

          <div class="metric-card" style={{ flex: 1, minWidth: "160px" }}>
            <span class="metric-label">Global Sent History</span>
            <span class="metric-val tabular-nums">{totalSentCount}</span>
            <span class="text-caption text-secondary">Total contacts messaged</span>
          </div>
        </div>
      </div>

      {/* Campaign Progress Bar & Controls */}
      <div class="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <strong style={{ fontSize: "14px" }}>Campaign Execution:</strong>
            {progress.currentBusinessName && isRunning && (
              <span class="text-caption text-accent" style={{ fontWeight: 500 }}>
                Messaging: {progress.currentBusinessName}
              </span>
            )}
            {progress.nextDelaySeconds && isRunning && (
              <span class="chip chip-neutral" style={{ fontSize: "11px" }}>
                Waiting ~{progress.nextDelaySeconds}s safe delay...
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            {!isRunning && !isPaused && (
              <button
                class="btn btn-primary btn-sm"
                onClick={handleStartCampaign}
                disabled={eligibleLeads.length === 0}
              >
                Start Campaign ({eligibleLeads.length} Leads)
              </button>
            )}
            {isRunning && (
              <button class="btn btn-secondary btn-sm" onClick={handlePauseCampaign}>
                Pause Campaign
              </button>
            )}
            {isPaused && (
              <button class="btn btn-primary btn-sm" onClick={handleResumeCampaign}>
                Resume Campaign
              </button>
            )}
            {(isRunning || isPaused) && (
              <button class="btn btn-danger btn-sm" onClick={handleStopCampaign}>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress Fill Bar */}
        <div style={{ background: "var(--color-bg-app)", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "8px", border: "1px solid var(--color-border)" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              backgroundColor: isPaused ? "var(--color-warning)" : "var(--color-accent)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)" }}>
          <span>
            Progress: <strong>{progress.processedCount}</strong> / {totalInJob} ({progressPercent}%)
          </span>
          <div style={{ display: "flex", gap: "12px" }}>
            <span>Sent: <strong class="text-success">{progress.sentCount}</strong></span>
            <span>Invalid: <strong class="text-warning">{progress.invalidNumberCount}</strong></span>
            <span>Skipped: <strong>{progress.skippedDuplicateCount}</strong></span>
            <span>Failed: <strong class="text-danger">{progress.failedCount}</strong></span>
          </div>
        </div>

        {progress.errorAlert && (
          <div style={{ marginTop: "12px", padding: "8px 12px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-danger)", fontSize: "12px", border: "1px solid var(--color-danger)" }}>
            <strong>Alert:</strong> {progress.errorAlert}
          </div>
        )}
      </div>

      {/* Main Grid: Template Composer & Anti-Ban Settings */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
        {/* Template Composer */}
        <div class="card" style={{ padding: "16px 20px" }}>
          {/* Random 10-Template Rotation Toggle Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: useRandomPool ? "rgba(37, 211, 102, 0.08)" : "var(--color-bg-app)",
              border: useRandomPool ? "1px solid rgba(37, 211, 102, 0.3)" : "1px solid var(--color-border)",
              marginBottom: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "13px", color: useRandomPool ? "var(--color-success)" : "var(--color-text-primary)" }}>
                  Random 10-Template Rotation
                </strong>
                {useRandomPool ? (
                  <span class="chip chip-success" style={{ fontSize: "10px", padding: "2px 6px" }}>
                    Active ({templates.length} Templates Pool)
                  </span>
                ) : (
                  <span class="chip chip-neutral" style={{ fontSize: "10px", padding: "2px 6px" }}>
                    Single Template Mode
                  </span>
                )}
              </div>
              <span class="text-caption text-secondary" style={{ fontSize: "11px", display: "block", marginTop: "2px" }}>
                {useRandomPool
                  ? "Every contacted lead randomly receives 1 of the 10 web dev templates + unique Spintax variation."
                  : "Sending only the single selected template below to all leads."}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useRandomPool}
                disabled={isRunning}
                onChange={(e) => setUseRandomPool((e.target as HTMLInputElement).checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-success)", cursor: "pointer" }}
              />
              <span style={{ fontSize: "12px", fontWeight: 500 }}>
                {useRandomPool ? "Random Active" : "Single Template"}
              </span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h4 style={{ margin: 0, fontSize: "14px" }}>
              {useRandomPool ? "Inspect / Edit Any Template in Pool:" : "Message Template & Spintax Composer:"}
            </h4>
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                class="session-select"
                style={{ fontSize: "12px" }}
                value={selectedTemplateId}
                disabled={isRunning}
                onChange={(e) => handleSelectTemplate((e.target as HTMLSelectElement).value)}
              >
                {templates.map((t) => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                class="btn btn-secondary btn-sm"
                disabled={isRunning}
                onClick={() => setShowSaveTemplateModal(true)}
              >
                Save As New
              </button>
            </div>
          </div>

          {/* Variable Insertion Pills */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            <span class="text-caption text-secondary" style={{ alignSelf: "center", marginRight: "4px" }}>Insert:</span>
            {[
              { label: "Business Name", tag: "business_name" },
              { label: "Category", tag: "category" },
              { label: "City", tag: "city" },
              { label: "Rating", tag: "rating" },
              { label: "Reviews", tag: "review_count" },
            ].map((v) => (
              <button
                key={v.tag}
                type="button"
                class="signal-tag"
                style={{ cursor: "pointer", fontSize: "11px" }}
                disabled={isRunning}
                onClick={() => insertVariable(v.tag)}
              >
                +{v.label}
              </button>
            ))}
          </div>

          <textarea
            class="template-textarea"
            rows={7}
            disabled={isRunning}
            value={templateText}
            onInput={(e) => setTemplateText((e.target as HTMLTextAreaElement).value)}
            placeholder="Type your outreach message with variables and {Spintax|Rotation}..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-app)",
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
              fontSize: "13px",
              lineHeight: "1.5",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <span class="text-caption text-secondary">
              Use <code>{"{Hi|Hello|Hey}"}</code> to rotate greetings and avoid spam detection.
            </span>
            <button
              class="btn btn-secondary btn-sm"
              onClick={() => setShowPreviews(!showPreviews)}
            >
              {showPreviews ? "Hide Previews" : "Test Spintax Variations"}
            </button>
          </div>

          {/* Live Spintax Previews */}
          {showPreviews && (
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <strong style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {useRandomPool ? "Sample Outputs from Template Pool (Simulated with Sample Lead):" : "Sample Output Variations (Simulated with Sample Lead):"}
              </strong>
              {previewItems.map((prev, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "var(--color-bg-surface)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--color-border)",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <span class="chip chip-neutral" style={{ fontSize: "10px", marginRight: "6px" }}>{prev.label}</span>
                  {prev.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safety & Throttling Configuration */}
        <div class="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <h4 style={{ margin: 0, fontSize: "14px" }}>Anti-Ban & Safety Settings</h4>

          {/* Delay Range */}
          <div>
            <label class="field-label" style={{ display: "block", marginBottom: "4px" }}>
              Delay Jitter: <strong>{settings.minDelaySeconds}s – {settings.maxDelaySeconds}s</strong>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="number"
                min="10"
                max="60"
                class="session-select"
                style={{ width: "80px" }}
                disabled={isRunning}
                value={settings.minDelaySeconds}
                onInput={(e) =>
                  setSettings({
                    ...settings,
                    minDelaySeconds: parseInt((e.target as HTMLInputElement).value, 10) || 15,
                  })
                }
              />
              <span style={{ alignSelf: "center", color: "var(--color-text-secondary)" }}>to</span>
              <input
                type="number"
                min="20"
                max="120"
                class="session-select"
                style={{ width: "80px" }}
                disabled={isRunning}
                value={settings.maxDelaySeconds}
                onInput={(e) =>
                  setSettings({
                    ...settings,
                    maxDelaySeconds: parseInt((e.target as HTMLInputElement).value, 10) || 45,
                  })
                }
              />
            </div>
          </div>

          {/* Batch Size Cap */}
          <div>
            <label class="field-label" style={{ display: "block", marginBottom: "4px" }}>
              Max Leads per Batch: <strong>{settings.batchSizeLimit}</strong>
            </label>
            <input
              type="number"
              min="5"
              max="100"
              class="session-select"
              style={{ width: "100%" }}
              disabled={isRunning}
              value={settings.batchSizeLimit}
              onInput={(e) =>
                setSettings({
                  ...settings,
                  batchSizeLimit: parseInt((e.target as HTMLInputElement).value, 10) || 30,
                })
              }
            />
          </div>

          {/* Global Deduplication Checkbox */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!forceResend}
                disabled={isRunning}
                onChange={(e) => setForceResend(!(e.target as HTMLInputElement).checked)}
              />
              <span>
                <strong>Global Deduplication</strong>
                <br />
                <span class="text-secondary" style={{ fontSize: "11px" }}>
                  Skip phone numbers previously messaged in any session.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Live Campaign Activity Log Feed */}
      <div class="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h4 style={{ margin: 0, fontSize: "14px" }}>Outreach Activity Log ({logs.length})</h4>
          <button
            class="btn btn-secondary btn-sm"
            onClick={() => setLogs([])}
          >
            Clear Log View
          </button>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "280px", overflowY: "auto" }}>
          <table class="data-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ width: "130px" }}>Time</th>
                <th>Business Name</th>
                <th style={{ width: "140px" }}>Phone</th>
                <th style={{ width: "120px" }}>Status</th>
                <th>Message / Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--color-text-secondary)" }}>
                    No outreach activity recorded yet. Click "Start Campaign" above.
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i}>
                    <td class="text-caption text-secondary tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.businessName}</td>
                    <td class="tabular-nums">{log.phone}</td>
                    <td>
                      <span
                        class={`chip ${
                          log.status === "sent"
                            ? "chip-success"
                            : log.status === "invalid_number"
                            ? "chip-warning"
                            : log.status === "skipped_duplicate"
                            ? "chip-neutral"
                            : "chip-danger"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {log.status === "invalid_number" ? "NOT ON WHATSAPP" : log.status.toUpperCase()}
                      </span>
                    </td>
                    <td class="text-caption text-secondary" style={{ maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.errorMessage ? <span class="text-danger">{log.errorMessage}</span> : log.messageSnippet}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Save Template */}
      {showSaveTemplateModal && (
        <div class="modal-overlay" onClick={() => setShowSaveTemplateModal(false)}>
          <div class="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Save Message Template</h3>
            <label class="field-label" style={{ display: "block", marginBottom: "6px" }}>Template Name:</label>
            <input
              type="text"
              class="session-select"
              style={{ width: "100%", marginBottom: "16px" }}
              placeholder="e.g., SEO Pitch (No Website)"
              value={newTemplateTitle}
              onInput={(e) => setNewTemplateTitle((e.target as HTMLInputElement).value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button class="btn btn-secondary btn-sm" onClick={() => setShowSaveTemplateModal(false)}>
                Cancel
              </button>
              <button class="btn btn-primary btn-sm" onClick={handleSaveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
