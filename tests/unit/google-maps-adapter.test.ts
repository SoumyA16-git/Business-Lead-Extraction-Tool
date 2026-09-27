import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { GoogleMapsAdapter } from "../../src/adapters/google-maps";
import { extractWebsiteUrl } from "../../src/adapters/google-maps/extractors/website";

function loadFixtureDoc(filename: string, url = "https://www.google.com/maps"): Document {
  const filePath = resolve(__dirname, "../fixtures/google-maps", filename);
  const html = readFileSync(filePath, "utf-8");
  const dom = new JSDOM(html, { url });
  return dom.window.document;
}

describe("Google Maps Platform Adapter (PRD Section 25)", () => {
  const adapter = new GoogleMapsAdapter();

  it("detects Google Maps platform and search pages", () => {
    const doc = loadFixtureDoc("standard-listing.html");
    expect(adapter.detectPlatform(doc, "https://www.google.com/maps/search/dentists")).toBe(true);
    expect(adapter.detectPlatform(doc, "https://example.com")).toBe(false);

    const searchContext = adapter.detectSearchPage(
      doc,
      "https://www.google.com/maps/search/dental+clinics+bhubaneswar/@20.29,85.82,14z"
    );
    expect(searchContext).toBeDefined();
    expect(searchContext?.query).toBe("dental clinics bhubaneswar");

    // Test place URL with search query embedded in data param
    const placeWithSearchContext = adapter.detectSearchPage(
      doc,
      "https://www.google.com/maps/place/Sai+Laser+Dental+Care/@20.242662,85.4725344,11z/data=!4m9!1m2!2m1!1sdental+clinic+bhubaneswar!3m5!1s0x3a19a740c0000001:0x3162"
    );
    expect(placeWithSearchContext).toBeDefined();
    expect(placeWithSearchContext?.query).toBe("dental clinic bhubaneswar");
  });

  it("discovers business cards from results feed including modern a.hfpxzc links", () => {
    const doc = loadFixtureDoc("standard-listing.html");
    const cards = adapter.discoverBusinesses(doc);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].name).toBe("Bhubaneswar Smile Dental Clinic");
    expect(cards[0].cardRef).toContain("Bhubaneswar+Smile+Dental+Clinic");

    // Also test with modern Google Maps feed DOM structure
    const modernDom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Sai Laser Dental Care" href="https://www.google.com/maps/place/Sai+Laser+Dental+Care/123"></a>
          </div>
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Dental Care Center" href="https://www.google.com/maps/place/Dental+Care+Center/456"></a>
          </div>
        </div>
      </body></html>`
    );
    const modernCards = adapter.discoverBusinesses(modernDom.window.document);
    expect(modernCards.length).toBe(2);
    expect(modernCards[0].name).toBe("Sai Laser Dental Care");
    expect(modernCards[1].name).toBe("Dental Care Center");
  });

  it("extracts and normalizes a standard complete listing", async () => {
    const mapsUrl =
      "https://www.google.com/maps/place/Bhubaneswar+Smile+Dental+Clinic/@20.296,85.824,17z/data=!4m6!3m5!1s0x3a1909f3c1e2a1a3:0x7b2c9e1f4d3a8b60!8m2!3d20.296!4d85.824";
    const doc = loadFixtureDoc("standard-listing.html", mapsUrl);

    const raw = await adapter.extractBusiness(doc);
    expect(raw.name).toBe("Bhubaneswar Smile Dental Clinic");
    expect(raw.primaryCategory).toBe("Dental clinic");
    expect(raw.rating).toBe(4.6);
    expect(raw.reviewCount).toBe(212);
    expect(raw.priceLevel).toBe("$$");
    expect(raw.phone).toBe("+91 90000 00000");
    expect(raw.websiteUrl).toBe("https://smiledentalbbsr.com");
    expect(raw.plusCode).toContain("7MJP+3C");
    expect(raw.hours?.length).toBe(2);

    const normalized = adapter.normalizeBusiness(raw);
    expect(normalized.business_name).toBe("Bhubaneswar Smile Dental Clinic");
    expect(normalized.website_status).toBe("website");
    expect(normalized.website).toBe("https://smiledentalbbsr.com");
    expect(normalized.social_links).toContain("https://instagram.com/smiledentalbbsr");
    expect(normalized.place_identifier).toBe("0x3a1909f3c1e2a1a3:0x7b2c9e1f4d3a8b60");
    expect(normalized.latitude).toBe(20.296);
    expect(normalized.longitude).toBe(85.824);
    expect(normalized.business_status).toBe("operational");
    expect(normalized.missing_fields).not.toContain("phone");
    expect(normalized.missing_fields).not.toContain("website");
  });

  it("extracts social-only and permanently closed listings", async () => {
    const doc = loadFixtureDoc("social-only-closed.html");
    const raw = await adapter.extractBusiness(doc);

    expect(raw.name).toBe("Old Town Cafe");
    expect(raw.businessStatus).toBe("closed_permanently");

    const normalized = adapter.normalizeBusiness(raw);
    expect(normalized.business_status).toBe("closed_permanently");
    expect(normalized.website_status).toBe("social_only");
    expect(normalized.website).toBe("");
    expect(normalized.social_links).toContain("https://www.facebook.com/oldtowncafebbsr");
    expect(normalized.missing_fields).toContain("phone");
  });

  it("detects verification / unusual traffic challenge page", () => {
    const doc = loadFixtureDoc("verification-challenge.html");
    expect(adapter.detectVerification(doc)).toBe(true);

    const normalDoc = loadFixtureDoc("standard-listing.html");
    expect(adapter.detectVerification(normalDoc)).toBe(false);
  });

  it("detects detail panel completion / stability", () => {
    const doc = loadFixtureDoc("standard-listing.html");
    expect(adapter.detectCompletion(doc)).toBe(true);

    const emptyDom = new JSDOM("<html><body><div>Loading...</div></body></html>");
    expect(adapter.detectCompletion(emptyDom.window.document)).toBe(false);
  });

  it("does NOT leak website from search feed when business in detail panel has no website", async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <!-- Search feed contains card with website (Teeth & Gums Clinic) -->
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Teeth and Gums Clinic" href="https://www.google.com/maps/place/Teeth+and+Gums+Clinic"></a>
            <a data-item-id="authority" href="http://www.teethandgumsclinic.com/">Website</a>
          </div>
        </div>

        <!-- Detail panel for a clinic that genuinely has NO website -->
        <div role="main" aria-label="Dr Mohanty Dental Care">
          <h1 class="DUwDvf">Dr Mohanty Dental Care</h1>
          <button data-item-id="address" aria-label="Address: Janpath Rd, Bhubaneswar">Janpath Rd, Bhubaneswar</button>
          <button data-item-id="phone:tel:+919876543210" aria-label="Phone: +91 98765 43210">+91 98765 43210</button>
          <!-- Notice: No authority/website button anywhere in this panel! -->
        </div>
      </body></html>`
    );

    const doc = dom.window.document;
    const siteResult = extractWebsiteUrl(doc);
    // Must return null, NOT teethandgumsclinic.com!
    expect(siteResult.value).toBeNull();

    const raw = await adapter.extractBusiness(doc);
    expect(raw.websiteUrl).toBeNull();

    const normalized = adapter.normalizeBusiness(raw);
    expect(normalized.website).toBe("");
    expect(normalized.website_status).toBe("none");
    expect(normalized.missing_fields).toContain("website");
  });

  it("prioritizes fallbackUrl place identifier when doc.location.href has stale previous place", async () => {
    // Simulate browser where doc.location is still Mahaveer Dental Clinic
    const staleMapsUrl =
      "https://www.google.com/maps/place/Mahaveer+Dental+Clinic/@20.07,85.91,12z/data=!4m6!3m5!1s0x3a19973a68fbc005:0xc111111111111111!8m2!3d20.07!4d85.91";
    const doc = loadFixtureDoc("standard-listing.html", staleMapsUrl);

    // Target card is Dental Clinic with its OWN place ID
    const targetCardRef =
      "https://www.google.com/maps/place/Dental+Clinic/@20.06,85.90,17z/data=!4m6!3m5!1s0x3a19979999999999:0x2222222222222222!8m2!3d20.06!4d85.90";

    const raw = await adapter.extractBusiness(doc, targetCardRef);
    // Must use targetCardRef's place identifier, NOT stale Mahaveer place identifier!
    expect(raw.placeIdentifier).toBe("0x3a19979999999999:0x2222222222222222");
    expect(raw.mapsUrl).toBe(targetCardRef);
  });

  it("extracts clean primary name when heading has regional language on second line", async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="main">
          <h1 class="DUwDvf">
            <span>Mahaveer Dental Clinic</span>
            <div>ମହାବୀର ଡେଣ୍ଟାଲ କ୍ଲିନିକ୍</div>
          </h1>
        </div>
      </body></html>`
    );
    const raw = await adapter.extractBusiness(dom.window.document);
    expect(raw.name).toBe("Mahaveer Dental Clinic");
  });

  it("extracts distinct dynamic ratings and reviews for different businesses in feed", () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Mahaveer Dental Clinic" href="https://www.google.com/maps/place/Mahaveer"></a>
            <span aria-label="4.9 stars 10 Reviews"></span>
          </div>
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Dental Clinic Nimapada" href="https://www.google.com/maps/place/Dental+Clinic"></a>
            <span aria-label="3.4 stars 5 Reviews"></span>
          </div>
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Anand Dental Clinic" href="https://www.google.com/maps/place/Anand+Dental"></a>
            <span class="MW4etd">4.2</span>
            <span class="UY7F9">(25)</span>
          </div>
        </div>
      </body></html>`
    );

    const cards = adapter.discoverBusinesses(dom.window.document);
    expect(cards).toHaveLength(3);

    // Card 1 must be 4.9 with 10 reviews
    expect(cards[0].name).toBe("Mahaveer Dental Clinic");
    expect(cards[0].rating).toBe(4.9);
    expect(cards[0].reviewCount).toBe(10);

    // Card 2 must be 3.4 with 5 reviews (NOT 4.9!)
    expect(cards[1].name).toBe("Dental Clinic Nimapada");
    expect(cards[1].rating).toBe(3.4);
    expect(cards[1].reviewCount).toBe(5);

    // Card 3 must be 4.2 with 25 reviews (NOT 4.9!)
    expect(cards[2].name).toBe("Anand Dental Clinic");
    expect(cards[2].rating).toBe(4.2);
    expect(cards[2].reviewCount).toBe(25);
  });

  it("extracts phone numbers directly from feed card subtitle lines", () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="ShivShakti Dental Clinic" href="https://www.google.com/maps/place/ShivShakti+Dental/data=!4m2!3m1!1s0x3a1997:0x123"></a>
            <div class="W4Efsd">
              <span>Medical clinic</span>
              <span>·</span>
              <span>Ganesh Bazar, Jayshree square</span>
            </div>
            <div class="W4Efsd">
              <span>Closed · Opens 10 am · 099385 30308</span>
            </div>
          </div>
        </div>
      </body></html>`
    );

    const cards = adapter.discoverBusinesses(dom.window.document);
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe("ShivShakti Dental Clinic");
    expect(cards[0].phone).toBe("099385 30308");
    expect(cards[0].category).toBe("Medical clinic");
    expect(cards[0].address).toContain("Ganesh Bazar");
  });

  it("extractBusiness rejects empty detail panel without valid business name", async () => {
    const emptyDom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    await expect(adapter.extractBusiness(emptyDom.window.document)).rejects.toThrow(
      "Invalid or missing business name extracted"
    );
  });

  it("extracts website URLs correctly when wrapped in Google redirect URLs", () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="main">
          <h1 class="DUwDvf">Sai Laser Dental Clinic</h1>
          <a data-item-id="authority" href="https://www.google.com/url?q=https%3A%2F%2Fwww.sailaserdental.com%2F&opi=89978449">Website</a>
        </div>
      </body></html>`
    );

    const res = extractWebsiteUrl(dom.window.document);
    expect(res.value).toBe("https://www.sailaserdental.com/");
  });

  it("extracts website directly from feed card in discoverBusinesses", () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Stree Clinic" href="https://www.google.com/maps/place/Stree+Clinic/123"></a>
            <div class="qBF1Pd">Stree Clinic</div>
            <a data-value="Website" href="https://www.google.com/url?q=https%3A%2F%2Fstreeclinic.org%2F">Website</a>
            <div class="W4Efsd"><span>Abortion clinic</span></div>
            <div class="W4Efsd"><span>Plot No. 15, Janpath Rd</span></div>
            <div class="W4Efsd"><span>0674 253 3779</span></div>
          </div>
        </div>
      </body></html>`
    );

    const cards = adapter.discoverBusinesses(dom.window.document);
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe("Stree Clinic");
    expect(cards[0].phone).toBe("0674 253 3779");
    expect(cards[0].website).toBe("https://streeclinic.org/");
  });

  it("extractBusinessFromFeed extracts complete data from feed card as hybrid fallback", () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div role="feed">
          <div class="Nv2PK">
            <a class="hfpxzc" aria-label="Sneha Clinic" href="https://www.google.com/maps/place/Sneha+Clinic/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x9999!8m2!3d20.29!4d85.82"></a>
            <div class="qBF1Pd">Sneha Clinic</div>
            <span aria-label="3.8 stars 14 reviews"></span>
            <div class="W4Efsd"><span>Medical clinic</span></div>
            <div class="W4Efsd"><span>Plot No:2987, near Sanitorium Chhak</span></div>
            <div class="W4Efsd"><span>093382 08009</span></div>
          </div>
        </div>
      </body></html>`
    );

    const raw = adapter.extractBusinessFromFeed(dom.window.document, {
      cardRef: "https://www.google.com/maps/place/Sneha+Clinic/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x9999!8m2!3d20.29!4d85.82",
      name: "Sneha Clinic",
      cardFingerprint: "fp-sneha",
    });

    expect(raw.name).toBe("Sneha Clinic");
    expect(raw.primaryCategory).toBe("Medical clinic");
    expect(raw.phone).toBe("093382 08009");
    expect(raw.address).toContain("Sanitorium Chhak");
    expect(raw.rating).toBe(3.8);
    expect(raw.reviewCount).toBe(14);
    expect(raw.placeIdentifier).toBe("0x3a19:0x9999");
  });
});
