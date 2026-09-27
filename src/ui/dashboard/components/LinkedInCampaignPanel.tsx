/**
 * LinkedIn Campaign Preact Panel Component
 */

import { useState, useEffect } from "preact/hooks";
import { CampaignProgress } from "../../../core/engine/linkedin-campaign-orchestrator";

interface LogEntry {
  timestamp: string;
  profileName: string;
  url: string;
  status: "sent" | "failed";
  messageSnippet?: string;
  errorMessage?: string;
}

interface LinkedInCampaignPanelProps {
  sessionId: string;
}

export function LinkedInCampaignPanel({ sessionId }: LinkedInCampaignPanelProps) {
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

  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchCurrentProgress();

    const messageListener = (msg: any) => {
      if (msg.type === "LINKEDIN_CAMPAIGN_PROGRESS") {
        setProgress(msg.progress);
      }
      if (msg.type === "LINKEDIN_CAMPAIGN_LOG") {
        setLogs((prev) => [msg.entry, ...prev.slice(0, 99)]);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [sessionId]);

  const fetchCurrentProgress = () => {
    chrome.runtime.sendMessage({ type: "GET_LINKEDIN_CAMPAIGN_STATE" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.progress) {
        setProgress(res.progress);
      }
    });
  };

  const [aiLanguage, setAiLanguage] = useState<"English" | "Hindi" | "Hinglish">("English");

  const handleStart = () => {
    chrome.runtime.sendMessage({ type: "START_LINKEDIN_CAMPAIGN", sessionId, settings: { aiLanguage } }, () => {
      fetchCurrentProgress();
    });
  };

  const handlePause = () => {
    chrome.runtime.sendMessage({ type: "PAUSE_LINKEDIN_CAMPAIGN" }, () => {
      fetchCurrentProgress();
    });
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: "STOP_LINKEDIN_CAMPAIGN" }, () => {
      fetchCurrentProgress();
    });
  };

  const isRunning = progress.status === "running";
  const isPaused = progress.status === "paused";
  const isCompleted = progress.status === "completed";
  const percentComplete = progress.totalEligible > 0 
    ? Math.round((progress.processedCount / progress.totalEligible) * 100) 
    : 0;

  return (
    <div class="card" style="margin-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-color);">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
              <rect x="2" y="9" width="4" height="12"></rect>
              <circle cx="4" cy="4" r="2"></circle>
            </svg>
            Automated DM Campaign
          </h2>
          <p class="section-desc" style="margin: 0;">Automatically opens profiles and sends targeted messages.</p>
        </div>

        <div style="display: flex; gap: 12px; align-items: center;">
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "8px" }}>
            <label class="field-label" style={{ fontWeight: 600, margin: 0, fontSize: "12px" }}>AI Lang:</label>
            <select
              class="session-select"
              style={{ fontSize: "12px", padding: "4px 8px" }}
              value={aiLanguage}
              disabled={isRunning}
              onChange={(e) => setAiLanguage((e.target as HTMLSelectElement).value as any)}
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
            </select>
          </div>

          {!isRunning && !isCompleted && (
            <button class="btn btn-primary" onClick={handleStart}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              {isPaused ? "Resume Campaign" : "Start Campaign"}
            </button>
          )}

          {isRunning && (
            <button class="btn btn-warning" onClick={handlePause}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
              Pause
            </button>
          )}

          {(isRunning || isPaused) && (
            <button class="btn btn-danger" onClick={handleStop}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {(progress.status !== "idle" || progress.processedCount > 0) && (
        <div style="background: var(--surface-hover); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-weight: 600;">
              Status: <span style={`color: ${
                isRunning ? 'var(--primary-color)' : 
                isCompleted ? 'var(--success-color)' : 
                'var(--text-secondary)'
              }`}>{progress.status.toUpperCase()}</span>
            </div>
            <div style="font-weight: 600;">{percentComplete}% Complete</div>
          </div>
          
          <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
            <div style={`height: 100%; width: ${percentComplete}%; background: var(--primary-color); transition: width 0.3s ease;`}></div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
            <div style="background: var(--surface-color); padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700;">{progress.processedCount} / {progress.totalEligible}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Processed</div>
            </div>
            <div style="background: var(--surface-color); padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: var(--success-color);">{progress.sentCount}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Messages Sent</div>
            </div>
            <div style="background: var(--surface-color); padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: var(--warning-color);">{progress.skippedDuplicateCount}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Skipped (Already Sent)</div>
            </div>
            <div style="background: var(--surface-color); padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: var(--danger-color);">{progress.failedCount}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div>
        <h3 style="margin: 0 0 16px 0; font-size: 16px;">Activity Log</h3>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
          {logs.length === 0 ? (
            <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
              No activity yet. Start the campaign to see logs here.
            </div>
          ) : (
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead style="background: var(--surface-hover); position: sticky; top: 0;">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color);">Time</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color);">Profile</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color);">Status</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color);">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; color: var(--text-secondary);">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style="padding: 12px; font-weight: 500;">
                      <a href={log.url} target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: none;">
                        {log.profileName}
                      </a>
                    </td>
                    <td style="padding: 12px;">
                      {log.status === "sent" ? (
                        <span style="color: var(--success-color); background: rgba(34,197,94,0.1); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">Sent</span>
                      ) : (
                        <span style="color: var(--danger-color); background: rgba(239,68,68,0.1); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">Failed</span>
                      )}
                    </td>
                    <td style="padding: 12px; color: var(--text-secondary); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {log.status === "sent" ? log.messageSnippet : log.errorMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
