import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleMapsAdapter } from "../../src/adapters/google-maps/index";
import { normalizeGooglePhotosUrl, extractMediaItems } from "../../src/adapters/google-maps/extractors/media";
import {
  extractReviews,
  expandReviewText,
  isActionMenuOrKebabButton,
} from "../../src/adapters/google-maps/extractors/reviews";
import { isUploadOrContributionButton, switchToTab } from "../../src/adapters/google-maps/navigation";

describe("GoogleMapsAdapter - Media & Reviews & Page Detection", () => {
  let adapter: GoogleMapsAdapter;

  beforeEach(() => {
    adapter = new GoogleMapsAdapter();
    document.body.innerHTML = "";
  });

  describe("File Picker Prevention & Contribution Protection", () => {
    it("identifies file inputs and user contribution buttons correctly", () => {
      const div = document.createElement("div");
      div.innerHTML = `
        <button id="btn-add-photo" aria-label="Add a photo"><input type="file" /></button>
        <button id="btn-upload" aria-label="Upload photo"></button>
        <button id="btn-write-rev" aria-label="Write a review"></button>
        <button id="btn-normal-photo" role="tab" aria-label="Photos"></button>
        <button id="btn-normal-rev" role="tab" aria-label="Reviews"></button>
      `;

      expect(isUploadOrContributionButton(div.querySelector("#btn-add-photo"))).toBe(true);
      expect(isUploadOrContributionButton(div.querySelector("#btn-upload"))).toBe(true);
      expect(isUploadOrContributionButton(div.querySelector("#btn-write-rev"))).toBe(true);
      expect(isUploadOrContributionButton(div.querySelector("#btn-normal-photo"))).toBe(false);
      expect(isUploadOrContributionButton(div.querySelector("#btn-normal-rev"))).toBe(false);
    });

    it("switchToTab strictly ignores 'Add a photo' contribution button and clicks Photos tab", async () => {
      document.body.innerHTML = `
        <div role="main">
          <!-- Contribution upload button that used to cause the Windows File Picker bug -->
          <button id="bad-upload-btn" aria-label="Add a photo">
            <input type="file" />
          </button>
          <!-- Legitimate tablist navigation -->
          <div role="tablist">
            <button role="tab" id="tab-overview" aria-label="Overview">Overview</button>
            <button role="tab" id="tab-photos" aria-label="Photos">Photos</button>
            <button role="tab" id="tab-reviews" aria-label="Reviews">Reviews</button>
          </div>
        </div>
      `;

      const uploadBtn = document.getElementById("bad-upload-btn") as HTMLButtonElement;
      const photosTab = document.getElementById("tab-photos") as HTMLButtonElement;

      const uploadSpy = vi.fn();
      const photosSpy = vi.fn();
      uploadBtn.addEventListener("click", uploadSpy);
      photosTab.addEventListener("click", photosSpy);

      const switched = await switchToTab(document, "Photos");

      expect(switched).toBe(true);
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(photosSpy).toHaveBeenCalled();
    });

    it("switchToTab strictly ignores 'Write a review' button and clicks Reviews tab", async () => {
      document.body.innerHTML = `
        <div role="main">
          <!-- Write a review button -->
          <button id="bad-write-btn" aria-label="Write a review">Write a review</button>
          <!-- Legitimate tablist navigation -->
          <div role="tablist">
            <button role="tab" id="tab-overview" aria-label="Overview">Overview</button>
            <button role="tab" id="tab-photos" aria-label="Photos">Photos</button>
            <button role="tab" id="tab-reviews" aria-label="Reviews">Reviews</button>
          </div>
        </div>
      `;

      const writeBtn = document.getElementById("bad-write-btn") as HTMLButtonElement;
      const reviewsTab = document.getElementById("tab-reviews") as HTMLButtonElement;

      const writeSpy = vi.fn();
      const reviewsSpy = vi.fn();
      writeBtn.addEventListener("click", writeSpy);
      reviewsTab.addEventListener("click", reviewsSpy);

      const switched = await switchToTab(document, "Reviews");

      expect(switched).toBe(true);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(reviewsSpy).toHaveBeenCalled();
    });
  });

  describe("detectBusinessPage", () => {
    it("detects high confidence business page from primary heading and place URL", () => {
      document.body.innerHTML = `
        <div role="main">
          <h1 class="DUwDvf"><span>Apex Dental Care</span></h1>
          <button data-item-id="address" aria-label="Address: 123 Main St, Bhubaneswar, Odisha">123 Main St, Bhubaneswar, Odisha</button>
        </div>
      `;

      const target = adapter.detectBusinessPage(
        document,
        "https://www.google.com/maps/place/Apex+Dental+Care/@20.2961,85.8245,17z"
      );

      expect(target).not.toBeNull();
      expect(target?.business_name).toBe("Apex Dental Care");
      expect(target?.address_preview).toBe("123 Main St, Bhubaneswar, Odisha");
      expect(target?.confidence).toBe("high");
      expect(target?.maps_url).toContain("maps/place");
    });

    it("detects low confidence business page when fallback heading strategy is used", () => {
      document.body.innerHTML = `
        <div role="region">
          <h1 class="secondary-title">Apex Dental Care</h1>
        </div>
      `;

      const target = adapter.detectBusinessPage(
        document,
        "https://www.google.com/maps/search/dentists/@20.2961,85.8245,17z"
      );

      expect(target).not.toBeNull();
      expect(target?.business_name).toBe("Apex Dental Care");
      expect(target?.confidence).toBe("low");
    });

    it("returns null on pure search feed without detail panel", () => {
      document.body.innerHTML = `
        <div role="feed" aria-label="Results for dentists">
          <div class="Nv2PK">Result 1</div>
          <div class="Nv2PK">Result 2</div>
        </div>
      `;

      const target = adapter.detectBusinessPage(
        document,
        "https://www.google.com/maps/search/dentists/"
      );

      expect(target).toBeNull();
    });
  });

  describe("Media Extractor", () => {
    it("normalizes Google CDN image URLs", () => {
      const cdnUrl = "https://lh5.googleusercontent.com/p/AF1QipM4abcdef=w1080-h608-k-no";
      const normalized = normalizeGooglePhotosUrl(cdnUrl);
      expect(normalized).toBe("https://lh5.googleusercontent.com/p/AF1QipM4abcdef");
    });

    it("extracts photo tiles with embed_url: ''", async () => {
      document.body.innerHTML = `
        <div role="region" aria-label="Photos">
          <div role="img" aria-label="Interior of clinic" style="background-image: url('https://lh5.googleusercontent.com/p/AF1QipM4abc=w400-h300-k-no');">
            <span class="fontHeadlineSmall">Waiting Area</span>
          </div>
          <img src="https://lh5.googleusercontent.com/p/AF1QipM5xyz=w600-h400-k-no" alt="Dental Chair" />
        </div>
      `;

      const items = await extractMediaItems(document, "business_gallery");
      expect(items.length).toBe(2);
      expect(items[0].type).toBe("photo");
      expect(items[0].mediaUrl).toBe("https://lh5.googleusercontent.com/p/AF1QipM4abc=w1920-h1080-k-no");
      expect(items[0].embedUrl).toBe("");
      expect(items[0].title).toBe("Interior of clinic");

      expect(items[1].type).toBe("photo");
      expect(items[1].caption).toBe("Dental Chair");
      expect(items[1].embedUrl).toBe("");
    });

    it("extracts video items when video indicators and duration are present", async () => {
      document.body.innerHTML = `
        <div role="region">
          <div role="button" aria-label="Video by Doctor">
            <img src="https://lh5.googleusercontent.com/p/AF1QipM9vid=w600-h400-k-no" alt="Intro Video" />
            <div aria-label="Play video">Play</div>
            <div class="duration-overlay">0:45</div>
          </div>
        </div>
      `;

      const items = await extractMediaItems(document, "business_gallery");
      expect(items.length).toBe(1);
      expect(items[0].type).toBe("video");
      expect(items[0].duration).toBe(45);
    });
  });

  describe("Review Extractor & Timeout Prevention", () => {
    it("identifies action menu and kebab 3-dots buttons correctly", () => {
      const btnKebab = document.createElement("button");
      btnKebab.setAttribute("aria-label", "More actions");
      expect(isActionMenuOrKebabButton(btnKebab)).toBe(true);

      const btnOptions = document.createElement("button");
      btnOptions.setAttribute("aria-label", "More options");
      expect(isActionMenuOrKebabButton(btnOptions)).toBe(true);

      const btnShare = document.createElement("button");
      btnShare.setAttribute("aria-label", "Share review");
      expect(isActionMenuOrKebabButton(btnShare)).toBe(true);

      const btnExpand = document.createElement("button");
      btnExpand.className = "w8nwRe";
      btnExpand.textContent = "More";
      expect(isActionMenuOrKebabButton(btnExpand)).toBe(false);
    });

    it("expandReviewText ignores kebab menu button and resolves immediately without busy-waiting", async () => {
      const card = document.createElement("div");
      card.className = "jftiEf";
      card.innerHTML = `
        <div class="d4r55">User Name</div>
        <button aria-label="More actions" class="al6Kxe">3-dots</button>
        <span class="wiI7pd">Short review text</span>
      `;

      const start = Date.now();
      await expandReviewText(card);
      const elapsed = Date.now() - start;

      // Must complete in under 50ms (not 2000ms!)
      expect(elapsed).toBeLessThan(50);
    });

    it("expandReviewText successfully triggers genuine expansion button", async () => {
      const card = document.createElement("div");
      card.className = "jftiEf";
      card.innerHTML = `
        <div class="d4r55">User Name</div>
        <button class="w8nwRe">More</button>
        <span class="wiI7pd">Truncated text...</span>
      `;

      const moreBtn = card.querySelector("button.w8nwRe") as HTMLButtonElement;
      const textSpan = card.querySelector("span.wiI7pd") as HTMLElement;

      moreBtn.addEventListener("click", () => {
        textSpan.textContent = "Truncated text... now fully expanded with all details!";
      });

      await expandReviewText(card);
      expect(textSpan.textContent).toContain("fully expanded");
    });

    it("extractReviews processes multiple cards with 3-dots menus in milliseconds", async () => {
      // Construct 15 cards with kebab menus (the exact scenario that caused 30s timeout previously)
      let html = '<div role="region" aria-label="Reviews">';
      for (let i = 0; i < 15; i++) {
        html += `
          <div class="jftiEf" data-review-id="rev-${i}">
            <div class="d4r55">User ${i}</div>
            <button aria-label="More actions" class="al6Kxe">...</button>
            <span class="kvMYJc" role="img" aria-label="5 stars"></span>
            <span class="rsqaWe">1 month ago</span>
            <div class="wiI7fc">Review content for patient ${i}</div>
          </div>
        `;
      }
      html += '</div>';
      document.body.innerHTML = html;

      const start = Date.now();
      const reviews = await extractReviews(document);
      const elapsed = Date.now() - start;

      expect(reviews.length).toBe(15);
      // 15 cards must finish in under 300ms, not 30,000ms!
      expect(elapsed).toBeLessThan(300);
      expect(reviews[0].sourceReviewId).toBe("rev-0");
      expect(reviews[14].sourceReviewId).toBe("rev-14");
    });

    it("extracts reviews with rating, text, author, and attached photos", async () => {
      document.body.innerHTML = `
        <div role="region" aria-label="Reviews">
          <div class="jftiEf" data-review-id="ChZDSUhNMG9nS0VJQ0FnSUNVb3RId0VREAE">
            <div class="d4r55">John Doe</div>
            <a href="https://www.google.com/maps/contrib/10001">John Doe Profile</a>
            <img class="NBa7we" src="https://lh3.googleusercontent.com/a-/author-avatar" alt="John Doe" />
            <span class="kvMYJc" role="img" aria-label="5 stars"></span>
            <span class="rsqaWe">2 months ago</span>
            <div class="wiI7fc">Great service and very professional doctors! Highly recommended.</div>
            <div class="CDe7pd">
              <button style="background-image: url('https://lh5.googleusercontent.com/p/AF1QipReviewPhoto1=w200-h200-k-no');"></button>
            </div>
            <div class="CDe7pd wiI7fc" style="display:none">Owner response: Thank you John!</div>
          </div>
        </div>
      `;

      const reviews = await extractReviews(document);
      expect(reviews.length).toBe(1);
      const r = reviews[0];
      expect(r.authorName).toBe("John Doe");
      expect(r.authorProfileUrl).toContain("contrib/10001");
      expect(r.rating).toBe(5);
      expect(r.reviewText).toBe("Great service and very professional doctors! Highly recommended.");
      expect(r.reviewRelativeTime).toBe("2 months ago");
      expect(r.reviewDate).not.toBeNull();
      expect(r.media?.length).toBe(1);
      expect(r.media?.[0].sourceContext).toBe("review_media");
      expect(r.media?.[0].mediaUrl).toBe("https://lh5.googleusercontent.com/p/AF1QipReviewPhoto1=w1920-h1080-k-no");
      expect(r.media?.[0].embedUrl).toBe("");
    });
  });
});

