/**
 * WhatsApp Web Content Script
 * Defined in PRD: Automated WhatsApp Cold Outreach & Duplicate Prevention Engine
 * Handles chat detection, invalid number dialog dismissal, send triggering, and delivery verification.
 */

(() => {
  console.log("[WhatsApp Content Script] Loaded on web.whatsapp.com");

  /**
   * Checks if user is at the QR code login screen
   */
  function isQrCodeScreen(): boolean {
    return Boolean(
      document.querySelector('canvas[aria-label*="Scan" i]') ||
      document.querySelector('div[data-ref]') ||
      document.querySelector('[data-icon="laptop"]')
    );
  }

  /**
   * Finds the OK button inside or associated with a modal
   */
  function findOkButtonInModal(modalEl?: HTMLElement | null): HTMLElement | null {
    if (modalEl) {
      // 1. Search inside modalEl for any button or role="button" with "OK"
      const candidates = Array.from(
        modalEl.querySelectorAll<HTMLElement>('button, div[role="button"], span[role="button"], [tabindex="0"]')
      );
      for (const el of candidates) {
        const t = (el.textContent || "").trim().toLowerCase();
        if (t === "ok" || t === "okay" || t === "dismiss" || t === "continue") {
          return el;
        }
      }

      // 2. Look for any leaf child element that has text "OK"
      const allChildren = Array.from(modalEl.querySelectorAll<HTMLElement>("*"));
      for (const el of allChildren) {
        if (el.children.length === 0 && (el.textContent || "").trim().toLowerCase() === "ok") {
          const clickable = el.closest('button, div[role="button"], div[tabindex], [role="button"]') as HTMLElement;
          return clickable || el;
        }
      }
    }

    // 3. Fallback: Search the document for buttons with text "OK"
    const docButtons = Array.from(
      document.querySelectorAll<HTMLElement>('button, div[role="button"], [tabindex="0"]')
    );
    for (const btn of docButtons) {
      const t = (btn.textContent || "").trim().toLowerCase();
      if (t === "ok" || t === "okay") {
        return btn;
      }
    }

    return null;
  }

  /**
   * Checks if an "Invalid Phone Number" dialog is present on WhatsApp Web
   */
  function findInvalidNumberDialog(): { dialog: HTMLElement; okBtn: HTMLElement | null } | null {
    // 1. Precise search: TreeWalker finding the specific text node
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const val = node.nodeValue || "";
          if (
            /isn['’]?t on whatsapp/i.test(val) ||
            /is not on whatsapp/i.test(val) ||
            /not on whatsapp/i.test(val) ||
            /phone number.*invalid/i.test(val) ||
            /url is invalid/i.test(val) ||
            /couldn['’]?t find/i.test(val)
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      });

      const matchedNode = walker.nextNode();
      if (matchedNode && matchedNode.parentElement) {
        let container: HTMLElement = matchedNode.parentElement;
        // Walk UP from this text element to find the modal card
        while (
          container.parentElement &&
          container.parentElement !== document.body &&
          container.parentElement !== document.documentElement
        ) {
          const role = container.getAttribute("role");
          if (
            role === "dialog" ||
            role === "alertdialog" ||
            container.hasAttribute("data-animate-modal-popup") ||
            container.classList.contains("modal")
          ) {
            break;
          }
          const rect = container.getBoundingClientRect();
          if (rect.width > 200 && rect.width < 700 && rect.height > 80 && rect.height < 500) {
            break;
          }
          container = container.parentElement;
        }

        const okBtn = findOkButtonInModal(container);
        return { dialog: container, okBtn };
      }
    } catch {
      // TreeWalker fallback
    }

    // 2. Query modals with dialog roles
    const modals = document.querySelectorAll<HTMLElement>(
      'div[role="dialog"], div[role="alertdialog"], div[data-animate-modal-popup="true"], div[data-animate-modal-backdrop="true"]'
    );
    for (const m of Array.from(modals)) {
      const text = m.textContent || "";
      if (
        /isn['’]?t on whatsapp/i.test(text) ||
        /is not on whatsapp/i.test(text) ||
        /not on whatsapp/i.test(text) ||
        /invalid/i.test(text)
      ) {
        const okBtn = findOkButtonInModal(m);
        return { dialog: m, okBtn };
      }
    }

    return null;
  }

  /**
   * Dismisses the invalid number popup by clicking OK and dispatching events
   */
  async function dismissInvalidDialog(
    info: { dialog: HTMLElement; okBtn: HTMLElement | null } | HTMLElement
  ): Promise<boolean> {
    const dialogEl = "dialog" in info ? info.dialog : info;
    let okBtn = "okBtn" in info ? info.okBtn : null;

    if (!okBtn) {
      okBtn = findOkButtonInModal(dialogEl);
    }

    if (okBtn) {
      okBtn.focus();
      const pointerOpts = { bubbles: true, cancelable: true, view: window, isPrimary: true, pointerId: 1 };
      const mouseOpts = { bubbles: true, cancelable: true, view: window };

      try {
        okBtn.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
        okBtn.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
        okBtn.dispatchEvent(new PointerEvent("pointerup", pointerOpts));
        okBtn.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
        okBtn.dispatchEvent(new MouseEvent("click", mouseOpts));
      } catch {
        // pointer events fallback
      }
      okBtn.click();
    }

    // Fallback: dispatch Enter on activeElement and Escape on document
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) {
      active.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
      active.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, code: "Escape", bubbles: true }));

    // Small delay to let WhatsApp remove modal, or forcefully unmount if stubborn
    await new Promise((r) => setTimeout(r, 350));
    try {
      const stillOpen = findInvalidNumberDialog();
      if (stillOpen) {
        if (stillOpen.okBtn) {
          stillOpen.okBtn.click();
        }
        // Force remove modal backdrop and card from DOM to unblock interface
        const backdrops = document.querySelectorAll(
          'div[data-animate-modal-backdrop="true"], div[role="dialog"], div[data-animate-modal-popup="true"]'
        );
        backdrops.forEach((b) => b.remove());
        if (stillOpen.dialog && stillOpen.dialog.parentElement) {
          stillOpen.dialog.remove();
        }
      }
    } catch {
      // DOM remove fallback
    }

    return true;
  }

  /**
   * Finds the active message input box in WhatsApp Web
   */
  function findMessageInput(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('footer div[contenteditable="true"]') ||
      document.querySelector<HTMLElement>('div[contenteditable="true"][data-tab="10"]') ||
      document.querySelector<HTMLElement>('div[role="textbox"][contenteditable="true"]')
    );
  }

  /**
   * Finds the WhatsApp Send button
   */
  function findSendButton(): HTMLElement | null {
    const icon = document.querySelector(
      'button span[data-icon="send"], button span[data-icon="wds-ic-send-filled"], span[data-icon="send"], span[data-icon="wds-ic-send-filled"]'
    );
    if (icon) {
      return icon.closest("button") || (icon as HTMLElement);
    }
    return null;
  }

  /**
   * Waits for chat readiness or detects invalid phone dialog
   */
  async function waitForChatOrError(timeoutMs = 12000): Promise<{
    status: "ready" | "invalid_number" | "auth_required" | "timeout";
  }> {
    // 0. Clean up any stale dialog from a previous contact attempt
    const stale = findInvalidNumberDialog();
    if (stale) {
      await dismissInvalidDialog(stale);
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // 1. Check for QR / Logged out state
      if (isQrCodeScreen()) {
        return { status: "auth_required" };
      }

      // 2. Check for invalid number popup (checked first for instant response)
      const dialog = findInvalidNumberDialog();
      if (dialog) {
        await dismissInvalidDialog(dialog);
        return { status: "invalid_number" };
      }

      // 3. Check for ready input box or send button
      const input = findMessageInput();
      const sendBtn = findSendButton();

      if (sendBtn || input) {
        return { status: "ready" };
      }

      // Fast polling: sleep 250ms before next check for instant popup catch
      await new Promise((res) => setTimeout(res, 250));
    }

    return { status: "timeout" };
  }

  /**
   * Simulates realistic human typing with variable delays and typos based on user's typer_core.ps1 logic.
   */
  async function simulateHumanTyping(input: HTMLElement, text: string): Promise<void> {
    let burstCounter = 0;

    const getHumanDelay = (c: string) => {
      if (c === '\n') return 150 + Math.random() * 200;
      
      const symbols = ".,;{}()[]\"':\\\\/<>*&^%$#@!~`_+-=";
      if (symbols.includes(c)) return 80 + Math.random() * 100;
      
      if (c === ' ') return 50 + Math.random() * 50;

      if (burstCounter > 0) {
        burstCounter--;
        return 20 + Math.random() * 15;
      }

      if (Math.random() < 0.1) {
        burstCounter = 3 + Math.floor(Math.random() * 5);
        return 20 + Math.random() * 15;
      }

      const rand = Math.random();
      if (rand <= 0.15) return 100 + Math.random() * 80;
      if (rand <= 0.40) return 60 + Math.random() * 50;
      return 35 + Math.random() * 30;
    };

    const getAdjacentTypo = (c: string) => {
      const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
      const lower = c.toLowerCase();
      
      for (const row of rows) {
        const idx = row.indexOf(lower);
        if (idx !== -1) {
          const shift = Math.random() < 0.5 ? 1 : -1;
          let newIdx = idx + shift;
          if (newIdx < 0) newIdx = 1;
          if (newIdx >= row.length) newIdx = row.length - 2;
          
          const typo = row[newIdx];
          return c === c.toUpperCase() ? typo.toUpperCase() : typo;
        }
      }
      return c;
    };

    // Keep focus
    input.focus();

    for (const char of text) {
      if (char === '\r') continue;
      
      // 6% chance for adjacent typo on letters
      if (char.length === 1 && char.match(/[a-z]/i) && Math.random() <= 0.06) {
        const typo = getAdjacentTypo(char);
        if (typo !== char) {
          document.execCommand("insertText", false, typo);
          await new Promise(res => setTimeout(res, 120 + Math.random() * 80)); // realize mistake
          document.execCommand("delete", false); // backspace
          await new Promise(res => setTimeout(res, 60 + Math.random() * 50)); // pause before correct key
        }
      }
      
      if (char === '\n') {
        const shiftEnterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(shiftEnterEvent);
        document.execCommand("insertLineBreak", false);
      } else {
        document.execCommand("insertText", false, char);
      }
      
      // Trigger input event to simulate typing for React/WhatsApp internal state
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      await new Promise(res => setTimeout(res, getHumanDelay(char)));

      // Prevent Service Worker suspension during long typing simulation
      if (Date.now() - (window as any)._lastPing > 10000 || !(window as any)._lastPing) {
        try { chrome.runtime.sendMessage({ type: "KEEP_ALIVE_PING" }).catch(() => {}); } catch(e) {}
        (window as any)._lastPing = Date.now();
      }
    }
  }

  /**
   * Triggers message send via Send button or synthetic Enter key
   */
  async function executeSend(fallbackText?: string): Promise<boolean> {
    const sendBtn = findSendButton();
    if (sendBtn) {
      sendBtn.click();
      return true;
    }

    const input = findMessageInput();
    if (input) {
      input.focus();
      if (fallbackText && (!input.textContent || input.textContent.trim().length === 0)) {
        await simulateHumanTyping(input, fallbackText);
      }

      // Dispatch Enter key event
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);

      // Check if send button appeared after focus/typing
      await new Promise((res) => setTimeout(res, 300));
      const retryBtn = findSendButton();
      if (retryBtn) {
        retryBtn.click();
      }
      return true;
    }

    return false;
  }

  // Listen for messages from background service worker
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CHECK_WHATSAPP_STATE") {
      const qr = isQrCodeScreen();
      const input = findMessageInput();
      sendResponse({
        loggedIn: !qr,
        qrDetected: qr,
        chatOpen: Boolean(input),
      });
      return true;
    }

    if (message.type === "VERIFY_WHATSAPP_NUMBER") {
      (async () => {
        try {
          const check = await waitForChatOrError(30000);
          sendResponse({ success: check.status === "ready", status: check.status });
        } catch (err: unknown) {
          sendResponse({ success: false, status: "error", error: String(err) });
        }
      })();
      return true;
    }

    if (message.type === "EXECUTE_WHATSAPP_SEND") {
      (async () => {
        try {
          const check = await waitForChatOrError(30000);

          if (check.status === "invalid_number") {
            sendResponse({ success: false, reason: "invalid_number" });
            return;
          }

          if (check.status === "auth_required") {
            sendResponse({ success: false, reason: "auth_required" });
            return;
          }

          if (check.status === "timeout") {
            // Last check if invalid dialog appeared late
            const dialog = findInvalidNumberDialog();
            if (dialog) {
              await dismissInvalidDialog(dialog);
              sendResponse({ success: false, reason: "invalid_number" });
              return;
            }
            try {
              const backdrops = document.querySelectorAll(
                'div[data-animate-modal-backdrop="true"], div[role="dialog"], div[data-animate-modal-popup="true"]'
              );
              backdrops.forEach((b) => b.remove());
            } catch {
              // ignore
            }
            sendResponse({ success: false, reason: "timeout" });
            return;
          }

          // Small pause to allow draft text to stabilize
          await new Promise((res) => setTimeout(res, 800));

          const sent = await executeSend(message.text);
          if (sent) {
            // Confirm delivery indicator or delay
            await new Promise((res) => setTimeout(res, 1500));
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, reason: "send_action_failed" });
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, reason: errMsg });
        }
      })();

      return true; // async sendResponse
    }

    return undefined;
  });
})();
