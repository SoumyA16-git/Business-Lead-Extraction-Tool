/**
 * Challenge and Verification Interstitial Detection
 * Defined in PRD Section 16.2
 */

export function detectVerification(doc: Document): boolean {
  if (!doc || !doc.body) return false;

  const bodyText = (doc.body.textContent || "").toLowerCase();

  const knownSignals = [
    "unusual traffic",
    "verify you are a human",
    "confirm you're not a robot",
    "detected unusual activity",
    "please solve this puzzle",
    "security check",
  ];

  const hasSignalText = knownSignals.some((signal) => bodyText.includes(signal));

  const hasChallengeFrame = !!doc.querySelector(
    'iframe[src*="recaptcha"], iframe[title*="challenge" i], iframe[src*="captcha"]'
  );

  return hasSignalText || hasChallengeFrame;
}
