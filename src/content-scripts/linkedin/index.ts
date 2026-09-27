/**
 * LinkedIn Content Script — Uses real DOM selectors from actual page inspection
 *
 * Key facts from real LinkedIn HTML (2025 layout):
 * - Search results: div[role="list"] > div[role="listitem"]
 * - Profile link: a[href*="/in/"]
 * - Connect on profile: a[aria-label*="to connect"] (stable aria-label)
 * - Website detection: Navigate to /overlay/contact-info/ URL,
 *   then extract links from a[href*="safety/go/?url="] — decode the `url` query param
 * - CSS classes are scrambled/random — never rely on them
 */

import { RawLinkedInCard } from "../../core/schema/linkedin-profile";

// ---------------------------------------------------------------------------
// Social media domains — NOT real websites
// ---------------------------------------------------------------------------
const SOCIAL_DOMAINS = new Set([
  "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "youtu.be", "tiktok.com", "linkedin.com", "pinterest.com",
  "snapchat.com", "reddit.com", "wa.me", "whatsapp.com", "t.me",
  "telegram.me", "telegram.org", "threads.net", "tumblr.com", "vk.com",
  "discord.gg", "discord.com", "twitch.tv", "linktr.ee", "linktree.com",
]);

function isSocialUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    if (SOCIAL_DOMAINS.has(host)) return true;
    for (const s of SOCIAL_DOMAINS) {
      if (host.endsWith("." + s)) return true;
    }
    return false;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Decode website URLs from LinkedIn's safety redirect links
// LinkedIn wraps external links as: /safety/go/?url=https%3A%2F%2Fexample.com%2F
// ---------------------------------------------------------------------------
function decodeLinkedInSafetyUrl(href: string): string | null {
  try {
    const u = new URL(href, window.location.origin);
    if (!u.pathname.includes("/safety/go")) return null;
    const encoded = u.searchParams.get("url");
    if (!encoded) return null;
    return decodeURIComponent(encoded);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Extract websites from the CONTACT INFO page (already navigated there)
// LinkedIn shows websites on: /in/[slug]/overlay/contact-info/
//
// Website links appear as: <a href="/safety/go/?url=https%3A%2F%2Fexample.com">
// We collect all such links and decode them.
// Also check for any direct external links not wrapped in safety redirect.
// ---------------------------------------------------------------------------
function getHeadlineFromProfile(): string {
  // Try to find the h1 which is usually the name
  const h1 = document.querySelector('h1');
  if (h1 && h1.parentElement) {
    // The headline is usually in a div close to the name
    const textNodes = Array.from(h1.parentElement.parentElement?.querySelectorAll('div[class*="text-body-medium"]') || []);
    for (const node of textNodes) {
      const text = node.textContent?.trim() || "";
      if (text.length > 5 && !text.includes("connections")) return text;
    }
  }
  // Fallback to meta tag or title
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || "";
  if (ogTitle.includes(" - ")) {
    return ogTitle.split(" - ")[1].split(" | ")[0].trim();
  }
  return "";
}

function classifyContactInfoPage(): {
  websiteStatus: "website" | "social_only" | "none";
  foundUrls: string[];
  headline?: string;
} {
  const external: string[] = [];
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

  for (const a of anchors) {
    const href = a.href || "";
    if (!href) continue;

    // 1. LinkedIn safety redirect links — these ARE the external website links on contact page
    if (href.includes("/safety/go") || href.includes("safety/go/?url=")) {
      const decoded = decodeLinkedInSafetyUrl(href);
      if (decoded && !decoded.includes("linkedin.com")) {
        if (!external.includes(decoded)) external.push(decoded);
      }
      continue;
    }

    // 2. Direct external links (not LinkedIn-internal)
    let host = "";
    try { host = new URL(href).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
    if (!host || host === "linkedin.com" || host.endsWith(".linkedin.com")) continue;
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    if (!external.includes(href)) external.push(href);
  }

  const headline = getHeadlineFromProfile();
  if (external.length === 0) return { websiteStatus: "none", foundUrls: [], headline };
  const hasReal = external.some(u => !isSocialUrl(u));
  return { websiteStatus: hasReal ? "website" : "social_only", foundUrls: external, headline };
}

// ---------------------------------------------------------------------------
// Fallback: classify from current profile page (no contact info navigation)
// Used if navigation to contact-info fails
// ---------------------------------------------------------------------------
function classifyFromProfilePage(): {
  websiteStatus: "website" | "social_only" | "none";
  foundUrls: string[];
  headline?: string;
} {
  const external: string[] = [];
  const anchors = Array.from(document.body.querySelectorAll<HTMLAnchorElement>("a[href]"));

  for (const a of anchors) {
    const href = a.href || "";
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") ||
        href.startsWith("javascript:") || href.startsWith("#")) continue;

    // Decode safety links
    if (href.includes("/safety/go")) {
      const decoded = decodeLinkedInSafetyUrl(href);
      if (decoded && !decoded.includes("linkedin.com")) {
        if (!external.includes(decoded)) external.push(decoded);
        continue;
      }
    }

    let host = "";
    try { host = new URL(href).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
    if (!host || host === "linkedin.com" || host.endsWith(".linkedin.com")) continue;
    if (!external.includes(href)) external.push(href);
  }

  const headline = getHeadlineFromProfile();
  if (external.length === 0) return { websiteStatus: "none", foundUrls: [], headline };
  const hasReal = external.some(u => !isSocialUrl(u));
  return { websiteStatus: hasReal ? "website" : "social_only", foundUrls: external, headline };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;



// ---------------------------------------------------------------------------
// Build the contact info URL for a given profile URL
// ---------------------------------------------------------------------------
function getContactInfoUrl(profileUrl: string): string {
  try {
    const u = new URL(profileUrl);
    const pathname = u.pathname.replace(/\/$/, "");
    return `${u.origin}${pathname}/overlay/contact-info/`;
  } catch { return ""; }
}

// ---------------------------------------------------------------------------
// Page scan — detect LinkedIn search page
// ---------------------------------------------------------------------------
function scanPage(): void {
  const url = window.location.href;
  const isSearch =
    url.includes("linkedin.com/search/results/people") ||
    url.includes("linkedin.com/search/results/companies") ||
    url.includes("linkedin.com/search/results/all");

  if (isSearch) {
    let searchQuery: string | null = null;
    try { searchQuery = new URL(url).searchParams.get("keywords") || null; } catch {}
    chrome.runtime.sendMessage({ type: "LINKEDIN_PAGE_DETECTED", sourceUrl: url, searchQuery });
  }
}

// ---------------------------------------------------------------------------
// Scan search result cards from the real LinkedIn DOM structure
// div[role="list"] > div[role="listitem"] > a[href*="/in/"] or a[href*="/company/"]
// ---------------------------------------------------------------------------
function scanResultCards(): RawLinkedInCard[] {
  const cards: RawLinkedInCard[] = [];
  const seen = new Set<string>();

  const listItems = Array.from(document.querySelectorAll<HTMLElement>('div[role="listitem"]'));

  listItems.forEach((item, index) => {
    // Find the profile link anchor
    const anchor = item.querySelector<HTMLAnchorElement>('a[href*="/in/"], a[href*="/company/"]');
    if (!anchor) return;

    let profileUrl = anchor.href || "";
    try {
      const u = new URL(profileUrl);
      profileUrl = u.origin + u.pathname.replace(/\/$/, "") + "/";
    } catch { return; }
    
    const isPerson = profileUrl.includes("/in/");
    const isCompany = profileUrl.includes("/company/");
    if (!isPerson && !isCompany) return;

    const profileType = isPerson ? "person" : "company";

    // Extract name — find the anchor inside with /in/ or /company/ URL that has short visible text
    let name = "";
    const nameAnchors = Array.from(item.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"], a[href*="/company/"]'));
    for (const na of nameAnchors) {
      const text = na.textContent?.trim() || "";
      if (text && text.length > 1 && text.length < 80 && !text.includes("http")) {
        name = text;
        break;
      }
    }
    // Fallback: first meaningful text in item
    if (!name) {
      const paras = Array.from(item.querySelectorAll("p, span"))
        .map(el => el.textContent?.trim() || "")
        .filter(t => t.length > 1 && t.length < 80 && !t.includes("http"));
      name = paras[0] || "";
    }
    if (!name || name.toLowerCase() === "linkedin member") return;

    // Headline and location from text nodes
    let headline = "";
    let location = "";
    const textNodes = Array.from(item.querySelectorAll("p, span"))
      .map(el => el.textContent?.trim() || "")
      .filter(t => t && t.length > 2 && t.length < 200 && !t.includes("http") && t !== name);

    for (const t of textNodes) {
      if (!headline && t !== name) { headline = t; continue; }
      if (!location && t !== name && t !== headline) { location = t; break; }
    }

    const fingerprint = btoa(encodeURIComponent(name.toLowerCase() + "|" + profileUrl)).slice(0, 32);
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);

    cards.push({
      profileUrl,
      profileType,
      name,
      headline: headline || "Unknown",
      location: location || "Unknown",
      cardFingerprint: fingerprint,
      discoveryIndex: index
    });
  });

  return cards;
}

// ---------------------------------------------------------------------------
// Send connection request
// ---------------------------------------------------------------------------
async function sendConnectionRequest(): Promise<{ success: boolean; reason?: string }> {
  // Try to find the Connect button
  // 1. button with aria-label containing "to connect"
  // 2. button with exact text "Connect" (but make sure it's visible)
  const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, a"));
  
  let connectEl: HTMLElement | null = null;
  for (const btn of buttons) {
    if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue; // Skip hidden
    const text = (btn.textContent || "").trim();
    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    
    if (ariaLabel.includes("to connect") || text === "Connect") {
      connectEl = btn;
      break;
    }
  }

  // Check already-connected / pending
  const hasMessage = buttons.some(el => {
    const text = el.textContent?.trim() || "";
    const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
    if (ariaLabel.startsWith("messaging")) return false; // Ignore global nav
    return (text === "Message" || ariaLabel.includes("message")) && el.offsetWidth > 0;
  });
  if (!connectEl && hasMessage) return { success: false, reason: "already_connected" };

  const hasPending = buttons.some(el => (el.textContent?.trim() === "Pending" || el.getAttribute("aria-label")?.toLowerCase().includes("pending")) && el.offsetWidth > 0);
  if (!connectEl && hasPending) return { success: false, reason: "pending" };

  if (!connectEl) {
    // If not found, it might be inside the "More" dropdown. Let's try to click "More" first.
    const moreBtn = buttons.find(btn => btn.textContent?.trim() === "More" && btn.offsetWidth > 0);
    if (moreBtn) {
      moreBtn.click();
      await sleep(1000);
      // Try again to find Connect
      const dropdownBtns = Array.from(document.querySelectorAll<HTMLElement>("button, a, div[role='button']"));
      for (const btn of dropdownBtns) {
        if (btn.offsetWidth === 0) continue;
        if ((btn.textContent || "").trim() === "Connect" || (btn.getAttribute("aria-label") || "").toLowerCase().includes("to connect")) {
          connectEl = btn;
          break;
        }
      }
    }
    if (!connectEl) return { success: false, reason: "connect_button_not_found" };
  }

  // Click Connect
  connectEl.click();

  // Deep recursive search to penetrate Shadow DOMs
  function findButtonsDeep(root: Document | ShadowRoot | Element): HTMLElement[] {
    let btns: HTMLElement[] = [];
    const elements = root.querySelectorAll<HTMLElement>("*");
    for (const el of Array.from(elements)) {
      if (el.shadowRoot) {
        btns = btns.concat(findButtonsDeep(el.shadowRoot));
      }
      if (el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SPAN" || el.getAttribute("role") === "button") {
        btns.push(el);
      }
    }
    return btns;
  }

  // Poll for the "Send without a note" button to appear anywhere in the document (including Shadow DOM)
  let foundBtns: HTMLElement[] = [];
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    
    const allElements = findButtonsDeep(document);
    foundBtns = allElements.filter(el => {
      if (el.tagName === "SPAN" && !el.closest("button") && !el.closest("a") && !el.closest("[role='button']")) {
        return false;
      }
      
      const rawText = (el.textContent || "").toLowerCase();
      const rawLabel = (el.getAttribute("aria-label") || "").toLowerCase();
      
      const cleanText = rawText.replace(/[^a-z]/g, "");
      const cleanLabel = rawLabel.replace(/[^a-z]/g, "");
      
      return (
        cleanText.includes("sendwithoutanote") ||
        cleanLabel.includes("sendwithoutanote") ||
        cleanText === "sendnow" ||
        cleanLabel === "sendnow" ||
        (el.tagName === "BUTTON" && cleanText === "send")
      );
    });

    if (foundBtns.length > 0) break;
  }

  if (foundBtns.length > 0) {
    // Click EVERY matching button we found (in case some are hidden templates)
    for (const btn of foundBtns) {
      try {
        const events = ['mousedown', 'mouseup', 'click'];
        events.forEach(eventType => {
          btn.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        });
        btn.click();
      } catch (e) {
        // Ignore individual click errors
      }
    }
    
    await sleep(1500); // Give LinkedIn time to process the click and close modal
    return { success: true };
  }

  // Fallback check if it navigated to a custom invite page
  if (window.location.href.includes("custom-invite") || window.location.href.includes("send-invite")) {
    const invitePageSendBtn = Array.from(document.querySelectorAll<HTMLElement>("button, a")).find(el => {
      if (el.offsetWidth === 0) return false;
      const text = (el.textContent || "").toLowerCase();
      return text.includes("send without a note") || text.includes("send now") || text === "connect";
    });
    if (invitePageSendBtn) {
      invitePageSendBtn.click();
      await sleep(1000);
      return { success: true };
    }
    return { success: false, reason: "send_button_not_found_on_invite_page" };
  }

  return { success: false, reason: "send_without_note_button_not_found" };
}

async function sendDirectMessage(message: string): Promise<{ success: boolean; reason?: string }> {
  let msgBtn: HTMLElement | null = null;
  
  // Poll for Message button for up to 15 seconds
  for (let i = 0; i < 15; i++) {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, a"));
    for (const btn of buttons) {
      if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue;
      const text = (btn.textContent || "").trim();
      const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
      
      if (ariaLabel.startsWith("messaging")) continue; // Ignore global nav
      
      if (ariaLabel.includes("message") || text === "Message" || (btn.tagName === "A" && (btn as HTMLAnchorElement).href.includes("/messaging/compose/"))) {
        msgBtn = btn;
        break;
      }
    }
    if (msgBtn) break;
    await sleep(1000);
  }

  if (!msgBtn) {
    return { success: false, reason: "message_button_not_found" };
  }

  msgBtn.click();
  
  let chatBox: HTMLElement | null = null;
  // Poll for chat box for up to 5 seconds
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    const chatBoxes = Array.from(document.querySelectorAll<HTMLElement>("div[role='textbox'], textarea"));
    for (const box of chatBoxes) {
      if (box.offsetWidth > 0) {
        chatBox = box;
        break;
      }
    }
    if (chatBox) break;
  }

  if (!chatBox) {
    return { success: false, reason: "chat_box_not_found" };
  }

  // Type message
  chatBox.focus();
  
  if (chatBox.tagName === "TEXTAREA") {
    (chatBox as HTMLTextAreaElement).value = message;
    chatBox.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // Clear first if needed, but focus is already there
    // Use execCommand for contenteditable divs as it reliably triggers React's internal event listeners
    document.execCommand('insertText', false, message);
  }
  
  await sleep(500);

  // Find "Send" button
  const sendBtns = Array.from(document.querySelectorAll<HTMLElement>("button"));
  let sendBtn: HTMLElement | null = null;
  for (const btn of sendBtns) {
    if (btn.offsetWidth === 0) continue;
    const text = (btn.textContent || "").trim().toLowerCase();
    const type = btn.getAttribute("type");
    if (type === "submit" || text === "send") {
      sendBtn = btn;
      break;
    }
  }

  if (sendBtn && !sendBtn.hasAttribute("disabled")) {
    sendBtn.click();
    await sleep(1000);
    return { success: true };
  }

  return { success: false, reason: "send_button_not_found_or_disabled" };
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function checkNextPage(): boolean {
  const nextBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(btn => {
    const text = (btn.textContent || "").toLowerCase().trim();
    return text === "next" || text.includes("next");
  });
  return !!nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute("aria-disabled");
}

function goNextPage(): { success: boolean; navigating?: boolean } {
  const nextBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(btn => {
    const text = (btn.textContent || "").toLowerCase().trim();
    return text === "next" || text.includes("next");
  });
  
  if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute("aria-disabled")) {
    nextBtn.click();
    return { success: true, navigating: true };
  }
  return { success: false };
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  (async () => {
    try {
      switch (message.type) {
        case "PING":
          sendResponse({ pong: true });
          break;

        case "LINKEDIN_TRIGGER_PAGE_SCAN":
          scanPage();
          sendResponse({ success: true });
          break;

        case "LINKEDIN_SCAN_RESULT_CARDS":
          sendResponse({ cards: scanResultCards() });
          break;

        case "LINKEDIN_CHECK_NEXT_PAGE": {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          await sleep(1500);
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          await sleep(1500);
          sendResponse({ hasNextPage: checkNextPage() });
          break;
        }

        case "LINKEDIN_GO_NEXT_PAGE":
          sendResponse(goNextPage());
          break;

        case "LINKEDIN_OPEN_PROFILE": {
          const { profileUrl } = message as { profileUrl: string; queueId: string };
          const currentUrl = window.location.href;
          // Clean base URL for comparison
          const baseProfileUrl = profileUrl.replace("https://www.linkedin.com", "").replace(/\/$/, "");
          const isContactInfo = currentUrl.includes("/overlay/contact-info");
          
          // Navigate if we are on contact info, or if we are not on the profile at all
          if (isContactInfo || !currentUrl.includes(baseProfileUrl)) {
            // If we are just on contact info overlay, maybe we can just close the modal?
            // Safer to just set location to profileUrl to force navigation/SPA update
            window.location.href = profileUrl;
          }
          sendResponse({ success: true, navigating: true });
          break;
        }

        case "LINKEDIN_EXTRACT_PROFILE": {
          await sleep(randInt(500, 1000));
          const currentUrl = window.location.href;

          if (currentUrl.includes("/overlay/contact-info")) {
            const result = classifyContactInfoPage();
            sendResponse(result);
          } else {
            const profileUrl = currentUrl.split("/overlay")[0].replace(/\/$/, "") + "/";
            const contactUrl = getContactInfoUrl(profileUrl);
            if (contactUrl) {
              window.location.href = contactUrl;
              sendResponse({ websiteStatus: "navigating_to_contact_info", foundUrls: [], navigating: true });
            } else {
              sendResponse(classifyFromProfilePage());
            }
          }
          break;
        }

        case "LINKEDIN_SEND_CONNECTION": {
          const currentUrl = window.location.href;
          if (currentUrl.includes("/overlay/contact-info")) {
            const profileUrl = currentUrl.split("/overlay")[0].replace(/\/$/, "") + "/";
            window.location.href = profileUrl;
            sendResponse({ success: false, reason: "navigating_back_to_profile" });
          } else {
            sendResponse(await sendConnectionRequest());
          }
          break;
        }

        case "LINKEDIN_SEND_DM": {
          const msg = (message as any).message;
          if (!msg) {
            sendResponse({ success: false, reason: "no_message_provided" });
          } else {
            sendResponse(await sendDirectMessage(msg));
          }
          break;
        }

        default:
          sendResponse({ unhandled: true });
          break;
      }
    } catch (err: unknown) {
      console.error("[LinkedIn Content Script Error]", err);
      sendResponse({ error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true;
});

// Auto-scan on load
scanPage();
