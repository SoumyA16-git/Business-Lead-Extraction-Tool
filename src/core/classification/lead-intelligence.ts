/**
 * Lead Intelligence & Qualification Engine
 * Implements deterministic lead signals, digital maturity scoring, and niche qualification.
 * Defined in PRD: Lead Intelligence Engine & Niche Qualification
 */

import { BusinessRecord } from "../schema/business-record";

export type OpportunityLevel = "high" | "medium" | "low" | "none";

export interface SignalExplanation {
  id: string;
  label: string;
  category: "online_presence" | "contactability" | "reputation" | "profile" | "activity" | "opportunity";
  description: string;
  evidence: string;
}

export interface NicheQualification {
  profileId: string;
  profileName: string;
  opportunityLevel: OpportunityLevel;
  matchedSignals: string[];
  reasons: string[];
}

export interface BusinessLeadIntelligence {
  // Digital Maturity Score (0 - 100)
  digitalMaturityScore: number;

  // Categorical Classifications
  onlinePresenceType: "website_and_social" | "website_only" | "social_only" | "no_presence";
  contactabilityTier: "complete" | "phone_only" | "address_only" | "unreachable";
  reputationTier: "excellent" | "good" | "poor" | "unreviewed";
  reviewVolumeTier: "high" | "moderate" | "low" | "none";
  profileCompletenessPercentage: number;

  // Active Signals with Explanations
  signals: SignalExplanation[];

  // Active Niche Evaluation
  activeNiche: NicheQualification;

  // All Evaluated Niche Qualifications
  nicheQualifications: Record<string, NicheQualification>;
}

export interface LeadIntelligenceSummary {
  totalRecords: number;

  // Online Presence Counts
  websiteCount: number;
  socialOnlyCount: number;
  noWebsiteCount: number;
  websiteAndSocialCount: number;
  noSocialCount: number;

  // Contactability Counts
  phoneAvailableCount: number;
  phoneMissingCount: number;
  fullContactCount: number;

  // Reputation Counts
  rating45PlusCount: number;
  ratingUnder40Count: number;
  reviews100PlusCount: number;
  reviews10OrLessCount: number;
  unreviewedCount: number;
  averageRating: number | null;

  // Profile Completeness Counts
  completeProfileCount: number;
  incompleteProfileCount: number;
  missingHoursCount: number;
  missingDescriptionCount: number;

  // Opportunity Counts (Compound)
  highReviewsNoWebsiteCount: number;
  highRatingNoWebsiteCount: number;
  highReviewsSocialOnlyCount: number;
  lowRatingActiveReviewsCount: number;
  incompleteActiveListingCount: number;

  // Active Niche Counts
  activeProfileId: string;
  activeProfileName: string;
  highOpportunityCount: number;
  mediumOpportunityCount: number;
  lowOpportunityCount: number;
}

export interface NicheProfileDefinition {
  id: string;
  name: string;
  targetDescription: string;
  evaluateOpportunity: (
    record: BusinessRecord,
    signals: SignalExplanation[],
    maturityScore: number
  ) => NicheQualification;
}

// ---------------------------------------------------------------------------
// Predefined Niche Profiles
// ---------------------------------------------------------------------------

export const NICHE_PROFILES: Record<string, NicheProfileDefinition> = {
  general: {
    id: "general",
    name: "General Qualification",
    targetDescription: "Balanced overview of business contactability, reputation, and presence",
    evaluateOpportunity: (record, _signals, _maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const hasPhone = Boolean(record.phone && record.phone.trim().length >= 6);
      const isOperational = record.business_status === "operational";
      const hasRating = Boolean(record.rating && record.rating >= 4.0);

      if (hasPhone && isOperational && hasRating) {
        matchedSignals.push("sig_full_contact", "sig_rating_excellent");
        reasons.push("Verified operational business with positive ratings and direct phone line.");
        return {
          profileId: "general",
          profileName: "General Qualification",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (hasPhone || isOperational) {
        matchedSignals.push("sig_phone_available");
        reasons.push("Reachable local business with standard listing presence.");
        return {
          profileId: "general",
          profileName: "General Qualification",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push("Listing has limited contact information or restricted public activity.");
      return {
        profileId: "general",
        profileName: "General Qualification",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },

  web_dev: {
    id: "web_dev",
    name: "Web Development & Funnels",
    targetDescription: "Finds established businesses lacking dedicated websites or conversion portals",
    evaluateOpportunity: (record, _signals, _maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const hasNoWebsite = record.website_status === "none";
      const isSocialOnly = record.website_status === "social_only";
      const reviews = record.review_count || 0;
      const rating = record.rating || 0;

      if ((hasNoWebsite || isSocialOnly) && (reviews >= 30 || rating >= 4.3)) {
        matchedSignals.push("sig_no_website", "sig_opp_high_rev_no_site");
        reasons.push(
          `Strong local customer flow (${reviews} reviews, ${rating.toFixed(1)} rating) with no dedicated website domain.`
        );
        return {
          profileId: "web_dev",
          profileName: "Web Development & Funnels",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (hasNoWebsite || isSocialOnly) {
        matchedSignals.push(hasNoWebsite ? "sig_no_website" : "sig_social_only");
        reasons.push("No dedicated website detected. Prime prospect for custom web design.");
        return {
          profileId: "web_dev",
          profileName: "Web Development & Funnels",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push("Business already has an active registered website domain.");
      return {
        profileId: "web_dev",
        profileName: "Web Development & Funnels",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },

  seo: {
    id: "seo",
    name: "SEO & Local Search (GBP)",
    targetDescription: "Highlights incomplete Google Business Profiles and low local visibility",
    evaluateOpportunity: (record, _signals, _maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const missingCount = record.missing_fields?.length || 0;
      const reviews = record.review_count || 0;
      const hasMissingHours = record.missing_fields?.includes("hours");
      const hasMissingDesc = record.missing_fields?.includes("description");

      if (missingCount >= 2 && (reviews >= 15 || hasMissingHours || hasMissingDesc)) {
        matchedSignals.push("sig_profile_incomplete", "sig_opp_incomplete_active");
        reasons.push(
          `Incomplete Google Business Profile (${missingCount} missing fields) with existing local customer activity.`
        );
        return {
          profileId: "seo",
          profileName: "SEO & Local Search (GBP)",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (missingCount > 0 || (reviews < 20 && reviews > 0)) {
        matchedSignals.push("sig_profile_incomplete");
        reasons.push("Listing has optimization gaps in content, hours, or review authority.");
        return {
          profileId: "seo",
          profileName: "SEO & Local Search (GBP)",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push("Profile is well-populated with complete listing attributes.");
      return {
        profileId: "seo",
        profileName: "SEO & Local Search (GBP)",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },

  reputation: {
    id: "reputation",
    name: "Reputation Management",
    targetDescription: "Targets businesses with low ratings or low review volume needing review funnels",
    evaluateOpportunity: (record, _signals, _maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const rating = record.rating;
      const reviews = record.review_count || 0;

      if (rating !== null && rating < 4.0 && reviews >= 10) {
        matchedSignals.push("sig_rating_poor", "sig_opp_low_rate_high_rev");
        reasons.push(
          `Sub-optimal rating (${rating.toFixed(1)} stars across ${reviews} reviews) indicates urgent reputation repair need.`
        );
        return {
          profileId: "reputation",
          profileName: "Reputation Management",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (reviews <= 10 && reviews > 0) {
        matchedSignals.push("sig_reviews_low");
        reasons.push(`Low review volume (${reviews} reviews) needs automated review generation funnels.`);
        return {
          profileId: "reputation",
          profileName: "Reputation Management",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push(`Healthy star rating (${rating?.toFixed(1) || "N/A"}) with sufficient customer volume.`);
      return {
        profileId: "reputation",
        profileName: "Reputation Management",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },

  social_media: {
    id: "social_media",
    name: "Social Media Marketing",
    targetDescription: "Targets businesses with missing social presence or reliance on social-only channels",
    evaluateOpportunity: (record, _signals, _maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const socialCount = record.social_links?.length || 0;
      const reviews = record.review_count || 0;
      const isSocialOnly = record.website_status === "social_only";

      if (socialCount === 0 && reviews >= 20) {
        matchedSignals.push("sig_no_social");
        reasons.push(`Active business (${reviews} reviews) has no linked social media channels on Google Maps.`);
        return {
          profileId: "social_media",
          profileName: "Social Media Marketing",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (isSocialOnly) {
        matchedSignals.push("sig_social_only");
        reasons.push("Business relies exclusively on social profiles without integrated branding.");
        return {
          profileId: "social_media",
          profileName: "Social Media Marketing",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push("Listing has connected social profiles or minimal digital demand.");
      return {
        profileId: "social_media",
        profileName: "Social Media Marketing",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },

  ads: {
    id: "ads",
    name: "Paid Ads & PPC Scaling",
    targetDescription: "Finds mature businesses with websites and high ratings ready for traffic scaling",
    evaluateOpportunity: (record, _signals, maturityScore) => {
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      const hasSite = record.website_status === "website";
      const hasPhone = Boolean(record.phone && record.phone.trim().length >= 6);
      const rating = record.rating || 0;
      const reviews = record.review_count || 0;

      if (hasSite && hasPhone && rating >= 4.2 && reviews >= 25 && maturityScore >= 65) {
        matchedSignals.push("sig_web_and_social", "sig_full_contact", "sig_rating_excellent");
        reasons.push(
          `Solid foundation (${maturityScore}/100 digital score, ${rating.toFixed(1)} rating, website + phone) ready for paid ad acquisition.`
        );
        return {
          profileId: "ads",
          profileName: "Paid Ads & PPC Scaling",
          opportunityLevel: "high",
          matchedSignals,
          reasons,
        };
      }

      if (hasSite && (hasPhone || reviews >= 10)) {
        matchedSignals.push("sig_phone_available");
        reasons.push("Active website present. Potential candidate for targeted local campaigns.");
        return {
          profileId: "ads",
          profileName: "Paid Ads & PPC Scaling",
          opportunityLevel: "medium",
          matchedSignals,
          reasons,
        };
      }

      reasons.push("Missing core conversion infrastructure (website or direct phone line) for paid advertising.");
      return {
        profileId: "ads",
        profileName: "Paid Ads & PPC Scaling",
        opportunityLevel: "low",
        matchedSignals,
        reasons,
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Digital Maturity Score Calculation (0 - 100)
// ---------------------------------------------------------------------------

export function calculateDigitalMaturityScore(record: BusinessRecord): number {
  let score = 0;

  // 1. Website Presence (30 pts max)
  if (record.website_status === "website") {
    score += 30;
  } else if (record.website_status === "social_only") {
    score += 15;
  }

  // 2. Direct Contactability (25 pts max)
  if (record.phone && record.phone.trim().length >= 6) {
    score += 15;
  }
  if (record.address && record.address.trim().length >= 5) {
    score += 10;
  }

  // 3. Reputation Maturity (25 pts max)
  const rating = record.rating;
  if (rating !== null && rating >= 4.0) {
    score += 15;
  } else if (rating !== null && rating >= 3.0) {
    score += 10;
  } else if (rating !== null && rating > 0) {
    score += 5;
  }

  const reviews = record.review_count || 0;
  if (reviews >= 50) {
    score += 10;
  } else if (reviews >= 10) {
    score += 5;
  } else if (reviews > 0) {
    score += 2;
  }

  // 4. Profile Health & Completeness (20 pts max)
  if (record.opening_hours && record.opening_hours.length > 0) {
    score += 5;
  }
  if (record.description && record.description.trim().length > 10) {
    score += 5;
  }
  if (record.social_links && record.social_links.length > 0) {
    score += 5;
  }
  if (record.business_status === "operational") {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Pure Function: Compute Lead Intelligence for a Single Record
// ---------------------------------------------------------------------------

export function computeLeadIntelligence(
  record: BusinessRecord,
  nicheProfileId = "general"
): BusinessLeadIntelligence {
  const signals: SignalExplanation[] = [];

  const hasWebsite = record.website_status === "website";
  const isSocialOnly = record.website_status === "social_only";
  const hasNoWebsite = record.website_status === "none";
  const hasSocial = record.social_links && record.social_links.length > 0;
  const hasPhone = Boolean(record.phone && record.phone.trim().length >= 6);
  const hasAddress = Boolean(record.address && record.address.trim().length >= 5);
  const rating = record.rating;
  const reviews = record.review_count || 0;
  const missingFields = record.missing_fields || [];

  // A. Online Presence Signals
  if (hasNoWebsite) {
    signals.push({
      id: "sig_no_website",
      label: "No Website",
      category: "online_presence",
      description: "No dedicated conventional website domain detected.",
      evidence: "Website field is unpopulated.",
    });
  } else if (isSocialOnly) {
    signals.push({
      id: "sig_social_only",
      label: "Social Only",
      category: "online_presence",
      description: "Listing links only to social media profiles without a dedicated website.",
      evidence: `Social channels detected: ${record.social_links?.join(", ") || "None"}.`,
    });
  } else if (hasWebsite && hasSocial) {
    signals.push({
      id: "sig_web_and_social",
      label: "Website + Social",
      category: "online_presence",
      description: "Maintains both an active website domain and linked social channels.",
      evidence: `Website: ${record.website}, Social: ${record.social_links.length} profiles.`,
    });
  }

  if (!hasSocial) {
    signals.push({
      id: "sig_no_social",
      label: "No Social Links",
      category: "online_presence",
      description: "No linked social media channels discovered on listing.",
      evidence: "Social links array is empty.",
    });
  }

  // B. Contactability Signals
  if (hasPhone) {
    signals.push({
      id: "sig_phone_available",
      label: "Phone Available",
      category: "contactability",
      description: "Direct telephone contact is listed and accessible.",
      evidence: `Phone: ${record.phone}`,
    });
  } else {
    signals.push({
      id: "sig_phone_missing",
      label: "Phone Missing",
      category: "contactability",
      description: "No phone number listed on Google Maps profile.",
      evidence: "Phone field is empty.",
    });
  }

  if (hasPhone && hasAddress) {
    signals.push({
      id: "sig_full_contact",
      label: "Full Contact Info",
      category: "contactability",
      description: "Both direct phone and physical address are verified.",
      evidence: `Phone: ${record.phone}, Address: ${record.address}`,
    });
  }

  // C. Reputation Signals
  if (rating !== null && rating >= 4.5) {
    signals.push({
      id: "sig_rating_excellent",
      label: "Rating 4.5+",
      category: "reputation",
      description: "Highly rated business with strong customer satisfaction.",
      evidence: `Star rating: ${rating.toFixed(1)} / 5.0`,
    });
  } else if (rating !== null && rating < 4.0 && rating > 0) {
    signals.push({
      id: "sig_rating_poor",
      label: "Rating Under 4.0",
      category: "reputation",
      description: "Below-average rating represents reputation repair opportunity.",
      evidence: `Star rating: ${rating.toFixed(1)} / 5.0`,
    });
  }

  if (reviews >= 100) {
    signals.push({
      id: "sig_reviews_high",
      label: "100+ Reviews",
      category: "reputation",
      description: "Strong public proof with high customer review volume.",
      evidence: `${reviews} verified reviews recorded.`,
    });
  } else if (reviews <= 10 && reviews > 0) {
    signals.push({
      id: "sig_reviews_low",
      label: "10 or Fewer Reviews",
      category: "reputation",
      description: "Low review volume indicates need for review generation.",
      evidence: `Only ${reviews} reviews recorded.`,
    });
  } else if (reviews === 0 || rating === null) {
    signals.push({
      id: "sig_unreviewed",
      label: "No Reviews",
      category: "reputation",
      description: "Listing has zero customer reviews on Google Maps.",
      evidence: "Review count is 0 or unlisted.",
    });
  }

  // D. Profile Completeness Signals
  if (missingFields.length === 0) {
    signals.push({
      id: "sig_profile_complete",
      label: "Complete Profile",
      category: "profile",
      description: "All core business information fields are populated.",
      evidence: "No missing fields flagged.",
    });
  } else {
    signals.push({
      id: "sig_profile_incomplete",
      label: "Incomplete Profile",
      category: "profile",
      description: "Listing has missing information fields.",
      evidence: `Missing fields: ${missingFields.join(", ")}`,
    });
  }

  // E. Compound Opportunity Signals
  if (reviews >= 30 && hasNoWebsite) {
    signals.push({
      id: "sig_opp_high_rev_no_site",
      label: "High Reviews / No Website",
      category: "opportunity",
      description: "Established business with proven customer demand but no web portal.",
      evidence: `${reviews} reviews recorded, but website is missing.`,
    });
  }

  if (rating !== null && rating >= 4.5 && hasNoWebsite) {
    signals.push({
      id: "sig_opp_high_rate_no_site",
      label: "High Rating / No Website",
      category: "opportunity",
      description: "Quality business with top ratings lacking a conversion website.",
      evidence: `${rating.toFixed(1)} rating, but website is missing.`,
    });
  }

  if (reviews >= 30 && isSocialOnly) {
    signals.push({
      id: "sig_opp_high_rev_social",
      label: "High Reviews / Social Only",
      category: "opportunity",
      description: "Active customer volume relying exclusively on third-party social pages.",
      evidence: `${reviews} reviews recorded, social only presence.`,
    });
  }

  if (rating !== null && rating < 4.0 && reviews >= 20) {
    signals.push({
      id: "sig_opp_low_rate_high_rev",
      label: "Low Rating / Active Reviews",
      category: "opportunity",
      description: "High traffic business suffering from reputation and sentiment issues.",
      evidence: `${rating.toFixed(1)} rating across ${reviews} reviews.`,
    });
  }

  if (missingFields.length >= 2 && reviews >= 15) {
    signals.push({
      id: "sig_opp_incomplete_active",
      label: "Incomplete / Active Business",
      category: "opportunity",
      description: "Active business with an unmanaged or poorly configured Google listing.",
      evidence: `${missingFields.length} missing fields with ${reviews} reviews.`,
    });
  }

  // Classifications
  let onlinePresenceType: BusinessLeadIntelligence["onlinePresenceType"] = "no_presence";
  if (hasWebsite && hasSocial) onlinePresenceType = "website_and_social";
  else if (hasWebsite) onlinePresenceType = "website_only";
  else if (isSocialOnly) onlinePresenceType = "social_only";

  let contactabilityTier: BusinessLeadIntelligence["contactabilityTier"] = "unreachable";
  if (hasPhone && hasAddress) contactabilityTier = "complete";
  else if (hasPhone) contactabilityTier = "phone_only";
  else if (hasAddress) contactabilityTier = "address_only";

  let reputationTier: BusinessLeadIntelligence["reputationTier"] = "unreviewed";
  if (rating !== null && rating >= 4.5) reputationTier = "excellent";
  else if (rating !== null && rating >= 4.0) reputationTier = "good";
  else if (rating !== null && rating > 0) reputationTier = "poor";

  let reviewVolumeTier: BusinessLeadIntelligence["reviewVolumeTier"] = "none";
  if (reviews >= 100) reviewVolumeTier = "high";
  else if (reviews >= 25) reviewVolumeTier = "moderate";
  else if (reviews > 0) reviewVolumeTier = "low";

  const totalTrackedFields = 8;
  const populatedFieldsCount = Math.max(0, totalTrackedFields - missingFields.length);
  const profileCompletenessPercentage = Math.round((populatedFieldsCount / totalTrackedFields) * 100);

  const maturityScore = calculateDigitalMaturityScore(record);

  // Evaluate All Niche Profiles
  const nicheQualifications: Record<string, NicheQualification> = {};
  for (const [key, profile] of Object.entries(NICHE_PROFILES)) {
    nicheQualifications[key] = profile.evaluateOpportunity(record, signals, maturityScore);
  }

  const activeProfile = nicheQualifications[nicheProfileId] || nicheQualifications.general;

  return {
    digitalMaturityScore: maturityScore,
    onlinePresenceType,
    contactabilityTier,
    reputationTier,
    reviewVolumeTier,
    profileCompletenessPercentage,
    signals,
    activeNiche: activeProfile,
    nicheQualifications,
  };
}

// ---------------------------------------------------------------------------
// Pure Function: Compute Lead Intelligence Summary across multiple records
// ---------------------------------------------------------------------------

export function computeLeadIntelligenceSummary(
  records: BusinessRecord[],
  nicheProfileId = "general"
): LeadIntelligenceSummary {
  let websiteCount = 0;
  let socialOnlyCount = 0;
  let noWebsiteCount = 0;
  let websiteAndSocialCount = 0;
  let noSocialCount = 0;

  let phoneAvailableCount = 0;
  let phoneMissingCount = 0;
  let fullContactCount = 0;

  let rating45PlusCount = 0;
  let ratingUnder40Count = 0;
  let reviews100PlusCount = 0;
  let reviews10OrLessCount = 0;
  let unreviewedCount = 0;
  let totalRatingSum = 0;
  let ratedRecordsCount = 0;

  let completeProfileCount = 0;
  let incompleteProfileCount = 0;
  let missingHoursCount = 0;
  let missingDescriptionCount = 0;

  let highReviewsNoWebsiteCount = 0;
  let highRatingNoWebsiteCount = 0;
  let highReviewsSocialOnlyCount = 0;
  let lowRatingActiveReviewsCount = 0;
  let incompleteActiveListingCount = 0;

  let highOpportunityCount = 0;
  let mediumOpportunityCount = 0;
  let lowOpportunityCount = 0;

  const profileDef = NICHE_PROFILES[nicheProfileId] || NICHE_PROFILES.general;

  for (const record of records) {
    if (record.extraction_status === "duplicate") continue;

    const intel = computeLeadIntelligence(record, nicheProfileId);

    // Online presence
    if (record.website_status === "website") {
      websiteCount++;
      if (record.social_links && record.social_links.length > 0) {
        websiteAndSocialCount++;
      }
    } else if (record.website_status === "social_only") {
      socialOnlyCount++;
    } else {
      noWebsiteCount++;
    }

    if (!record.social_links || record.social_links.length === 0) {
      noSocialCount++;
    }

    // Contactability
    if (record.phone && record.phone.trim().length >= 6) {
      phoneAvailableCount++;
    } else {
      phoneMissingCount++;
    }

    if (record.phone && record.phone.trim().length >= 6 && record.address && record.address.trim().length >= 5) {
      fullContactCount++;
    }

    // Reputation
    if (record.rating !== null && record.rating > 0) {
      totalRatingSum += record.rating;
      ratedRecordsCount++;
      if (record.rating >= 4.5) rating45PlusCount++;
      else if (record.rating < 4.0) ratingUnder40Count++;
    } else {
      unreviewedCount++;
    }

    const reviews = record.review_count || 0;
    if (reviews >= 100) reviews100PlusCount++;
    else if (reviews <= 10 && reviews > 0) reviews10OrLessCount++;

    // Profile
    if (!record.missing_fields || record.missing_fields.length === 0) {
      completeProfileCount++;
    } else {
      incompleteProfileCount++;
      if (record.missing_fields.includes("hours")) missingHoursCount++;
      if (record.missing_fields.includes("description")) missingDescriptionCount++;
    }

    // Compound signals
    const signalIds = intel.signals.map((s) => s.id);
    if (signalIds.includes("sig_opp_high_rev_no_site")) highReviewsNoWebsiteCount++;
    if (signalIds.includes("sig_opp_high_rate_no_site")) highRatingNoWebsiteCount++;
    if (signalIds.includes("sig_opp_high_rev_social")) highReviewsSocialOnlyCount++;
    if (signalIds.includes("sig_opp_low_rate_high_rev")) lowRatingActiveReviewsCount++;
    if (signalIds.includes("sig_opp_incomplete_active")) incompleteActiveListingCount++;

    // Niche opportunity
    if (intel.activeNiche.opportunityLevel === "high") highOpportunityCount++;
    else if (intel.activeNiche.opportunityLevel === "medium") mediumOpportunityCount++;
    else lowOpportunityCount++;
  }

  const averageRating = ratedRecordsCount > 0 ? parseFloat((totalRatingSum / ratedRecordsCount).toFixed(1)) : null;

  return {
    totalRecords: records.filter((r) => r.extraction_status !== "duplicate").length,
    websiteCount,
    socialOnlyCount,
    noWebsiteCount,
    websiteAndSocialCount,
    noSocialCount,
    phoneAvailableCount,
    phoneMissingCount,
    fullContactCount,
    rating45PlusCount,
    ratingUnder40Count,
    reviews100PlusCount,
    reviews10OrLessCount,
    unreviewedCount,
    averageRating,
    completeProfileCount,
    incompleteProfileCount,
    missingHoursCount,
    missingDescriptionCount,
    highReviewsNoWebsiteCount,
    highRatingNoWebsiteCount,
    highReviewsSocialOnlyCount,
    lowRatingActiveReviewsCount,
    incompleteActiveListingCount,
    activeProfileId: profileDef.id,
    activeProfileName: profileDef.name,
    highOpportunityCount,
    mediumOpportunityCount,
    lowOpportunityCount,
  };
}
