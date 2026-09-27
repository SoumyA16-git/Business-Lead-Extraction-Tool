/**
 * Options Controller
 * Defined in PRD Section 14 and 24.2
 */

import { DEFAULT_EXTRACTION_SETTINGS, ExtractionSettings, validateSettings } from "../../shared/settings";

const form = document.getElementById("settings-form") as HTMLFormElement;
const optMinDelay = document.getElementById("opt-min-delay") as HTMLInputElement;
const optMaxDelay = document.getElementById("opt-max-delay") as HTMLInputElement;
const optMaxBusinesses = document.getElementById("opt-max-businesses") as HTMLInputElement;
const optMaxRetries = document.getElementById("opt-max-retries") as HTMLInputElement;
const optMaxConsecutive = document.getElementById("opt-max-consecutive") as HTMLInputElement;
const optDuplicateScope = document.getElementById("opt-duplicate-scope") as HTMLSelectElement;
const optMergePolicy = document.getElementById("opt-merge-policy") as HTMLSelectElement;
const optCsvPlaceholder = document.getElementById("opt-csv-placeholder") as HTMLInputElement;
const optIncludeDupes = document.getElementById("opt-include-dupes") as HTMLInputElement;
const optIncludeIds = document.getElementById("opt-include-ids") as HTMLInputElement;
const optGeminiKey = document.getElementById("opt-gemini-key") as HTMLInputElement;
const btnReset = document.getElementById("btn-reset") as HTMLButtonElement;
const toast = document.getElementById("save-toast") as HTMLDivElement;

function populateForm(settings: ExtractionSettings): void {
  optMinDelay.value = String(settings.minDelaySeconds);
  optMaxDelay.value = String(settings.maxDelaySeconds);
  optMaxBusinesses.value = String(settings.maxBusinesses);
  optMaxRetries.value = String(settings.maxRetriesPerBusiness);
  optMaxConsecutive.value = String(settings.maxConsecutiveFailures);
  optDuplicateScope.value = settings.duplicateScope || "all_sessions";
  optMergePolicy.value = settings.duplicateMergePolicy;
  optCsvPlaceholder.value = settings.csvMissingPlaceholder;
  optIncludeDupes.checked = settings.includeDuplicateRecords;
  optIncludeIds.checked = settings.includeInternalIdentifiers;
  if (optGeminiKey) {
    optGeminiKey.value = settings.geminiApiKey || "";
  }
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// Load existing settings
chrome.storage.local.get("extractionSettings", (data) => {
  const current = data.extractionSettings || DEFAULT_EXTRACTION_SETTINGS;
  populateForm(current);
});

// Save settings
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const newSettings: ExtractionSettings = validateSettings({
    minDelaySeconds: parseFloat(optMinDelay.value),
    maxDelaySeconds: parseFloat(optMaxDelay.value),
    maxBusinesses: parseInt(optMaxBusinesses.value, 10),
    maxRetriesPerBusiness: parseInt(optMaxRetries.value, 10),
    maxConsecutiveFailures: parseInt(optMaxConsecutive.value, 10),
    duplicateScope: optDuplicateScope.value as "all_sessions" | "current_session",
    duplicateMergePolicy: optMergePolicy.value as "fill_gaps" | "keep_original",
    csvMissingPlaceholder: optCsvPlaceholder.value,
    includeDuplicateRecords: optIncludeDupes.checked,
    includeInternalIdentifiers: optIncludeIds.checked,
    geminiApiKey: optGeminiKey ? optGeminiKey.value : "",
  });

  chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings: newSettings }, (res) => {
    const saved = res?.settings || newSettings;
    populateForm(saved);
    showToast("Settings saved successfully.");
  });
});

// Reset defaults
btnReset.addEventListener("click", () => {
  if (confirm("Reset all settings to default values?")) {
    chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings: DEFAULT_EXTRACTION_SETTINGS }, (res) => {
      const saved = res?.settings || DEFAULT_EXTRACTION_SETTINGS;
      populateForm(saved);
      showToast("Settings reset to defaults.");
    });
  }
});
