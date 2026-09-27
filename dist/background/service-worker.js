var kt = Object.defineProperty;
var Lt = (t, e, s) => e in t ? kt(t, e, { enumerable: !0, configurable: !0, writable: !0, value: s }) : t[e] = s;
var v = (t, e, s) => Lt(t, typeof e != "symbol" ? e + "" : e, s);
function K(t) {
  if (!t) return null;
  const e = t.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (e) return e[1];
  const s = t.match(/[?&]data=.*?(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (s) return s[1];
  const i = t.match(/[?&]ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (i) return i[1];
  const n = t.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (n) return n[1];
  const a = t.match(/!19s(ChIJ[0-9a-zA-Z_-]+)/i);
  return a ? a[1] : null;
}
function Ee(t) {
  if (!t) return { lat: null, lng: null };
  const e = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (e) {
    const n = parseFloat(e[1]), a = parseFloat(e[2]);
    if (!isNaN(n) && !isNaN(a))
      return { lat: n, lng: a };
  }
  const s = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (s) {
    const n = parseFloat(s[1]), a = parseFloat(s[2]);
    if (!isNaN(n) && !isNaN(a))
      return { lat: n, lng: a };
  }
  const i = t.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (i) {
    const n = parseFloat(i[1]), a = parseFloat(i[2]);
    if (!isNaN(n) && !isNaN(a))
      return { lat: n, lng: a };
  }
  return { lat: null, lng: null };
}
function Rt(t) {
  var s;
  const e = t.querySelector('button[data-item-id*="oloc"]') || t.querySelector('button[aria-label*="Plus code" i]') || t.querySelector('[data-tooltip*="Plus code" i]');
  if (e) {
    const i = ((s = e.textContent) == null ? void 0 : s.trim()) || "", n = i.match(/[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(\s+.+)?/i);
    if (n) return n[0].trim();
    if (i) return i;
  }
  return null;
}
const Mt = {
  maxPhotos: 0,
  // unlimited by default per user selection
  maxVideos: 0,
  maxReviews: 0,
  extractPhotos: !0,
  extractVideos: !0,
  extractReviews: !0,
  expandReviewText: !0,
  minDelaySeconds: 2.5,
  maxDelaySeconds: 4.5,
  requestDelayMs: 2500
}, Ue = (t, e) => e.some((s) => t instanceof s);
let Ze, et;
function Ot() {
  return Ze || (Ze = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Ut() {
  return et || (et = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const je = /* @__PURE__ */ new WeakMap(), Ne = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap();
function jt(t) {
  const e = new Promise((s, i) => {
    const n = () => {
      t.removeEventListener("success", a), t.removeEventListener("error", l);
    }, a = () => {
      s(le(t.result)), n();
    }, l = () => {
      i(t.error), n();
    };
    t.addEventListener("success", a), t.addEventListener("error", l);
  });
  return xe.set(e, t), e;
}
function qt(t) {
  if (je.has(t))
    return;
  const e = new Promise((s, i) => {
    const n = () => {
      t.removeEventListener("complete", a), t.removeEventListener("error", l), t.removeEventListener("abort", l);
    }, a = () => {
      s(), n();
    }, l = () => {
      i(t.error || new DOMException("AbortError", "AbortError")), n();
    };
    t.addEventListener("complete", a), t.addEventListener("error", l), t.addEventListener("abort", l);
  });
  je.set(t, e);
}
let qe = {
  get(t, e, s) {
    if (t instanceof IDBTransaction) {
      if (e === "done")
        return je.get(t);
      if (e === "store")
        return s.objectStoreNames[1] ? void 0 : s.objectStore(s.objectStoreNames[0]);
    }
    return le(t[e]);
  },
  set(t, e, s) {
    return t[e] = s, !0;
  },
  has(t, e) {
    return t instanceof IDBTransaction && (e === "done" || e === "store") ? !0 : e in t;
  }
};
function vt(t) {
  qe = t(qe);
}
function Ft(t) {
  return Ut().includes(t) ? function(...e) {
    return t.apply(Fe(this), e), le(this.request);
  } : function(...e) {
    return le(t.apply(Fe(this), e));
  };
}
function Wt(t) {
  return typeof t == "function" ? Ft(t) : (t instanceof IDBTransaction && qt(t), Ue(t, Ot()) ? new Proxy(t, qe) : t);
}
function le(t) {
  if (t instanceof IDBRequest)
    return jt(t);
  if (Ne.has(t))
    return Ne.get(t);
  const e = Wt(t);
  return e !== t && (Ne.set(t, e), xe.set(e, t)), e;
}
const Fe = (t) => xe.get(t);
function Bt(t, e, { blocked: s, upgrade: i, blocking: n, terminated: a } = {}) {
  const l = indexedDB.open(t, e), o = le(l);
  return i && l.addEventListener("upgradeneeded", (r) => {
    i(le(l.result), r.oldVersion, r.newVersion, le(l.transaction), r);
  }), s && l.addEventListener("blocked", (r) => s(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    r.oldVersion,
    r.newVersion,
    r
  )), o.then((r) => {
    a && r.addEventListener("close", () => a()), n && r.addEventListener("versionchange", (c) => n(c.oldVersion, c.newVersion, c));
  }).catch(() => {
  }), o;
}
const $t = ["get", "getKey", "getAll", "getAllKeys", "count"], Gt = ["put", "add", "delete", "clear"], Pe = /* @__PURE__ */ new Map();
function tt(t, e) {
  if (!(t instanceof IDBDatabase && !(e in t) && typeof e == "string"))
    return;
  if (Pe.get(e))
    return Pe.get(e);
  const s = e.replace(/FromIndex$/, ""), i = e !== s, n = Gt.includes(s);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(s in (i ? IDBIndex : IDBObjectStore).prototype) || !(n || $t.includes(s))
  )
    return;
  const a = async function(l, ...o) {
    const r = this.transaction(l, n ? "readwrite" : "readonly");
    let c = r.store;
    return i && (c = c.index(o.shift())), (await Promise.all([
      c[s](...o),
      n && r.done
    ]))[0];
  };
  return Pe.set(e, a), a;
}
vt((t) => ({
  ...t,
  get: (e, s, i) => tt(e, s) || t.get(e, s, i),
  has: (e, s) => !!tt(e, s) || t.has(e, s)
}));
const Ht = ["continue", "continuePrimaryKey", "advance"], st = {}, We = /* @__PURE__ */ new WeakMap(), It = /* @__PURE__ */ new WeakMap(), Kt = {
  get(t, e) {
    if (!Ht.includes(e))
      return t[e];
    let s = st[e];
    return s || (s = st[e] = function(...i) {
      We.set(this, It.get(this)[e](...i));
    }), s;
  }
};
async function* zt(...t) {
  let e = this;
  if (e instanceof IDBCursor || (e = await e.openCursor(...t)), !e)
    return;
  e = e;
  const s = new Proxy(e, Kt);
  for (It.set(s, e), xe.set(s, Fe(e)); e; )
    yield s, e = await (We.get(s) || e.continue()), We.delete(s);
}
function it(t, e) {
  return e === Symbol.asyncIterator && Ue(t, [IDBIndex, IDBObjectStore, IDBCursor]) || e === "iterate" && Ue(t, [IDBIndex, IDBObjectStore]);
}
vt((t) => ({
  ...t,
  get(e, s, i) {
    return it(e, s) ? zt : t.get(e, s, i);
  },
  has(e, s) {
    return it(e, s) || t.has(e, s);
  }
}));
const Vt = {
  minDelaySeconds: 20,
  maxDelaySeconds: 45,
  batchSizeLimit: 30,
  skipPreviouslyMessaged: !0,
  includeSocialOnly: !1,
  maxConsecutiveErrors: 3
}, Et = [
  {
    template_id: "tpl_web_1_free_demo",
    title: "1. Simple Free Demo Offer",
    content: "{Hi|Hello} {business_name}, I saw your {category} on Google Maps. You don't have a website listed yet. We make simple websites that help local businesses get more customer calls. Can I send you a free sample website we made for your business?",
    is_default: !0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_2_search_ranking",
    title: "2. More Calls and Customers",
    content: "{Hello|Hi} {business_name}, noticed your business on Google Maps without a website. Having a clean website helps customers in {city} find you and call you directly. Would you like to see a quick free demo website we created for you?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_3_customer_trust",
    title: "3. Google Search Free Sample",
    content: "{Hey|Hi} {business_name}, I came across your {category} on Maps. Many people in {city} search online before visiting, but you don't have a website link. I made a free sample website for {business_name}. Can I share it with you?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_4_direct_inquiries",
    title: "4. Fast Mobile Website",
    content: "{Hi|Hello} {business_name}, saw your listing on Google Maps. We build fast, simple mobile websites for local businesses so customers can easily see your services and call. Would you be open to seeing a free website sample?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_5_competitor_edge",
    title: "5. Free Preview Website",
    content: "{Hello|Hi} {business_name}, I was looking for {category} in {city} on Google Maps and noticed you have no website yet. We help local shops and businesses get online easily. Can I send you a free preview website we designed for you?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_6_casual_direct",
    title: "6. Quick Question and Mockup",
    content: "{Hey|Hello} {business_name}, quick question — are you looking for a website for your business? We create simple, clean websites to get you more calls from Google. Can I show you a free mockup we prepared for {business_name}?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_7_services_showcase",
    title: "7. Show Services and Contact",
    content: "{Hi|Hello} {business_name}, found your {category} on Google Maps. A simple 1-page website showing your services helps new customers trust you faster. Can I send you a quick free sample website to take a look?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_8_short_punchy",
    title: "8. Short and Budget-Friendly",
    content: "{Hi|Hello} {business_name}, saw you don't have a website on your Google profile. We make simple, budget-friendly websites for local businesses in {city}. Open to checking out a free demo design for your business?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_9_local_growth",
    title: "9. Direct Calls and Growth",
    content: "{Hello|Hi} {business_name}, loved your listing on Google Maps! We help businesses in {city} get more direct calls with a modern website. We already prepared a free website sample for you — can I send the link?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  },
  {
    template_id: "tpl_web_10_concept_preview",
    title: "10. Zero Obligation Preview",
    content: "{Hey|Hi} {business_name}, noticed your {category} listing has no website link on Google. I created a quick sample website for {business_name}. It's totally free to view — would you like me to send it over?",
    is_default: !1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  }
], Jt = Et[0], Qt = "lead-extraction-db", Xt = 4;
let Se = null;
async function N() {
  return Se || (Se = await Bt(Qt, Xt, {
    upgrade(t) {
      if (!t.objectStoreNames.contains("sessions")) {
        const e = t.createObjectStore("sessions", { keyPath: "sessionId" });
        e.createIndex("updatedAt", "updatedAt"), e.createIndex("status", "status");
      }
      if (!t.objectStoreNames.contains("queue_items")) {
        const e = t.createObjectStore("queue_items", { keyPath: "queueId" });
        e.createIndex("sessionId", "sessionId"), e.createIndex("status", "status");
      }
      if (!t.objectStoreNames.contains("business_records")) {
        const e = t.createObjectStore("business_records", { keyPath: "record_id" });
        e.createIndex("sessionId", "sessionId"), e.createIndex("placeIdentifier", "place_identifier"), e.createIndex("normalizedNameAddress", "normalizedNameAddress"), e.createIndex("normalizedNamePhone", "normalizedNamePhone"), e.createIndex("websiteStatus", "website_status"), e.createIndex("extractionStatus", "extraction_status");
      }
      if (t.objectStoreNames.contains("settings") || t.createObjectStore("settings", { keyPath: "key" }), !t.objectStoreNames.contains("media_review_jobs")) {
        const e = t.createObjectStore("media_review_jobs", { keyPath: "jobId" });
        e.createIndex("businessId", "businessId"), e.createIndex("status", "status"), e.createIndex("updatedAt", "updatedAt");
      }
      if (!t.objectStoreNames.contains("media_records")) {
        const e = t.createObjectStore("media_records", { keyPath: "media_id" });
        e.createIndex("businessId", "business_id"), e.createIndex("reviewId", "review_id"), e.createIndex("sourceContext", "source_context"), e.createIndex("canonicalFingerprint", "canonicalFingerprint"), e.createIndex("extractionStatus", "extraction_status");
      }
      if (!t.objectStoreNames.contains("review_records")) {
        const e = t.createObjectStore("review_records", { keyPath: "review_id" });
        e.createIndex("businessId", "business_id"), e.createIndex("rating", "rating"), e.createIndex("extractionStatus", "extraction_status"), e.createIndex("reviewFingerprint", "reviewFingerprint");
      }
      if (!t.objectStoreNames.contains("whatsapp_outreach")) {
        const e = t.createObjectStore("whatsapp_outreach", { keyPath: "outreach_id" });
        e.createIndex("phone_normalized", "phone_normalized"), e.createIndex("session_id", "session_id"), e.createIndex("status", "status"), e.createIndex("sent_timestamp", "sent_timestamp");
      }
      if (!t.objectStoreNames.contains("outreach_templates")) {
        const e = t.createObjectStore("outreach_templates", { keyPath: "template_id" });
        e.createIndex("is_default", "is_default"), e.put({
          ...Jt,
          is_default: 1
        });
      }
      if (!t.objectStoreNames.contains("linkedin_sessions")) {
        const e = t.createObjectStore("linkedin_sessions", { keyPath: "sessionId" });
        e.createIndex("status", "status"), e.createIndex("updatedAt", "updatedAt");
      }
      if (!t.objectStoreNames.contains("linkedin_profiles")) {
        const e = t.createObjectStore("linkedin_profiles", { keyPath: "profileId" });
        e.createIndex("sessionId", "sessionId"), e.createIndex("connectionStatus", "connectionStatus"), e.createIndex("websiteStatus", "websiteStatus");
      }
    }
  }), Se);
}
async function Yt() {
  const t = await N(), s = [
    "sessions",
    "queue_items",
    "business_records",
    "media_review_jobs",
    "media_records",
    "review_records",
    "whatsapp_outreach"
  ].filter((n) => t.objectStoreNames.contains(n)), i = t.transaction(s, "readwrite");
  await Promise.all([
    ...s.map((n) => i.objectStore(n).clear()),
    i.done
  ]);
}
function At(t) {
  if (!t) return "";
  try {
    return t.replace(/=w\d+-h\d+.*$/, "").replace(/=s\d+.*$/, "").trim();
  } catch {
    return t.trim();
  }
}
function Zt(t) {
  const e = t.slice(0, 200).trim().toLowerCase();
  let s = 0;
  for (let i = 0; i < e.length; i++)
    s = (s << 5) - s + e.charCodeAt(i), s |= 0;
  return s.toString(16);
}
function Ct(t) {
  if (t.source_media_id)
    return `src_id:${t.source_media_id}`;
  if (t.media_url) {
    const e = At(t.media_url);
    if (e) return `url:${e}`;
  }
  return t.embed_url && t.embed_url !== "unavailable" ? `embed:${t.embed_url}` : t.source_url ? `source:${t.source_url}|${t.source_context || "unknown"}` : `media_id:${t.media_id || ""}`;
}
function es(t) {
  if (t.source_review_id)
    return `src_id:${t.source_review_id}`;
  const e = Zt(t.review_text || "");
  return t.author_profile_url && t.author_profile_url.length > 5 ? `author_url:${t.author_profile_url}|${t.review_date || t.review_relative_time || ""}|${e}` : `author_name:${(t.author_name || "").toLowerCase().trim()}|${t.review_relative_time || ""}|${e}`;
}
async function G(t) {
  const e = await N();
  t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await e.put("media_review_jobs", t);
}
async function Tt(t) {
  return (await N()).get("media_review_jobs", t);
}
async function ts(t, e) {
  if (e.length === 0) return { saved: 0, duplicates: 0 };
  const i = (await N()).transaction("media_records", "readwrite"), n = i.store, a = n.index("canonicalFingerprint");
  let l = 0, o = 0;
  for (const r of e) {
    const c = Ct(r);
    r.canonicalFingerprint = c;
    const u = await a.getAll(IDBKeyRange.only(c));
    if (u.some((h) => h.business_id === t)) {
      o++;
      const h = u.find((p) => p.business_id === t);
      if (h) {
        let p = !1;
        !h.media_url && r.media_url && (h.media_url = r.media_url, p = !0), h.embed_url === "unavailable" && r.embed_url && r.embed_url !== "unavailable" && (h.embed_url = r.embed_url, p = !0), !h.title && r.title && (h.title = r.title, p = !0), !h.caption && r.caption && (h.caption = r.caption, p = !0), p && await n.put(h);
      }
    } else
      await n.put(r), l++;
  }
  return await i.done, { saved: l, duplicates: o };
}
async function nt(t) {
  const e = await N();
  return !t || t === "all" ? e.getAll("media_records") : e.transaction("media_records", "readonly").store.index("businessId").getAll(IDBKeyRange.only(t));
}
async function ss(t, e) {
  if (e.length === 0) return { saved: 0, duplicates: 0 };
  const i = (await N()).transaction(["review_records", "media_records"], "readwrite"), n = i.objectStore("review_records"), a = i.objectStore("media_records"), l = n.index("reviewFingerprint");
  let o = 0, r = 0;
  for (const c of e) {
    const u = es(c);
    c.reviewFingerprint = u;
    const d = await l.getAll(IDBKeyRange.only(u));
    if (d.some((p) => p.business_id === t)) {
      r++;
      const p = d.find((f) => f.business_id === t);
      if (p) {
        let f = !1;
        (!p.owner_response || !p.owner_response.text) && c.owner_response && (p.owner_response = c.owner_response, f = !0), c.review_text.length > p.review_text.length && (p.review_text = c.review_text, f = !0), f && await n.put(p);
      }
    } else if (await n.put(c), o++, c.media && c.media.length > 0)
      for (const p of c.media)
        p.canonicalFingerprint = Ct(p), await a.put(p);
  }
  return await i.done, { saved: o, duplicates: r };
}
async function at(t) {
  const e = await N();
  return !t || t === "all" ? e.getAll("review_records") : e.transaction("review_records", "readonly").store.index("businessId").getAll(IDBKeyRange.only(t));
}
const ge = {
  speedPreset: "standard",
  minDelaySeconds: 5,
  maxDelaySeconds: 10,
  maxBusinesses: 0,
  maxRetriesPerBusiness: 2,
  maxConsecutiveFailures: 5,
  csvMissingPlaceholder: "",
  includeDuplicateRecords: !1,
  includeInternalIdentifiers: !1,
  duplicateMergePolicy: "fill_gaps",
  duplicateScope: "current_session",
  geminiApiKey: ""
}, Be = 0;
function is(t) {
  const e = { ...ge, ...t };
  return e.speedPreset || (e.speedPreset = "standard"), e.minDelaySeconds < Be && (e.minDelaySeconds = Be), e.maxDelaySeconds < e.minDelaySeconds && (e.maxDelaySeconds = e.minDelaySeconds + 0.2), e.maxBusinesses < 0 && (e.maxBusinesses = 0), e.maxRetriesPerBusiness < 0 && (e.maxRetriesPerBusiness = 0), e.maxConsecutiveFailures < 1 && (e.maxConsecutiveFailures = 1), e;
}
function B(t) {
  return new Promise((e) => setTimeout(e, t));
}
function Ce(t = 3.5, e = 6) {
  if (t === 0 && e === 0)
    return 0;
  const s = Math.max(Be, t), i = Math.max(s, e), n = s + Math.random() * (i - s);
  return Math.round(n * 1e3);
}
function ns(t, e = 4, s = 60) {
  if (e === 0)
    return 0;
  const i = Math.min(s, e * Math.pow(2, t));
  return Math.round(i * 1e3);
}
function xt(t, e, s) {
  const i = [], n = [];
  let a = "success";
  return t.mediaUrl || (a = "partial", i.push("media_url")), {
    media_id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source_media_id: t.sourceMediaId || null,
    business_id: e,
    source_business_id: null,
    review_id: t.reviewId || null,
    type: t.type,
    source_url: t.sourceUrl || s,
    media_url: t.mediaUrl,
    embed_url: t.embedUrl || "",
    thumbnail_url: t.thumbnailUrl || "",
    title: t.title || "",
    caption: t.caption || "",
    width: t.width ?? null,
    height: t.height ?? null,
    duration: t.duration ?? null,
    source_context: t.sourceContext,
    source_platform: "google_maps",
    extraction_status: a,
    extraction_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    missing_fields: i,
    error_fields: n
  };
}
function as(t, e, s) {
  const i = [], n = [];
  t.reviewText || i.push("review_text"), t.reviewDate || i.push("review_date");
  const a = (t.media || []).map(
    (l) => xt(l, e, s)
  );
  return {
    review_id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source_review_id: t.sourceReviewId || null,
    business_id: e,
    source_business_id: null,
    author_name: t.authorName || "Google User",
    author_profile_url: t.authorProfileUrl || "",
    author_review_count: t.authorReviewCount ?? null,
    rating: t.rating,
    review_text: t.reviewText || "",
    review_date: t.reviewDate || "",
    review_relative_time: t.reviewRelativeTime || "",
    review_url: t.reviewUrl || "",
    language: t.language || "en",
    owner_response: t.ownerResponse || null,
    media: a,
    source_platform: "google_maps",
    extraction_status: "success",
    extraction_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    missing_fields: i,
    error_fields: n
  };
}
class rt {
  constructor(e, s) {
    v(this, "job");
    v(this, "callbacks");
    v(this, "isMediaLoopRunning", !1);
    v(this, "isReviewLoopRunning", !1);
    v(this, "consecutiveMediaFailures", 0);
    v(this, "consecutiveReviewFailures", 0);
    v(this, "emptyMediaScrolls", 0);
    v(this, "emptyReviewScrolls", 0);
    this.job = e, this.callbacks = s;
  }
  getJob() {
    return this.job;
  }
  setJob(e) {
    this.job = e;
  }
  /**
   * Factory to initialize a new job for a target
   */
  static createJob(e, s, i, n = null) {
    const a = {
      ...Mt,
      ...i
    }, l = (/* @__PURE__ */ new Date()).toISOString();
    return {
      jobId: `mrj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      businessId: s,
      businessName: e.business_name,
      sourceUrl: e.maps_url,
      parentSessionId: n,
      status: "idle",
      pauseReason: null,
      mediaStatus: a.extractPhotos || a.extractVideos ? "running" : "complete",
      reviewStatus: a.extractReviews ? "running" : "complete",
      createdAt: l,
      updatedAt: l,
      completedAt: null,
      error_message: null,
      mediaProgress: {
        photosFound: 0,
        photosExtracted: 0,
        videosFound: 0,
        videosExtracted: 0
      },
      reviewProgress: {
        reviewsAvailable: null,
        reviewsFound: 0,
        reviewsExtracted: 0,
        reviewMediaFound: 0,
        reviewMediaExtracted: 0
      },
      reviewSummary: {
        reported_review_count: null,
        reviews_found: 0,
        reviews_extracted: 0,
        reviews_failed: 0,
        count_discrepancy: !1,
        status: a.extractReviews ? "partial" : "empty",
        sort_mode: "default"
      },
      settingsSnapshot: a
    };
  }
  /**
   * Starts or resumes the extraction process for active tracks
   */
  async start() {
    this.job.status = "running", this.job.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), (this.job.settingsSnapshot.extractPhotos || this.job.settingsSnapshot.extractVideos) && this.job.mediaStatus !== "complete" && (this.job.mediaStatus = "running"), this.job.settingsSnapshot.extractReviews && this.job.reviewStatus !== "complete" && (this.job.reviewStatus = "running"), await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job }), this.job.mediaStatus === "running" && this.runMediaTrack(), this.job.reviewStatus === "running" && this.runReviewTrack();
  }
  /**
   * Pauses media, review, or both tracks (PRD §19, §20)
   */
  async pause(e = "all") {
    const s = (/* @__PURE__ */ new Date()).toISOString();
    (e === "media" || e === "all") && this.job.mediaStatus === "running" && (this.job.mediaStatus = "paused"), (e === "review" || e === "reviews" || e === "all") && this.job.reviewStatus === "running" && (this.job.reviewStatus = "paused"), this.updateOverallStatus(), this.job.updatedAt = s, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }
  /**
   * Resumes paused tracks
   */
  async resume(e = "all") {
    const s = (/* @__PURE__ */ new Date()).toISOString();
    (e === "media" || e === "all") && (this.job.mediaStatus === "paused" || this.job.mediaStatus === "failed") && (this.job.mediaStatus = "running", this.consecutiveMediaFailures = 0), (e === "review" || e === "reviews" || e === "all") && (this.job.reviewStatus === "paused" || this.job.reviewStatus === "failed") && (this.job.reviewStatus = "running", this.consecutiveReviewFailures = 0), this.updateOverallStatus(), this.job.updatedAt = s, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job }), this.job.mediaStatus === "running" && !this.isMediaLoopRunning && this.runMediaTrack(), this.job.reviewStatus === "running" && !this.isReviewLoopRunning && this.runReviewTrack();
  }
  /**
   * Permanently stops both tracks, preserving all persisted records (PRD §21)
   */
  async stop() {
    const e = (/* @__PURE__ */ new Date()).toISOString();
    this.job.status = "stopped", this.job.mediaStatus = "complete", this.job.reviewStatus = "complete", this.job.completedAt = e, this.job.updatedAt = e, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }
  /**
   * Verification challenge detected: immediate hard pause (PRD §40, §41)
   */
  async handleVerification() {
    await this.pause("all"), this.job.pauseReason = "verification_required", this.job.error_message = "Verification challenge detected. Extraction paused.", await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }
  /**
   * Ingest discovered media items from content script
   */
  async handleMediaDiscovered(e) {
    if (this.job.mediaStatus === "running")
      try {
        const s = e.map(
          (a) => xt(a, this.job.businessId, this.job.sourceUrl)
        ), i = await ts(this.job.businessId, s);
        i.saved > 0 && (this.emptyMediaScrolls = 0, this.consecutiveMediaFailures = 0), this.job.mediaProgress.photosExtracted += i.saved, this.job.mediaProgress.photosFound = Math.max(
          this.job.mediaProgress.photosFound,
          this.job.mediaProgress.photosExtracted,
          e.length
        ), this.job.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
        const n = this.job.settingsSnapshot.maxPhotos;
        n > 0 && this.job.mediaProgress.photosExtracted >= n && await this.handleMediaExhausted();
      } catch (s) {
        this.consecutiveMediaFailures++, this.consecutiveMediaFailures >= 3 && (await this.pause("media"), this.job.pauseReason = "error_threshold", this.job.error_message = `Media extraction paused after 3 consecutive failures: ${(s == null ? void 0 : s.message) || s}`, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job }));
      }
  }
  /**
   * Ingest discovered reviews from content script
   */
  async handleReviewsDiscovered(e, s) {
    if (this.job.reviewStatus === "running")
      try {
        s && s > 0 && (this.job.reviewProgress.reviewsAvailable = s, this.job.reviewSummary && (this.job.reviewSummary.reported_review_count = s));
        const i = e.map(
          (l) => as(l, this.job.businessId, this.job.sourceUrl)
        ), n = await ss(this.job.businessId, i);
        n.saved > 0 && (this.emptyReviewScrolls = 0, this.consecutiveReviewFailures = 0), this.job.reviewProgress.reviewsExtracted += n.saved, this.job.reviewProgress.reviewsFound = Math.max(
          this.job.reviewProgress.reviewsFound,
          this.job.reviewProgress.reviewsExtracted,
          e.length
        ), this.job.reviewSummary && (this.job.reviewSummary.reviews_extracted = this.job.reviewProgress.reviewsExtracted, this.job.reviewSummary.reviews_found = this.job.reviewProgress.reviewsFound), this.job.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
        const a = this.job.settingsSnapshot.maxReviews;
        a > 0 && this.job.reviewProgress.reviewsExtracted >= a && await this.handleReviewsExhausted();
      } catch (i) {
        this.consecutiveReviewFailures++, this.consecutiveReviewFailures >= 3 && (await this.pause("review"), this.job.pauseReason = "error_threshold", this.job.error_message = `Review extraction paused after 3 consecutive failures: ${(i == null ? void 0 : i.message) || i}`, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job }));
      }
  }
  /**
   * Mark media feed exhausted (3 consecutive empty scrolls or end of feed)
   */
  async handleMediaExhausted() {
    this.job.mediaStatus = "complete", this.updateOverallStatus(), this.job.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }
  /**
   * Mark reviews feed exhausted (3 consecutive empty scrolls or end of feed)
   */
  async handleReviewsExhausted() {
    this.job.reviewStatus = "complete", this.job.reviewSummary && (this.job.reviewSummary.status = this.job.reviewProgress.reviewsExtracted === 0 ? "empty" : "complete"), this.updateOverallStatus(), this.job.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }
  /**
   * Media Track Execution Loop
   */
  async runMediaTrack() {
    if (!this.isMediaLoopRunning) {
      this.isMediaLoopRunning = !0;
      try {
        try {
          await this.callbacks.sendToContent({ type: "SWITCH_TAB", tab: "Photos" });
        } catch (i) {
          console.warn("[MediaReviewOrchestrator] SWITCH_TAB Photos error:", i);
        }
        await B(1200);
        const e = this.job.settingsSnapshot.minDelaySeconds || 2.5, s = this.job.settingsSnapshot.maxDelaySeconds || e + 1.5;
        for (; this.job.mediaStatus === "running"; ) {
          try {
            await this.callbacks.sendToContent({
              type: "TRIGGER_MEDIA_DISCOVERY",
              jobId: this.job.jobId,
              context: "business_gallery"
            }), this.consecutiveMediaFailures = 0;
          } catch (a) {
            if (console.warn("[MediaReviewOrchestrator] Transient media discovery error:", a), this.consecutiveMediaFailures++, this.consecutiveMediaFailures >= 3) {
              await this.pause("media"), this.job.pauseReason = "error_threshold", this.job.error_message = `Media extraction paused after 3 consecutive failures: ${a instanceof Error ? a.message : a}`, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
              break;
            }
            await B(1500);
            continue;
          }
          const i = Ce(e, s);
          if (await B(i), this.job.mediaStatus !== "running") break;
          let n;
          try {
            n = await this.callbacks.sendToContent({
              type: "TRIGGER_MEDIA_SCROLL",
              jobId: this.job.jobId
            });
          } catch (a) {
            console.warn("[MediaReviewOrchestrator] Transient media scroll error:", a);
          }
          if (n != null && n.scrolled ? this.emptyMediaScrolls = 0 : this.emptyMediaScrolls++, this.emptyMediaScrolls >= 3) {
            await this.handleMediaExhausted();
            break;
          }
          await B(800);
        }
      } catch (e) {
        console.error("[MediaReviewOrchestrator] Error in media track loop:", e);
      } finally {
        this.isMediaLoopRunning = !1;
      }
    }
  }
  /**
   * Review Track Execution Loop
   */
  async runReviewTrack() {
    if (!this.isReviewLoopRunning) {
      this.isReviewLoopRunning = !0;
      try {
        try {
          await this.callbacks.sendToContent({ type: "SWITCH_TAB", tab: "Reviews" });
        } catch (n) {
          console.warn("[MediaReviewOrchestrator] SWITCH_TAB Reviews error:", n);
        }
        await B(1200);
        try {
          await this.callbacks.sendToContent({
            type: "TRIGGER_REVIEWS_SCROLL",
            jobId: this.job.jobId
          });
        } catch (n) {
          console.warn("[MediaReviewOrchestrator] Initial reviews scroll attempt:", n);
        }
        await B(1200);
        const e = this.job.settingsSnapshot.minDelaySeconds || 2.5, s = this.job.settingsSnapshot.maxDelaySeconds || e + 1.5;
        let i = this.job.reviewProgress.reviewsExtracted;
        for (; this.job.reviewStatus === "running"; ) {
          try {
            const l = await this.callbacks.sendToContent({
              type: "TRIGGER_REVIEWS_DISCOVERY",
              jobId: this.job.jobId
            });
            l != null && l.error && console.warn("[MediaReviewOrchestrator] Review discovery reported error:", l.error), this.consecutiveReviewFailures = 0;
          } catch (l) {
            if (console.warn("[MediaReviewOrchestrator] Transient review discovery error:", l), this.consecutiveReviewFailures++, this.consecutiveReviewFailures >= 3) {
              await this.pause("review"), this.job.pauseReason = "error_threshold", this.job.error_message = `Review extraction paused after 3 consecutive failures: ${l instanceof Error ? l.message : l}`, await G(this.job), this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
              break;
            }
            await B(1500);
            continue;
          }
          const n = Ce(e, s);
          if (await B(n), this.job.reviewStatus !== "running") break;
          this.job.reviewProgress.reviewsExtracted > i && (this.emptyReviewScrolls = 0, i = this.job.reviewProgress.reviewsExtracted);
          let a;
          try {
            a = await this.callbacks.sendToContent({
              type: "TRIGGER_REVIEWS_SCROLL",
              jobId: this.job.jobId
            });
          } catch (l) {
            console.warn("[MediaReviewOrchestrator] Transient review scroll error:", l);
          }
          if (a != null && a.scrolled ? this.emptyReviewScrolls = 0 : this.emptyReviewScrolls++, this.emptyReviewScrolls >= 5) {
            await this.handleReviewsExhausted();
            break;
          }
          await B(800);
        }
      } catch (e) {
        console.error("[MediaReviewOrchestrator] Error in review track loop:", e);
      } finally {
        this.isReviewLoopRunning = !1;
      }
    }
  }
  /**
   * Computes derived overall job status based on track statuses
   */
  updateOverallStatus() {
    const e = this.job.mediaStatus, s = this.job.reviewStatus;
    e === "running" || s === "running" ? this.job.status = "running" : e === "paused" || s === "paused" ? this.job.status = "paused" : e === "complete" && s === "complete" ? (this.job.status = "completed", this.job.completedAt = (/* @__PURE__ */ new Date()).toISOString()) : e === "failed" && s === "failed" ? this.job.status = "failed" : this.job.status = "partial";
  }
}
const rs = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "threads.net",
  "wa.me",
  "whatsapp.com",
  "snapchat.com",
  "telegram.me",
  "t.me"
], os = [
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "linkin.bio",
  "campsite.bio"
];
function ot(t) {
  try {
    const e = t.trim();
    if (!e) return "";
    const s = new URL(e);
    if (s.hostname.includes("google.") && s.pathname.includes("/url")) {
      const i = s.searchParams.get("q") || s.searchParams.get("url");
      if (i) return i.trim();
    }
    return e;
  } catch {
    return t.trim();
  }
}
function ls(t) {
  const e = t.replace(/^www\./, "").toLowerCase();
  return [...rs, ...os].some(
    (i) => e === i || e.endsWith("." + i)
  );
}
function cs(t, e) {
  const s = /* @__PURE__ */ new Set(), i = [];
  if (e && Array.isArray(e))
    for (const a of e) {
      const l = ot(a);
      l && s.add(l);
    }
  const n = t ? ot(t) : "";
  if (!n)
    return s.size > 0 ? {
      website: "",
      website_status: "social_only",
      social_links: Array.from(s)
    } : {
      website: "",
      website_status: "none",
      social_links: []
    };
  try {
    const a = new URL(n);
    return ["http:", "https:"].includes(a.protocol) ? ls(a.hostname) ? (s.add(n), {
      website: "",
      website_status: "social_only",
      social_links: Array.from(s)
    }) : {
      website: n,
      website_status: "website",
      social_links: Array.from(s)
    } : (i.push("website_invalid_protocol"), {
      website: "",
      website_status: s.size > 0 ? "social_only" : "none",
      social_links: Array.from(s),
      error_fields: i
    });
  } catch {
    return i.push("website_malformed_url"), {
      website: "",
      website_status: s.size > 0 ? "social_only" : "none",
      social_links: Array.from(s),
      error_fields: i
    };
  }
}
function us(t) {
  return t ? t.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim() : "";
}
function ds(t) {
  if (!t) return "";
  const e = {
    st: "street",
    rd: "road",
    ave: "avenue",
    blvd: "boulevard",
    ln: "lane",
    dr: "drive",
    apt: "apartment",
    fl: "floor",
    ct: "court",
    sq: "square",
    hwy: "highway"
  };
  let s = t.normalize("NFKC").toLowerCase().replace(/[.,#]/g, " ");
  return s = s.replace(/\b(\w+)\b/g, (i) => e[i] ?? i), s.replace(/\s+/g, " ").trim();
}
function hs(t, e = 8) {
  const s = t.replace(/\D/g, "");
  return s.length < e ? "" : s.slice(-10);
}
function lt(t) {
  if (!t) return "";
  try {
    const e = t.trim(), s = /^https?:\/\//i.test(e) ? e : `https://${e}`, i = new URL(s);
    i.hostname = i.hostname.replace(/^www\./, "").toLowerCase(), i.search = "", i.hash = "";
    const n = i.pathname.replace(/\/+$/, "");
    return `${i.hostname}${n}`.toLowerCase();
  } catch {
    return t.trim().toLowerCase();
  }
}
function ce(t) {
  var h;
  const e = ((h = t.place_identifier) == null ? void 0 : h.trim()) || null;
  let s = null;
  if (t.website_status === "website" && t.website) {
    const p = lt(t.website);
    !["google.com", "maps.google.com", "goo.gl", "bit.ly", "tinyurl.com"].some(
      (b) => p === b || p.startsWith(`${b}/`)
    ) && p.length > 3 && (s = p);
  }
  let i = null;
  if (t.maps_url) {
    const p = t.maps_url.trim().toLowerCase(), f = p.includes("/maps/search/") || p.includes("/search?") || p.endsWith("/maps") || p.endsWith("/maps/"), m = p.includes("/maps/place/") || p.includes("maps.app.goo.gl") || p.includes("goo.gl/maps");
    !f && m && (i = lt(t.maps_url));
  }
  const n = t.business_name ? us(t.business_name) : "", l = !n || n.length < 2 || n === "results" || n === "search results" || n.startsWith("results for") || n === "local business" || n === "google maps" ? "" : n, o = t.address ? ds(t.address) : "", r = o.length >= 5 ? o : "", c = t.phone ? hs(t.phone, 8) : "", u = l && r ? `${l}|${r}` : null, d = l && c ? `${l}|${c}` : null;
  return {
    placeIdentifier: e,
    normalizedWebsite: s,
    normalizedMapsUrl: i,
    nameAddressKey: u,
    namePhoneKey: d
  };
}
function de(t, e) {
  const s = ce(t), i = ce(e);
  return s.placeIdentifier && i.placeIdentifier ? s.placeIdentifier.toLowerCase() === i.placeIdentifier.toLowerCase() : s.normalizedMapsUrl && i.normalizedMapsUrl ? s.normalizedMapsUrl === i.normalizedMapsUrl : !!(s.normalizedWebsite && i.normalizedWebsite && s.normalizedWebsite === i.normalizedWebsite || s.nameAddressKey && i.nameAddressKey && s.nameAddressKey === i.nameAddressKey || s.namePhoneKey && i.namePhoneKey && s.namePhoneKey === i.namePhoneKey);
}
const ps = [
  "phone",
  "website",
  "rating",
  "review_count",
  "price_level",
  "opening_hours",
  "description",
  "plus_code",
  "latitude",
  "longitude",
  "service_options",
  "attributes",
  "secondary_categories"
], fs = [
  "business_name",
  "primary_category",
  "address",
  "maps_url",
  "source_platform"
];
function Je(t, e = []) {
  const s = [], i = [...t.error_fields || [], ...e];
  for (const n of fs) {
    const a = t[n];
    (a == null || a === "") && (i.includes(n) || i.push(n));
  }
  for (const n of ps) {
    if (i.includes(n))
      continue;
    const a = t[n];
    (a == null || typeof a == "string" && a.trim() === "" || Array.isArray(a) && a.length === 0) && s.push(n);
  }
  return {
    missing_fields: s,
    error_fields: Array.from(new Set(i))
  };
}
const q = [
  { iso: "IN", callingCode: "+91", name: "India", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "US", callingCode: "+1", name: "United States", nationalNumberLengths: [10], trunkPrefix: "1" },
  { iso: "CA", callingCode: "+1", name: "Canada", nationalNumberLengths: [10], trunkPrefix: "1" },
  { iso: "GB", callingCode: "+44", name: "United Kingdom", nationalNumberLengths: [9, 10, 11], trunkPrefix: "0" },
  { iso: "AE", callingCode: "+971", name: "United Arab Emirates", nationalNumberLengths: [8, 9], trunkPrefix: "0" },
  { iso: "AU", callingCode: "+61", name: "Australia", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SG", callingCode: "+65", name: "Singapore", nationalNumberLengths: [8] },
  { iso: "MY", callingCode: "+60", name: "Malaysia", nationalNumberLengths: [9, 10], trunkPrefix: "0" },
  { iso: "DE", callingCode: "+49", name: "Germany", nationalNumberLengths: [10, 11], trunkPrefix: "0" },
  { iso: "FR", callingCode: "+33", name: "France", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "IT", callingCode: "+39", name: "Italy", nationalNumberLengths: [9, 10] },
  { iso: "ES", callingCode: "+34", name: "Spain", nationalNumberLengths: [9] },
  { iso: "BR", callingCode: "+55", name: "Brazil", nationalNumberLengths: [10, 11], trunkPrefix: "0" },
  { iso: "ZA", callingCode: "+27", name: "South Africa", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SA", callingCode: "+966", name: "Saudi Arabia", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "EG", callingCode: "+20", name: "Egypt", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "PK", callingCode: "+92", name: "Pakistan", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "BD", callingCode: "+880", name: "Bangladesh", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "LK", callingCode: "+94", name: "Sri Lanka", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "NP", callingCode: "+977", name: "Nepal", nationalNumberLengths: [10] },
  { iso: "NZ", callingCode: "+64", name: "New Zealand", nationalNumberLengths: [8, 9], trunkPrefix: "0" },
  { iso: "ID", callingCode: "+62", name: "Indonesia", nationalNumberLengths: [9, 10, 11], trunkPrefix: "0" },
  { iso: "PH", callingCode: "+63", name: "Philippines", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "TH", callingCode: "+66", name: "Thailand", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "VN", callingCode: "+84", name: "Vietnam", nationalNumberLengths: [9, 10], trunkPrefix: "0" },
  { iso: "JP", callingCode: "+81", name: "Japan", nationalNumberLengths: [10], trunkPrefix: "0" },
  { iso: "CN", callingCode: "+86", name: "China", nationalNumberLengths: [11], trunkPrefix: "0" },
  { iso: "RU", callingCode: "+7", name: "Russia", nationalNumberLengths: [10], trunkPrefix: "8" },
  { iso: "NL", callingCode: "+31", name: "Netherlands", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "CH", callingCode: "+41", name: "Switzerland", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "SE", callingCode: "+46", name: "Sweden", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "NO", callingCode: "+47", name: "Norway", nationalNumberLengths: [8] },
  { iso: "DK", callingCode: "+45", name: "Denmark", nationalNumberLengths: [8] },
  { iso: "IE", callingCode: "+353", name: "Ireland", nationalNumberLengths: [9], trunkPrefix: "0" },
  { iso: "MX", callingCode: "+52", name: "Mexico", nationalNumberLengths: [10] }
];
function ms(t, e) {
  const s = t ? t.trim() : "";
  if (s.startsWith("+") || s.startsWith("00")) {
    const o = s.replace(/^[+0]+/, ""), r = [...q].sort(
      (c, u) => u.callingCode.length - c.callingCode.length
    );
    for (const c of r) {
      const u = c.callingCode.replace("+", "");
      if (o.startsWith(u))
        return { country: c, source: "phone_prefix" };
    }
  }
  if (/^tel:\s*\+/i.test(s)) {
    const o = s.replace(/^tel:\s*\+/i, ""), r = [...q].sort(
      (c, u) => u.callingCode.length - c.callingCode.length
    );
    for (const c of r) {
      const u = c.callingCode.replace("+", "");
      if (o.startsWith(u))
        return { country: c, source: "tel_uri" };
    }
  }
  const i = e != null && e.address ? e.address.toLowerCase() : "";
  if (i) {
    if (/\b(india|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|noida|gurgaon|gurugram|odisha|bhubaneswar|kerala|punjab|gujarat|maharashtra|rajasthan|karnataka|tamil nadu|uttar pradesh)\b/i.test(i) || /\b\d{6}\b/.test(i)) {
      const o = q.find((r) => r.iso === "IN");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(united states|usa|u\.s\.a\.|u\.s\.|california|texas|florida|new york|washington|illinois|georgia|virginia|ohio|alaska|nevada|arizona)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "US");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(united kingdom|uk|u\.k\.|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|liverpool)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "GB");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(united arab emirates|uae|u\.a\.e\.|dubai|abu dhabi|sharjah|ajman|ras al khaimah|fujairah)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "AE");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(australia|sydney|melbourne|brisbane|perth|adelaide)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "AU");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(singapore)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "SG");
      if (o) return { country: o, source: "business_address" };
    }
    if (/\b(canada|toronto|vancouver|montreal|ottawa|calgary)\b/i.test(i)) {
      const o = q.find((r) => r.iso === "CA");
      if (o) return { country: o, source: "business_address" };
    }
  }
  const n = e != null && e.searchContextQuery ? e.searchContextQuery.toLowerCase() : "";
  if (n) {
    if (/\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|noida|gurgaon|gurugram|bhubaneswar|india)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "IN");
      if (o) return { country: o, source: "search_context" };
    }
    if (/\b(dubai|abu dhabi|sharjah|uae)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "AE");
      if (o) return { country: o, source: "search_context" };
    }
    if (/\b(london|manchester|birmingham|uk|england)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "GB");
      if (o) return { country: o, source: "search_context" };
    }
    if (/\b(new york|los angeles|chicago|houston|miami|usa|california|texas)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "US");
      if (o) return { country: o, source: "search_context" };
    }
    if (/\b(sydney|melbourne|brisbane|australia)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "AU");
      if (o) return { country: o, source: "search_context" };
    }
    if (/\b(singapore)\b/i.test(n)) {
      const o = q.find((r) => r.iso === "SG");
      if (o) return { country: o, source: "search_context" };
    }
  }
  const a = (e == null ? void 0 : e.defaultCountry) || "IN", l = q.find((o) => o.iso.toUpperCase() === a.toUpperCase());
  return l ? { country: l, source: "default" } : { country: null, source: "unknown" };
}
function ke(t) {
  if (!t || !t.startsWith("+"))
    return "";
  const e = t.replace(/\D/g, "");
  return e.length < 8 ? "" : `https://wa.me/${e}`;
}
function gs(t, e) {
  const s = {
    phone_raw: t ? t.trim() : "",
    phone_normalized: "",
    phone_country: "",
    phone_country_calling_code: "",
    phone_country_source: "unknown",
    phone_status: "unknown",
    whatsapp_link: ""
  };
  if (!t || !t.trim())
    return s.phone_status = "unknown", s;
  const i = t.trim();
  s.phone_raw = i;
  const n = i.replace(/\D/g, "");
  if (n.length < 6 || n.length > 16)
    return s.phone_status = "invalid", s;
  const { country: a, source: l } = ms(i, e);
  a && (s.phone_country = a.iso, s.phone_country_calling_code = a.callingCode, s.phone_country_source = l);
  const o = a ? a.callingCode.replace("+", "") : "";
  let r = "", c = a ? a.callingCode : "";
  if (i.startsWith("+") || i.startsWith("00")) {
    const u = i.startsWith("+") ? i.slice(1).replace(/\D/g, "") : i.replace(/^00/, "").replace(/\D/g, "");
    if (o && u.startsWith(o)) {
      let d = u.slice(o.length);
      a != null && a.trunkPrefix && d.startsWith(a.trunkPrefix) && (d = d.slice(a.trunkPrefix.length)), r = d;
    } else {
      const d = [...q].sort(
        (p, f) => f.callingCode.length - p.callingCode.length
      );
      let h = null;
      for (const p of d) {
        const f = p.callingCode.replace("+", "");
        if (u.startsWith(f)) {
          h = p, c = p.callingCode, s.phone_country = p.iso, s.phone_country_calling_code = p.callingCode, s.phone_country_source = "phone_prefix";
          let m = u.slice(f.length);
          p.trunkPrefix && m.startsWith(p.trunkPrefix) && (m = m.slice(p.trunkPrefix.length)), r = m;
          break;
        }
      }
      h || (r = u, c = "+");
    }
  } else if (a)
    if (o && n.startsWith(o) && n.length === o.length + 10)
      r = n.slice(o.length);
    else if (a.trunkPrefix && n.startsWith(a.trunkPrefix)) {
      const u = n.slice(a.trunkPrefix.length);
      a.nationalNumberLengths.includes(u.length) ? r = u : r = n;
    } else
      r = n;
  else
    r = n;
  return a ? a.nationalNumberLengths.includes(r.length) ? (s.phone_status = "valid", s.phone_normalized = `${c}${r}`, s.whatsapp_link = ke(s.phone_normalized)) : r.length >= 7 && r.length <= 12 ? (s.phone_status = "partial", s.phone_normalized = `${c}${r}`, s.whatsapp_link = ke(s.phone_normalized)) : s.phone_status = "invalid" : r.length >= 8 && r.length <= 15 ? (s.phone_status = "partial", s.phone_normalized = `+${r}`, s.whatsapp_link = ke(s.phone_normalized)) : s.phone_status = "invalid", s;
}
function se(t) {
  var n, a, l;
  if (!t) return null;
  const e = [
    "h1.DUwDvf",
    'h1[class*="DUwDvf"]',
    'h1[class*="lfPIob"]',
    'h1[class*="fontHeadlineLarge"]',
    'h1[class*="fontDisplayLarge"]',
    'h1[class*="fontHeadline"]'
  ];
  for (const o of e) {
    const r = t.querySelector(o);
    if (!r) continue;
    let c = r.parentElement, u = null;
    for (; c && c !== t.body && c !== t.documentElement && !c.querySelector('div[role="feed"]'); ) {
      if (u = c, (n = c.classList) != null && n.contains("bJzME") || (a = c.classList) != null && a.contains("TI60gf") || c.getAttribute("role") === "region")
        return c;
      c = c.parentElement;
    }
    if (u) return u;
  }
  const s = t.querySelectorAll("h1");
  for (const o of Array.from(s)) {
    if (C(o)) continue;
    const r = ((l = o.textContent) == null ? void 0 : l.trim().toLowerCase()) || "";
    if (!(!r || r === "results" || r.startsWith("results for") || r === "google maps" || r === "search results")) {
      let u = o.parentElement;
      for (; u && u !== t.body && !u.querySelector('div[role="feed"]'); ) {
        if (u.getAttribute("role") === "region" || u.getAttribute("role") === "main")
          return u;
        u = u.parentElement;
      }
      if (o.parentElement && !o.parentElement.querySelector('div[role="feed"]'))
        return o.parentElement;
    }
  }
  const i = t.querySelectorAll('div[role="main"]');
  for (const o of Array.from(i))
    if (!o.querySelector('div[role="feed"]'))
      return o;
  return null;
}
function C(t) {
  return t ? !!t.closest('div[role="feed"]') : !0;
}
function he(t) {
  if (!t) return null;
  let e = t.trim();
  return e = e.replace(/^Address:\s*/i, ""), e = e.replace(/^[^\w\d\s#.,\-/]+/, "").trim(), e.length > 3 ? e : null;
}
const ct = [
  // Strategy 0: button with data-item-id containing address (check aria-label first)
  (t) => {
    const e = t.querySelector('button[data-item-id*="address"]');
    if (!e || C(e)) return null;
    const s = e.getAttribute("aria-label");
    if (s) {
      const i = he(s);
      if (i) return i;
    }
    return he(e.textContent);
  },
  // Strategy 1: aria-label containing Address
  (t) => {
    const e = t.querySelector('button[aria-label*="Address:" i]');
    return !e || C(e) ? null : he(e.getAttribute("aria-label") || e.textContent);
  },
  // Strategy 2: element with address tooltip
  (t) => {
    const e = t.querySelector('[data-tooltip*="address" i]');
    return !e || C(e) ? null : he(e.getAttribute("data-tooltip") || e.textContent);
  },
  // Strategy 3: any div with aria-label matching address
  (t) => {
    const e = t.querySelector('div[aria-label*="Address:" i]');
    return !e || C(e) ? null : he(e.getAttribute("aria-label") || e.textContent);
  },
  // Strategy 4: button with copy address tooltip
  (t) => {
    const e = t.querySelector('button[data-tooltip*="Copy address" i]');
    return !e || C(e) ? null : he(e == null ? void 0 : e.textContent);
  }
];
function ut(t) {
  const e = se(t);
  if (!e) return { value: null, strategyUsed: -1 };
  for (let s = 0; s < ct.length; s++) {
    const i = ct[s](e);
    if (i && i.length > 0)
      return { value: i, strategyUsed: s };
  }
  return { value: null, strategyUsed: -1 };
}
function bs(t) {
  var u;
  let e = "operational";
  const s = [], i = [];
  let n = null;
  const l = se(t) || t.querySelector('div[role="main"]') || t.body, o = (l == null ? void 0 : l.textContent) || "";
  /permanently closed/i.test(o) || l.querySelector('[aria-label*="Permanently closed" i]') ? e = "closed_permanently" : (/temporarily closed/i.test(o) || l.querySelector('[aria-label*="Temporarily closed" i]')) && (e = "closed_temporarily");
  const r = l.querySelector('div[class*="fontBodyMedium"] [aria-hidden="true"]') || l.querySelector('div[class*="editorial"]') || l.querySelector('[data-attrid="description"]');
  if (r && !C(r) && r.textContent) {
    const d = r.textContent.trim();
    d.length > 20 && !d.includes("★") && (n = d);
  }
  const c = l.querySelectorAll('div[aria-label*="Service options" i] span, div[class*="fontBodyMedium"] span');
  for (const d of Array.from(c)) {
    if (C(d)) continue;
    const h = (u = d.textContent) == null ? void 0 : u.trim();
    h && h.length > 3 && h.length < 40 && (/dine-in|takeout|delivery|curbside|online|appointment/i.test(h) ? s.includes(h) || s.push(h) : /wheelchair|wi-fi|restroom|parking|credit card/i.test(h) && (i.includes(h) || i.push(h)));
  }
  return { businessStatus: e, serviceOptions: s, attributes: i, description: n };
}
function _s(t) {
  var o, r, c;
  const e = [], s = se(t), i = s || t, n = i.querySelectorAll('button[jsaction*="category" i]');
  for (const u of Array.from(n)) {
    if (C(u)) continue;
    const d = (o = u.textContent) == null ? void 0 : o.trim();
    d && !e.includes(d) && e.push(d);
  }
  if (e.length === 0) {
    const u = i.querySelectorAll('button[class*="DkEaL"]');
    for (const d of Array.from(u)) {
      if (C(d)) continue;
      const h = (r = d.textContent) == null ? void 0 : r.trim();
      h && !e.includes(h) && e.push(h);
    }
  }
  if (e.length === 0 && s) {
    const u = s.querySelector("h1");
    if (u != null && u.parentElement) {
      const d = u.parentElement.querySelectorAll("span, button");
      for (const h of Array.from(d)) {
        if (C(h)) continue;
        const p = ((c = h.textContent) == null ? void 0 : c.trim()) || "";
        if (p && p.length > 2 && p.length < 50 && !/^\d/.test(p) && !p.includes("★")) {
          e.push(p);
          break;
        }
      }
    }
  }
  const a = e[0] || null, l = e.slice(1);
  return { primaryCategory: a, secondaryCategories: l };
}
const ws = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];
function ys(t) {
  var a, l;
  const e = [], i = se(t) || t, n = i.querySelectorAll("table tr");
  for (const o of Array.from(n)) {
    if (C(o)) continue;
    const r = o.querySelectorAll("td, th");
    if (r.length >= 2) {
      const c = ((a = r[0].textContent) == null ? void 0 : a.trim()) || "", u = ((l = r[1].textContent) == null ? void 0 : l.trim()) || "";
      ws.some((d) => c.toLowerCase().includes(d.toLowerCase())) && u && e.push({ day: c, hours: u });
    }
  }
  if (e.length === 0) {
    const o = i.querySelector('[aria-label*="hours" i]');
    if (o && !C(o)) {
      const r = o.getAttribute("aria-label") || "";
      r && !r.includes("hours") && e.push({ day: "Current", hours: r });
    }
  }
  return e.length > 0 ? e : null;
}
function Ss(t) {
  var o;
  if (!t) return !1;
  const e = t.querySelector(
    'h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], h1[class*="fontHeadlineLarge"]'
  ), s = ((o = e == null ? void 0 : e.textContent) == null ? void 0 : o.trim()) || "", i = !s || s.toLowerCase() === "results" || s.toLowerCase().startsWith("results for") || s.toLowerCase() === "google maps" || s.toLowerCase() === "search results" || s.toLowerCase() === "all filters";
  if (e && !i)
    return !0;
  const n = !!t.querySelector(
    'button[data-item-id*="address"], button[data-item-id*="phone"], button[data-item-id*="authority"], a[data-item-id="authority"], button[aria-label*="Address:" i], button[aria-label*="Phone:" i]'
  ), a = t.querySelector('div[role="main"], div.TI60gf, div.bJzME'), l = !!(a != null && a.querySelector('button[data-item-id], button[aria-label], div[class*="fontBodyMedium"]'));
  return n || !!e && l;
}
function vs(t, e, s) {
  var i;
  if (!e.includes("google.com/maps") && !e.includes("maps.google.com"))
    return !0;
  if (s.query) {
    const n = s.query.toLowerCase(), a = e.toLowerCase().includes(encodeURIComponent(s.query).toLowerCase()) || e.toLowerCase().includes(s.query.replace(/\s+/g, "+").toLowerCase()), l = t.querySelector("input#searchboxinput") || t.querySelector('input[id*="searchbox" i]'), o = ((i = l == null ? void 0 : l.value) == null ? void 0 : i.toLowerCase()) || "";
    if (!a && o && !o.includes(n))
      return !0;
  }
  return !1;
}
function Le(t) {
  const e = t.getBoundingClientRect(), s = e.left > 0 || e.top > 0 ? Math.round(e.left + Math.max(10, e.width / 2)) : 250, i = e.left > 0 || e.top > 0 ? Math.round(e.top + Math.max(10, e.height / 2)) : 250, n = {
    bubbles: !0,
    cancelable: !0,
    composed: !0,
    view: typeof window < "u" ? window : void 0,
    button: 0,
    buttons: 1,
    clientX: s,
    clientY: i,
    screenX: s,
    screenY: i,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: !0
  }, a = {
    ...n,
    buttons: 0
  };
  try {
    t.focus();
  } catch {
  }
  try {
    typeof PointerEvent < "u" && t.dispatchEvent(new PointerEvent("pointerdown", n)), t.dispatchEvent(new MouseEvent("mousedown", n)), typeof PointerEvent < "u" && t.dispatchEvent(new PointerEvent("pointerup", a)), t.dispatchEvent(new MouseEvent("mouseup", a)), t.dispatchEvent(new MouseEvent("click", a));
  } catch {
  }
  try {
    t.click();
  } catch {
  }
}
function dt(t) {
  const e = t.querySelector('div[role="feed"]');
  if (e) {
    let i = e;
    for (; i && i !== t.body; ) {
      if (i.scrollHeight > i.clientHeight && i.clientHeight > 80)
        return i;
      i = i.parentElement;
    }
    return e;
  }
  const s = t.querySelectorAll(
    'div.m6QErb.DxyBCb, div.m6QErb[aria-label*="Results" i], div[aria-label*="Results for" i], div.TI60gf, div.m6QErb'
  );
  for (const i of Array.from(s))
    if (i.scrollHeight > i.clientHeight && i.clientHeight > 80)
      return i;
  return null;
}
async function Is(t) {
  var l, o, r;
  const e = document.querySelector('div[role="main"], div.TI60gf'), s = ((o = (l = e == null ? void 0 : e.querySelector("h1")) == null ? void 0 : l.textContent) == null ? void 0 : o.trim()) || "", i = K(((r = window.location) == null ? void 0 : r.href) || ""), n = K(t.cardRef);
  if (n && i && n === i || s && t.name && s.toLowerCase() === t.name.toLowerCase())
    return;
  let a = Re(t, document);
  if (!a) {
    const c = document.querySelector('div[role="feed"]');
    c && c.offsetParent !== null && c.clientHeight > 50 || (await Qe(), await new Promise((d) => setTimeout(d, 300)), a = Re(t, document));
  }
  if (!a)
    for (let c = 0; c < 6 && (await Dt(document), await new Promise((u) => setTimeout(u, 200)), a = Re(t, document), !a); c++)
      ;
  if (a) {
    const c = a.closest('div.Nv2PK, div[role="article"]') || a, u = c.querySelector(
      'div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb, div.fontTitleMedium'
    ), d = a.tagName.toLowerCase() === "a" ? a : c.querySelector("a.hfpxzc, a[href*='/maps/place/'], a") || a;
    try {
      (u || d || c).scrollIntoView({ behavior: "instant", block: "center" });
    } catch {
    }
    await new Promise((h) => setTimeout(h, 50)), u && Le(u), d && d !== u && Le(d), c && c !== u && c !== d && Le(c);
    return;
  }
  console.debug(`[Navigation] Card element not in visible DOM for "${t.name}"`);
}
function Re(t, e = document) {
  const s = e.querySelector('div[role="feed"]') || e.querySelector("div.m6QErb.DxyBCb") || e.querySelector('div.m6QErb[aria-label*="Results" i]') || e, i = K(t.cardRef), a = (t.name || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, "");
  if (i) {
    const o = s.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"], a[href*="data="]');
    for (const r of Array.from(o))
      if (((r.getAttribute("href") || "") + " " + (r.href || "")).includes(i))
        return r;
  }
  const l = s.querySelectorAll('div.Nv2PK, div[role="article"]');
  for (const o of Array.from(l)) {
    const r = o.querySelector('a.hfpxzc, a[href*="/maps/place/"], a'), c = ((r == null ? void 0 : r.getAttribute("href")) || "") + " " + ((r == null ? void 0 : r.href) || "");
    if (i && c.includes(i))
      return r || o;
    const u = o.querySelector('div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb'), h = ((u == null ? void 0 : u.textContent) || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, ""), f = ((r == null ? void 0 : r.getAttribute("aria-label")) || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, "");
    if (a && (h === a || f === a || a.length >= 4 && (h.includes(a) || a.includes(h) || f.includes(a) || a.includes(f))))
      return r || o;
  }
  if (a) {
    const o = s.querySelectorAll("a.hfpxzc, a[aria-label]");
    for (const r of Array.from(o)) {
      const u = (r.getAttribute("aria-label") || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, "");
      if (u === a || a.length >= 4 && (u.includes(a) || a.includes(u)))
        return r;
    }
  }
  return null;
}
async function Qe() {
  const t = document.querySelector('button[aria-label*="Back to results" i]') || document.querySelector('button[jsaction*="pane.back" i]') || document.querySelector('button[data-tooltip*="Back to results" i]') || document.querySelector('button[data-tooltip*="Back" i]') || document.querySelector('button[aria-label="Back" i]') || document.querySelector('button[aria-label="Close" i]') || document.querySelector('button[jsaction*="pane.close" i]') || document.querySelector("button.w9kYg");
  t && !te(t) && !t.closest("#searchbox, form") && (t.click(), await new Promise((e) => setTimeout(e, 200)));
}
function Es(t) {
  var i;
  const e = t.querySelector(
    'div.HlvSq, span.HlvSq, p[class*="fontBodyMedium"][class*="HlvSq"], div[class*="fontBodyMedium"][class*="HlvSq"]'
  );
  if (e) {
    const n = ((i = e.textContent) == null ? void 0 : i.toLowerCase().trim()) || "";
    if (n.includes("end of the list") || n.includes("end of results") || n.includes("no more results"))
      return !0;
  }
  const s = t.querySelector('div[role="feed"]');
  if (s) {
    const n = s.textContent || "";
    if (n.includes("You've reached the end of the list") || n.includes("You have reached the end of the list"))
      return !0;
  }
  return !1;
}
async function Dt(t) {
  let e = dt(t);
  const s = t.querySelector('div[role="feed"]');
  if (s && s.offsetParent !== null && s.clientHeight > 50 || (await Qe(), await new Promise((c) => setTimeout(c, 250)), e = dt(t)), !e)
    return typeof window < "u" && window.scrollBy({ top: 1200, behavior: "instant" }), !1;
  const n = e.scrollHeight, a = e.scrollTop, l = (e.parentElement || t).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc').length, o = (s || e).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc');
  if (o.length > 0) {
    const c = o[o.length - 1];
    try {
      c.scrollIntoView({ behavior: "instant", block: "end" });
    } catch {
    }
  }
  e.scrollTop = e.scrollHeight, s && s !== e && (s.scrollTop = s.scrollHeight);
  try {
    const c = new Event("scroll", { bubbles: !0 });
    if (e.dispatchEvent(c), s && s !== e && s.dispatchEvent(c), typeof WheelEvent < "u") {
      const u = new WheelEvent("wheel", { bubbles: !0, deltaY: 1200 });
      e.dispatchEvent(u), s && s !== e && s.dispatchEvent(u);
    }
  } catch {
  }
  let r = !1;
  for (let c = 0; c < 8; c++) {
    await new Promise((p) => setTimeout(p, 150));
    const u = e.scrollHeight, d = e.scrollTop, h = (e.parentElement || t).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc').length;
    if (u > n || d > a || h > l) {
      r = !0;
      break;
    }
  }
  return r;
}
function te(t) {
  if (!t) return !1;
  if (t.querySelector('input[type="file"]') || t.tagName.toLowerCase() === "input" && t.type === "file")
    return !0;
  const e = (t.getAttribute("aria-label") || "").toLowerCase().trim(), s = (t.textContent || "").toLowerCase().trim(), i = (t.getAttribute("data-tooltip") || "").toLowerCase().trim(), n = (t.getAttribute("title") || "").toLowerCase().trim(), a = (t.getAttribute("jsaction") || "").toLowerCase().trim(), l = `${e} ${s} ${i} ${n} ${a}`, o = [
    "add a photo",
    "add photo",
    "add photos",
    "upload a photo",
    "upload photo",
    "upload photos",
    "upload",
    "post photo",
    "write a review",
    "write review",
    "add a review",
    "add review",
    "rate and review",
    "edit your review",
    "delete review",
    "flag as inappropriate",
    "report review",
    "suggest an edit",
    "add missing place",
    "claim this business",
    "own this business",
    "manage this business"
  ];
  for (const r of o)
    if (l.includes(r))
      return !0;
  return !1;
}
async function As(t, e) {
  var n, a, l, o, r;
  const s = t.querySelectorAll(
    'div[role="tablist"] button[role="tab"], div[role="tablist"] div[role="tab"], button[role="tab"], div.R65duf button, div.Gpq6kf button, button.hh2c'
  ), i = e.toLowerCase();
  for (const c of Array.from(s)) {
    if (c.closest('div[role="feed"]') || te(c)) continue;
    const u = (c.getAttribute("aria-label") || c.textContent || "").toLowerCase().trim();
    let d = !1;
    if (i === "photos" ? d = u === "photos" || u === "photos & videos" || u.startsWith("photos") || u.includes("photos of") || ((n = c.textContent) == null ? void 0 : n.trim().toLowerCase()) === "photos" : i === "reviews" ? d = u === "reviews" || u.startsWith("reviews") || u.includes("customer reviews") || u.includes("reviews for") || ((a = c.textContent) == null ? void 0 : a.trim().toLowerCase()) === "reviews" : i === "overview" ? d = u === "overview" || ((l = c.textContent) == null ? void 0 : l.trim().toLowerCase()) === "overview" : i === "about" && (d = u === "about" || ((o = c.textContent) == null ? void 0 : o.trim().toLowerCase()) === "about"), d) {
      if (!(c.getAttribute("aria-selected") === "true")) {
        try {
          (r = c.scrollIntoView) == null || r.call(c, { behavior: "instant", block: "center" });
        } catch {
        }
        c.click();
      }
      if (i === "reviews") {
        const p = Date.now();
        for (; Date.now() - p < 1200 && !t.querySelector('div.jftiEf, div[data-review-id], div.m6QErb[aria-label*="Reviews" i]'); )
          await new Promise((f) => setTimeout(f, 80));
      } else
        await new Promise((p) => setTimeout(p, 600));
      return !0;
    }
  }
  if (e === "Photos") {
    const c = t.querySelector(
      'button[jsaction*="heroHeader"], div[class*="hero"] img, button[aria-label*="Photo of" i]'
    );
    if (c && !c.closest('div[role="feed"]') && !te(c))
      return c.click(), await new Promise((u) => setTimeout(u, 600)), !0;
  }
  if (e === "Reviews") {
    const c = t.querySelector(
      'button[jsaction*="moreReviews" i], button[jsaction*="pane.rating" i], div.F7nice button, div.jANrlb button, button[aria-label*="stars" i][aria-label*="reviews" i]'
    );
    if (c && !c.closest('div[role="feed"]') && !te(c)) {
      c.click();
      const u = Date.now();
      for (; Date.now() - u < 1200 && !t.querySelector('div.jftiEf, div[data-review-id], div.m6QErb[aria-label*="Reviews" i]'); )
        await new Promise((d) => setTimeout(d, 80));
      return !0;
    }
  }
  return !1;
}
function $e(t) {
  var a;
  let e = "", s = "";
  const i = t.tagName.toLowerCase() === "img" ? t : t.querySelector("img");
  if (i && (e = i.src || i.getAttribute("data-src") || "", s = i.src || ""), !e) {
    const l = t.querySelector('[style*="background-image"]') || ((a = t.getAttribute("style")) != null && a.includes("background-image") ? t : null);
    if (l) {
      const r = (l.getAttribute("style") || "").match(/url\(["']?([^"']+)["']?\)/i);
      r && (e = r[1], s = r[1]);
    }
  }
  if (!e) return { mediaUrl: "", thumbnailUrl: "" };
  let n = e;
  return (e.includes("googleusercontent.com") || e.includes("ggpht.com")) && (/=w\d+-h\d+/.test(e) ? n = e.replace(/=w\d+-h\d+.*$/, "=w1920-h1080-k-no") : /=s\d+/.test(e) ? n = e.replace(/=s\d+.*$/, "=s1920") : /=w\d+/.test(e) ? n = e.replace(/=w\d+.*$/, "=w1920-k-no") : n = At(e)), { mediaUrl: n, thumbnailUrl: s };
}
function Cs(t) {
  let e = !1, s = null;
  t.querySelector('video, [aria-label*="play" i], [class*="play" i]') && (e = !0);
  const n = (t.textContent || "").match(/\b(\d+):(\d{2})\b/);
  if (n) {
    e = !0;
    const a = parseInt(n[1], 10), l = parseInt(n[2], 10);
    s = a * 60 + l;
  }
  return { isVideo: e, duration: s };
}
function Ts(t, e = "business_gallery") {
  const s = [], i = /* @__PURE__ */ new Set(), n = [
    "button[data-photo-index]",
    "a[data-photo-index]",
    "div[data-photo-index]",
    "div.U39Pmb",
    "div.m6QErb div.ofKBgf",
    'div[jsaction*="photo"]',
    'button[jsaction*="photo"]',
    'div[role="img"][aria-label]',
    'div[role="button"][aria-label*="photo" i]',
    'div[role="button"][aria-label*="video" i]',
    'button[aria-label*="photo" i]',
    'button[aria-label*="video" i]',
    'img[src*="googleusercontent.com"]',
    'img[src*="ggpht.com"]',
    'div[style*="background-image"]'
  ], l = (t.querySelector('div[role="region"][aria-label*="photo" i]') || t.querySelector('div[role="region"][aria-label*="media" i]') || t.querySelector('div.m6QErb[aria-label*="photo" i]') || t).querySelectorAll(n.join(", "));
  for (const o of Array.from(l)) {
    if (C(o) || te(o)) continue;
    const { mediaUrl: r, thumbnailUrl: c } = $e(o);
    if (!r || i.has(r)) continue;
    i.add(r);
    const { isVideo: u, duration: d } = Cs(o), h = o.querySelector("[aria-label], img[alt]"), p = o.getAttribute("aria-label") || o.getAttribute("alt") || (h == null ? void 0 : h.getAttribute("aria-label")) || (h == null ? void 0 : h.getAttribute("alt")) || "", f = o.getAttribute("data-photo-index") || null;
    s.push({
      sourceMediaId: f,
      type: u ? "video" : "photo",
      sourceUrl: window.location.href,
      mediaUrl: r,
      embedUrl: "",
      thumbnailUrl: c,
      title: p.trim(),
      caption: p.trim(),
      width: null,
      height: null,
      duration: d,
      sourceContext: e
    });
  }
  if (s.length === 0) {
    const o = t.querySelector(
      'button[jsaction*="heroHeader"] img, div[class*="hero"] img'
    );
    if (o && !C(o) && !te(o.parentElement)) {
      const { mediaUrl: r, thumbnailUrl: c } = $e(o);
      r && s.push({
        sourceMediaId: null,
        type: "photo",
        sourceUrl: window.location.href,
        mediaUrl: r,
        embedUrl: "",
        thumbnailUrl: c,
        title: "Profile Cover Photo",
        caption: "Cover photo",
        width: null,
        height: null,
        duration: null,
        sourceContext: "business_profile"
      });
    }
  }
  return s;
}
async function xs(t) {
  const e = t.querySelector('div[role="region"][aria-label*="photo" i] div.m6QErb') || t.querySelector('div.m6QErb[aria-label*="photo" i]') || t.querySelector('div[tabindex="-1"].m6QErb');
  if (e) {
    const s = e.scrollHeight, i = e.scrollTop;
    return e.scrollBy({ top: 1e3, behavior: "smooth" }), await new Promise((n) => setTimeout(n, 800)), e.scrollHeight > s || e.scrollTop > i;
  }
  return window.scrollBy({ top: 800, behavior: "smooth" }), await new Promise((s) => setTimeout(s, 600)), !0;
}
function X(t) {
  if (!t) return !0;
  const e = t.trim().toLowerCase();
  return e === "" || e === "results" || e === "search results" || e.startsWith("results for") || e === "google maps" || e === "all filters" || e === "overview" || e === "reviews" || e === "about" || e === "photos";
}
const ht = [
  // Strategy 0: standard Google Maps detail panel heading classes
  (t) => {
    var l, o, r;
    const e = t.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], div.DUwDvf, h2.DUwDvf');
    if (!e) return null;
    const s = e.querySelector("span"), i = (l = s == null ? void 0 : s.textContent) == null ? void 0 : l.trim();
    if (i && !X(i))
      return i;
    const a = (((o = e.textContent) == null ? void 0 : o.split(`
`).map((c) => c.trim()).filter(Boolean)) || [])[0] || ((r = e.textContent) == null ? void 0 : r.trim());
    return X(a) ? null : a;
  },
  // Strategy 1: fontHeadlineLarge heading if not 'Results'
  (t) => {
    var n, a;
    const e = t.querySelector('h1[class*="fontHeadlineLarge"], div[class*="fontHeadlineLarge"]');
    if (!e) return null;
    const i = (((n = e.textContent) == null ? void 0 : n.split(`
`).map((l) => l.trim()).filter(Boolean)) || [])[0] || ((a = e.textContent) == null ? void 0 : a.trim());
    return X(i) ? null : i;
  },
  // Strategy 2: any heading in the main/detail region that is a valid business name
  (t) => {
    var s;
    const e = t.querySelectorAll('div[role="main"] h1, div[role="region"] h1, div.TI60gf h1, h1');
    for (const i of Array.from(e)) {
      const n = (s = i.textContent) == null ? void 0 : s.trim();
      if (!X(n))
        return n;
    }
    return null;
  },
  // Strategy 3: standard Google search title attribute
  (t) => {
    var s, i;
    const e = (i = (s = t.querySelector('[data-attrid="title"]')) == null ? void 0 : s.textContent) == null ? void 0 : i.trim();
    return X(e) ? null : e;
  },
  // Strategy 4: aria-label of detail container if not results
  (t) => {
    var s;
    const e = t.querySelectorAll('div[role="main"][aria-label], div.TI60gf[aria-label]');
    for (const i of Array.from(e)) {
      const n = (s = i.getAttribute("aria-label")) == null ? void 0 : s.trim();
      if (!X(n))
        return n;
    }
    return null;
  },
  // Strategy 5: Parse business name from location.href if it is a place URL
  (t) => {
    var e;
    try {
      if (typeof window < "u" && ((e = window.location) != null && e.href)) {
        const i = window.location.href.match(/\/maps\/place\/([^/@?]+)/);
        if (i) {
          const n = decodeURIComponent(i[1].replace(/\+/g, " ")).trim();
          if (!X(n))
            return n;
        }
      }
    } catch {
    }
    return null;
  }
];
function pt(t) {
  for (let e = 0; e < ht.length; e++) {
    const s = ht[e](t);
    if (s && !X(s))
      return { value: s, strategyUsed: e };
  }
  return { value: null, strategyUsed: -1 };
}
function ne(t) {
  if (!t) return null;
  let e = t.trim();
  return e = e.replace(/^Phone:\s*/i, "").replace(/^tel:\s*/i, ""), e = e.replace(/^[^\d+]+/, ""), e = e.replace(/[^\d]+$/, ""), e.length >= 6 ? e.trim() : null;
}
const ft = [
  // Strategy 0: button with data-item-id containing phone
  (t) => {
    const e = t.querySelector('button[data-item-id*="phone"]');
    if (!e || C(e)) return null;
    const s = e.getAttribute("aria-label");
    if (s) {
      const a = ne(s);
      if (a) return a;
    }
    const n = (e.getAttribute("data-item-id") || "").match(/phone:tel:(.+)/);
    if (n) {
      const a = ne(n[1]);
      if (a) return a;
    }
    return ne(e.textContent);
  },
  // Strategy 1: button with aria-label containing Phone
  (t) => {
    const e = t.querySelector('button[aria-label*="Phone:" i]');
    return !e || C(e) ? null : ne(e.getAttribute("aria-label") || e.textContent);
  },
  // Strategy 2: anchor with tel: href
  (t) => {
    const e = t.querySelector('a[href^="tel:"]');
    return !e || C(e) ? null : ne(e.getAttribute("href"));
  },
  // Strategy 3: element with data-tooltip containing phone
  (t) => {
    const e = t.querySelector('[data-tooltip*="phone" i]');
    return !e || C(e) ? null : ne(e.getAttribute("data-tooltip") || e.textContent);
  },
  // Strategy 4: regex check on action buttons in detail panel
  (t) => {
    const e = t.querySelectorAll("button");
    for (const s of Array.from(e)) {
      if (C(s)) continue;
      const i = ne(s.textContent);
      if (i && /^(\+?\d[\d\s\-().]{7,}\d)$/.test(i))
        return i;
    }
    return null;
  }
];
function Ds(t) {
  const e = se(t);
  if (!e) return { value: null, strategyUsed: -1 };
  for (let s = 0; s < ft.length; s++) {
    const i = ft[s](e);
    if (i && i.length > 0)
      return { value: i, strategyUsed: s };
  }
  return { value: null, strategyUsed: -1 };
}
function Ns(t) {
  var r, c;
  let e = null, s = null, i = null;
  const n = se(t), a = n || t, l = a.querySelectorAll('[aria-label*="star" i]');
  for (const u of Array.from(l)) {
    if (C(u)) continue;
    const d = u.getAttribute("aria-label") || "", h = d.match(/(\d+\.?\d*)\s*stars?/i);
    if (h) {
      const p = parseFloat(h[1]);
      if (!isNaN(p) && p > 0 && p <= 5) {
        e = p;
        const f = d.match(/(\d[\d,]*)\s*reviews?/i);
        if (f) {
          const m = parseInt(f[1].replace(/,/g, ""), 10);
          isNaN(m) || (s = m);
        }
        break;
      }
    }
  }
  if (e === null && n) {
    const u = n.querySelectorAll(
      'span[class*="fontHeadlineMedium"], div[class*="fontDisplayLarge"], span.ceNzKf, span[aria-hidden="true"]'
    );
    for (const d of Array.from(u)) {
      if (C(d)) continue;
      const p = (((r = d.textContent) == null ? void 0 : r.trim()) || "").match(/^(\d\.\d)$/);
      if (p) {
        const f = parseFloat(p[1]);
        if (!isNaN(f) && f >= 1 && f <= 5) {
          e = f;
          break;
        }
      }
    }
  }
  if (s === null) {
    const u = a.querySelectorAll('[aria-label*="review" i], button[aria-label*="review" i]');
    for (const d of Array.from(u)) {
      if (C(d)) continue;
      const p = (d.getAttribute("aria-label") || d.textContent || "").match(/(\d[\d,]*)\s*reviews?/i);
      if (p) {
        const f = parseInt(p[1].replace(/,/g, ""), 10);
        if (!isNaN(f)) {
          s = f;
          break;
        }
      }
    }
  }
  if (s === null && n) {
    const u = n.querySelectorAll("span, button");
    for (const d of Array.from(u)) {
      if (C(d)) continue;
      const p = (((c = d.textContent) == null ? void 0 : c.trim()) || "").match(/^\((\d[\d,]*)\)$/);
      if (p) {
        const f = parseInt(p[1].replace(/,/g, ""), 10);
        if (!isNaN(f)) {
          s = f;
          break;
        }
      }
    }
  }
  const o = a.querySelectorAll('span[aria-label*="Price" i]');
  for (const u of Array.from(o)) {
    if (C(u)) continue;
    const d = u.textContent || u.getAttribute("aria-label") || "";
    if (d.includes("$$$$") || d.includes("₹₹₹₹") ? i = "$$$$" : d.includes("$$$") || d.includes("₹₹₹") ? i = "$$$" : d.includes("$$") || d.includes("₹₹") ? i = "$$" : (d.includes("$") || d.includes("₹")) && (i = "$"), i) break;
  }
  return { rating: e, reviewCount: s, priceLevel: i };
}
function Ps(t) {
  if (!t) return "";
  const e = /* @__PURE__ */ new Date(), s = t.toLowerCase().trim(), i = s.match(/(\d+)\s*day/);
  if (i)
    return e.setDate(e.getDate() - parseInt(i[1], 10)), e.toISOString();
  const n = s.match(/(\d+)\s*week/);
  if (n)
    return e.setDate(e.getDate() - parseInt(n[1], 10) * 7), e.toISOString();
  const a = s.match(/(\d+)\s*month/);
  if (a)
    return e.setMonth(e.getMonth() - parseInt(a[1], 10)), e.toISOString();
  const l = s.match(/(\d+)\s*year/);
  return l ? (e.setFullYear(e.getFullYear() - parseInt(l[1], 10)), e.toISOString()) : s.includes("yesterday") ? (e.setDate(e.getDate() - 1), e.toISOString()) : "";
}
function ks(t) {
  if (te(t)) return !0;
  const e = (t.getAttribute("aria-label") || "").toLowerCase().trim(), s = (t.getAttribute("jsaction") || "").toLowerCase().trim(), i = (t.getAttribute("aria-haspopup") || "").toLowerCase().trim();
  return !!(i === "menu" || i === "true" || e.includes("action") || e.includes("option") || e.includes("menu") || e.includes("report") || e.includes("share") || e.includes("flag") || e.includes("like") || e.includes("helpful") || s.includes("actionmenu") || s.includes("menu") || s.includes("share") || s.includes("like") || s.includes("helpful"));
}
async function Ls(t, e = 150) {
  var o, r, c;
  const s = Array.from(
    t.querySelectorAll("button, span[role='button']")
  );
  let i = null;
  for (const u of s) {
    if (ks(u)) continue;
    const d = ((o = u.textContent) == null ? void 0 : o.trim().toLowerCase()) || "", h = (u.getAttribute("aria-label") || "").toLowerCase().trim(), p = u.className || "", f = typeof p == "string" && (p.includes("w8nwRe") || p.includes("kJ3Ndf")), m = d === "more" || d === "see more" || d === "read more" || d === "show more", b = h === "more" || h === "see more" || h === "read more" || h === "show more", _ = (u.getAttribute("jsaction") || "").toLowerCase().includes("review.expand");
    if (f || m || b || _) {
      i = u;
      break;
    }
  }
  if (!i) return;
  const n = t.querySelector(
    'span.wiI7pd, div[class*="wiI7pd"], div.wiI7fc, span.wiI7fc'
  ), a = ((r = n == null ? void 0 : n.textContent) == null ? void 0 : r.length) || 0;
  try {
    i.click();
  } catch {
    return;
  }
  const l = Date.now();
  for (; Date.now() - l < e && !((((c = n == null ? void 0 : n.textContent) == null ? void 0 : c.length) || 0) > a); )
    await new Promise((d) => setTimeout(d, 30));
}
async function Rs(t, e = !0) {
  var a, l, o, r, c;
  const s = t.querySelectorAll(
    'div.jftiEf, div[data-review-id], div[class*="jftiEf"], div[role="region"][aria-label*="Reviews" i] div[class*="jftiEf"], div.m6QErb div.jftiEf'
  ), i = [], n = /* @__PURE__ */ new Set();
  for (const u of Array.from(s))
    if (!C(u))
      try {
        const d = u.getAttribute("data-review-id") || null, h = u.querySelector(
          'div.d4r55, div[class*="d4r55"], button[class*="al6Kxe"]'
        ), p = ((a = h == null ? void 0 : h.textContent) == null ? void 0 : a.trim()) || "Google User", f = u.querySelector('a[href*="/contrib/"]'), m = (f == null ? void 0 : f.href) || "";
        let b = 5;
        const _ = u.querySelector('span[role="img"][aria-label*="star" i], span.kvMYJc');
        if (_) {
          const k = (_.getAttribute("aria-label") || "").match(/(\d+\.?\d*)\s*stars?/i);
          k && (b = parseFloat(k[1]));
        }
        e && await Ls(u);
        const T = u.querySelector(
          'span.wiI7pd, div[class*="wiI7pd"], span.wiI7fc, div[class*="wiI7fc"], span[class*="review-snippet"]'
        ), I = ((l = T == null ? void 0 : T.textContent) == null ? void 0 : l.trim()) || "", S = u.querySelector('span.rsqaWe, span[class*="rsqaWe"]'), D = ((o = S == null ? void 0 : S.textContent) == null ? void 0 : o.trim()) || "", L = Ps(D);
        let U = null;
        const z = u.querySelector('div.RfnDt, span[class*="RfnDt"]');
        if (z) {
          const $ = (r = z.textContent) == null ? void 0 : r.match(/(\d[\d,]*)\s*review/i);
          $ && (U = parseInt($[1].replace(/,/g, ""), 10));
        }
        let O = null;
        const A = u.querySelector('div.CDe7pd, div[class*="CDe7pd"]');
        if (A) {
          const $ = A.querySelector(
            'div.wiI7pd, div[class*="wiI7pd"], span.wiI7pd'
          ), k = A.querySelector('span.DHIhFt, span[class*="DHIhFt"]');
          $ != null && $.textContent && (O = {
            text: $.textContent.trim(),
            date: ((c = k == null ? void 0 : k.textContent) == null ? void 0 : c.trim()) || ""
          });
        }
        const M = [], De = u.querySelectorAll(
          'button[jsaction*="review.photo"], div.Tya61d, div[class*="Tya61d"], div.CDe7pd button, button[style*="background-image"], div[style*="background-image"][aria-label*="photo" i]'
        );
        for (const $ of Array.from(De)) {
          if (te($)) continue;
          const { mediaUrl: k, thumbnailUrl: P } = $e($);
          k && M.push({
            type: "photo",
            sourceUrl: window.location.href,
            mediaUrl: k,
            embedUrl: "",
            thumbnailUrl: P,
            title: "",
            caption: "",
            width: null,
            height: null,
            duration: null,
            sourceContext: "review_media"
          });
        }
        const be = d || `${p}|${D}|${I.slice(0, 50)}`;
        if (n.has(be)) continue;
        n.add(be), i.push({
          sourceReviewId: d,
          authorName: p,
          authorProfileUrl: m,
          authorReviewCount: U,
          rating: b,
          reviewText: I,
          reviewDate: L,
          reviewRelativeTime: D,
          reviewUrl: "",
          language: "en",
          ownerResponse: O,
          media: M
        });
      } catch (d) {
        console.debug("[ReviewExtractor] Error parsing individual review card:", d);
      }
  return i;
}
async function Ms(t) {
  var s;
  const e = [
    // "More reviews" button on business profile
    ...Array.from(t.querySelectorAll('button[aria-label*="More reviews" i]')),
    ...Array.from(t.querySelectorAll('button[aria-label*="See all reviews" i]')),
    ...Array.from(t.querySelectorAll('button[jsaction*="moreReviews" i]')),
    ...Array.from(t.querySelectorAll('button[jsaction*="pane.rating" i]')),
    ...Array.from(t.querySelectorAll("div.F7nice button, div.jANrlb button")),
    // Text match fallback
    ...Array.from(t.querySelectorAll('button, div[role="button"]')).filter((i) => {
      var a;
      const n = ((a = i.textContent) == null ? void 0 : a.trim().toLowerCase()) || "";
      return n === "more reviews" || n === "see all reviews" || n === "view all reviews" || n.startsWith("see all") && n.includes("review") || n.includes("reviews") && !n.includes("write") && !n.includes("rate");
    })
  ];
  for (const i of e)
    if (i && i.offsetParent !== null && !C(i) && !te(i)) {
      try {
        (s = i.scrollIntoView) == null || s.call(i, { behavior: "instant", block: "center" });
      } catch {
      }
      return i.click(), await new Promise((n) => setTimeout(n, 500)), !0;
    }
  return !1;
}
async function Os(t) {
  const e = t.querySelector("div.jftiEf, div[data-review-id]");
  if (e) {
    let i = e.parentElement;
    for (; i && i !== t.body && i !== t.documentElement; ) {
      if (i.scrollHeight > i.clientHeight && i.clientHeight > 100) {
        const n = i.scrollHeight, a = i.scrollTop, l = i.scrollTop + i.clientHeight >= i.scrollHeight - 10;
        i.scrollBy({ top: 1200, behavior: "smooth" }), await new Promise((c) => setTimeout(c, 1e3));
        const o = i.scrollHeight, r = i.scrollTop;
        return o > n || r > a + 10 ? !0 : !l;
      }
      i = i.parentElement;
    }
  }
  const s = t.querySelector("div.m6QErb.DxyBCb.kA9KIf.dS8AEf") || t.querySelector('div.m6QErb[aria-label*="Reviews" i]') || t.querySelector('div[role="region"][aria-label*="Reviews" i] div.m6QErb') || t.querySelector("div.m6QErb.XiKgde") || t.querySelector('div[tabindex="-1"].m6QErb');
  if (s) {
    const i = s.scrollHeight, n = s.scrollTop, a = s.scrollTop + s.clientHeight >= s.scrollHeight - 10;
    s.scrollBy({ top: 1200, behavior: "smooth" }), await new Promise((r) => setTimeout(r, 1e3));
    const l = s.scrollHeight, o = s.scrollTop;
    return l > i || o > n + 20 ? !0 : !a;
  }
  return window.scrollBy({ top: 800, behavior: "smooth" }), await new Promise((i) => setTimeout(i, 700)), !0;
}
function re(t) {
  if (!t) return null;
  let e = t.trim();
  if (e.startsWith("/url?"))
    try {
      const s = new URL(e, "https://www.google.com"), i = s.searchParams.get("q") || s.searchParams.get("url");
      i && (e = decodeURIComponent(i).trim());
    } catch {
    }
  if (e.includes("google.") && e.includes("/url?"))
    try {
      const s = new URL(e), i = s.searchParams.get("q") || s.searchParams.get("url");
      i && (e = decodeURIComponent(i).trim());
    } catch {
    }
  if (!e.startsWith("http://") && !e.startsWith("https://"))
    return null;
  try {
    const i = new URL(e).hostname.replace(/^www\./, "").toLowerCase();
    return [
      "google.com",
      "maps.google.com",
      "goo.gl",
      "gstatic.com",
      "google.co.in",
      "google.co.uk"
    ].some((a) => i === a || i.endsWith("." + a)) ? null : e;
  } catch {
    return null;
  }
}
const mt = [
  // Strategy 0: anchor with data-item-id authority inside detail panel
  (t) => {
    const e = t.querySelector('a[data-item-id*="authority"]');
    return !e || C(e) ? null : re(e.getAttribute("href"));
  },
  // Strategy 1: anchor with website tooltip inside detail panel
  (t) => {
    const e = t.querySelector('a[data-tooltip*="website" i]');
    return !e || C(e) ? null : re(e.getAttribute("href"));
  },
  // Strategy 2: anchor with website aria-label inside detail panel
  (t) => {
    const e = t.querySelector('a[aria-label*="website" i], button[aria-label*="website" i] a');
    return !e || C(e) ? null : re(e.getAttribute("href"));
  },
  // Strategy 3: button with data-item-id authority enclosing an anchor or data-href
  (t) => {
    const e = t.querySelector('button[data-item-id*="authority"]');
    if (!e || C(e)) return null;
    const s = e.querySelector("a"), i = (s == null ? void 0 : s.getAttribute("href")) || e.getAttribute("data-href");
    return re(i);
  },
  // Strategy 4: any anchor linking to external domain in detail panel
  (t) => {
    const e = t.querySelectorAll('a[href^="http"]');
    for (const s of Array.from(e)) {
      if (C(s)) continue;
      const i = re(s.getAttribute("href"));
      if (i) return i;
    }
    return null;
  }
];
function Us(t) {
  const e = se(t);
  if (!e)
    return { value: null, strategyUsed: -1 };
  for (let s = 0; s < mt.length; s++) {
    const i = mt[s](e);
    if (i && i.length > 0)
      return { value: i, strategyUsed: s };
  }
  return { value: null, strategyUsed: -1 };
}
function js(t) {
  const e = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "wa.me",
    "whatsapp.com"
  ], s = se(t);
  if (!s) return [];
  const i = [], n = s.querySelectorAll("a[href]");
  for (const a of Array.from(n)) {
    if (C(a)) continue;
    const l = a.getAttribute("href");
    if (l)
      try {
        const r = new URL(l).hostname.replace(/^www\./, "").toLowerCase();
        e.some((c) => r === c || r.endsWith("." + c)) && i.push(l);
      } catch {
      }
  }
  return Array.from(new Set(i));
}
function qs(t) {
  if (!t || !t.body) return !1;
  const e = (t.body.textContent || "").toLowerCase(), i = [
    "unusual traffic",
    "verify you are a human",
    "confirm you're not a robot",
    "detected unusual activity",
    "please solve this puzzle",
    "security check"
  ].some((a) => e.includes(a)), n = !!t.querySelector(
    'iframe[src*="recaptcha"], iframe[title*="challenge" i], iframe[src*="captcha"]'
  );
  return i || n;
}
class Fs {
  constructor() {
    v(this, "platformId", "google_maps");
  }
  detectPlatform(e, s) {
    return s.includes("google.com/maps") || s.includes("maps.google.com");
  }
  detectSearchPage(e, s) {
    if (!this.detectPlatform(e, s)) return null;
    let i = null;
    const n = s.match(/\/maps\/search\/([^/@?]+)/);
    if (n)
      try {
        i = decodeURIComponent(n[1].replace(/\+/g, " "));
      } catch {
        i = n[1];
      }
    if (!i) {
      const a = s.match(/!2m1!1s([^!]+)/);
      if (a)
        try {
          i = decodeURIComponent(a[1].replace(/\+/g, " "));
        } catch {
          i = a[1];
        }
    }
    if (!i) {
      const a = e.querySelector("input#searchboxinput") || e.querySelector('input[name="q"]') || e.querySelector('input[id*="searchbox" i]');
      a && a.value && (i = a.value.trim());
    }
    if (!i)
      try {
        i = new URL(s).searchParams.get("q") || null;
      } catch {
      }
    if (!i) {
      const a = e.querySelector(
        'div[aria-label*="Results for" i], div[role="feed"][aria-label*="Results for" i]'
      );
      if (a) {
        const o = (a.getAttribute("aria-label") || "").match(/Results for\s+["']?([^"']+)["']?/i);
        o && (i = o[1].trim());
      }
    }
    return i || e.querySelector('div[role="feed"], a.hfpxzc, a[href*="/maps/place/"]') && (i = "Google Maps Search"), i ? { query: i, locationHint: null } : null;
  }
  discoverBusinesses(e) {
    var o, r, c, u, d;
    const s = e.querySelector('div[role="feed"]') || e.querySelector("div.m6QErb.DxyBCb") || e.querySelector('div.m6QErb[aria-label*="Results" i]') || e;
    let i = Array.from(
      s.querySelectorAll('div.Nv2PK, div[role="article"]')
    );
    i.length === 0 && (i = Array.from(
      s.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]')
    ));
    const n = [], a = /* @__PURE__ */ new Set();
    let l = 0;
    for (const h of i) {
      let p = "", f = "";
      const m = h.tagName.toLowerCase() === "a" ? h : h.querySelector('a.hfpxzc, a[href*="/maps/place/"], a[aria-label]');
      f = (m == null ? void 0 : m.getAttribute("href")) || (m == null ? void 0 : m.href) || "";
      const b = h.querySelector('div[class*="fontHeadlineSmall"]') || h.querySelector('div[class*="qBF1Pd"]') || h.querySelector("div.NrDZNb") || h.querySelector("div.fontTitleMedium");
      if (p = ((o = b == null ? void 0 : b.textContent) == null ? void 0 : o.trim()) || ((r = m == null ? void 0 : m.getAttribute("aria-label")) == null ? void 0 : r.trim()) || "", X(p))
        continue;
      const _ = K(f), T = f || _ || `card-index-${l}`, I = _ ? `place:${_.toLowerCase()}` : `${p.toLowerCase().trim()}|${T}`;
      if (a.has(I))
        continue;
      a.add(I);
      const S = (h.tagName.toLowerCase() === "a" ? h.closest('div.Nv2PK, div[role="article"]') : h) || h;
      let D = null, L = null, U, z;
      const O = S.querySelector('[aria-label*="star" i]');
      if (O) {
        const k = O.getAttribute("aria-label") || "", P = k.match(/(\d+\.?\d*)\s*stars?/i);
        if (P) {
          const ie = parseFloat(P[1]);
          !isNaN(ie) && ie > 0 && ie <= 5 && (D = ie);
        }
        const ue = k.match(/(\d[\d,]*)\s*reviews?/i);
        if (ue) {
          const ie = parseInt(ue[1].replace(/,/g, ""), 10);
          isNaN(ie) || (L = ie);
        }
      }
      if (D === null) {
        const k = S.querySelector('span[class*="MW4etd"]');
        if (k) {
          const P = parseFloat(((c = k.textContent) == null ? void 0 : c.trim()) || "");
          !isNaN(P) && P > 0 && P <= 5 && (D = P);
        }
      }
      if (L === null) {
        const k = S.querySelector('span[class*="UY7F9"]');
        if (k) {
          const P = parseInt(((u = k.textContent) == null ? void 0 : u.replace(/[^\d]/g, "")) || "", 10);
          isNaN(P) || (L = P);
        }
      }
      let A;
      const M = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/, De = S.querySelectorAll("div.W4Efsd span");
      for (const k of Array.from(De)) {
        const P = ((d = k.textContent) == null ? void 0 : d.trim()) || "";
        if (!(!P || P === "·" || P.includes("★") || /^\d+(\.\d+)?$/.test(P))) {
          if (!A) {
            const ue = P.match(M);
            ue && ue[0].replace(/\D/g, "").length >= 8 && (A = ue[0].trim());
          }
          !U && /clinic|dentist|hospital|doctor|care|store|shop|hotel|restaurant|service|agency/i.test(P) ? U = P : !z && P.length > 5 && (/\d+|road|rd|street|st|lane|nagar|market|chowk|post|dist|marg/i.test(P) || P.includes(",")) && (z = P);
        }
      }
      let be;
      const $ = S.querySelector(
        'a[data-value="Website"], a[aria-label*="Website" i], a[data-tooltip*="Website" i], a[href*="/url?q="], a[href*="google.com/url?q="]'
      );
      if ($) {
        const k = $.getAttribute("href") || $.href || "", P = re(k);
        P && (be = P);
      }
      n.push({
        cardRef: T,
        name: p,
        category: U,
        address: z,
        phone: A,
        website: be,
        rating: D,
        reviewCount: L,
        cardFingerprint: I,
        discoveryIndex: l
      }), l++;
    }
    return n;
  }
  async discoverMore(e) {
    return Dt(e);
  }
  detectEndOfFeed(e) {
    return Es(e);
  }
  async openBusiness(e) {
    return Is(e);
  }
  async extractBusiness(e, s) {
    var S, D;
    const i = pt(e);
    if (!i.value || X(i.value))
      throw new Error(`Invalid or missing business name extracted: "${i.value || ""}"`);
    const n = ut(e), a = Ds(e), l = Us(e), o = js(e), r = Ns(e), c = _s(e), u = ys(e), d = bs(e), h = s ? K(s) : null, p = (S = e.location) != null && S.href ? K(e.location.href) : null;
    let f = ((D = e.location) == null ? void 0 : D.href) || "";
    const m = !f || f.includes("/maps/search/") || f.includes("/search?") || f.endsWith("/maps") || f.endsWith("/maps/");
    h && p && h !== p ? f = s || f : m && s && (f = s);
    const b = h && p && h === p ? p : h || K(f) || p, _ = Ee(f), T = _.lat !== null ? _ : s ? Ee(s) : { lat: null, lng: null }, I = Rt(e);
    return {
      name: i.value,
      primaryCategory: c.primaryCategory,
      secondaryCategories: c.secondaryCategories,
      rating: r.rating,
      reviewCount: r.reviewCount,
      priceLevel: r.priceLevel,
      address: n.value,
      phone: a.value,
      websiteUrl: l.value,
      socialUrls: o,
      mapsUrl: f,
      placeIdentifier: b,
      plusCode: I,
      coordinates: T,
      hours: u,
      businessStatus: d.businessStatus,
      description: d.description,
      serviceOptions: d.serviceOptions,
      attributes: d.attributes
    };
  }
  extractBusinessFromFeed(e, s) {
    var T, I, S;
    let i = null;
    const n = K(s.cardRef), l = (s.name || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, ""), o = e.querySelectorAll('div.Nv2PK, div[role="article"]');
    for (const D of Array.from(o)) {
      const L = D.querySelector('a.hfpxzc, a[href*="/maps/place/"], a'), U = ((L == null ? void 0 : L.getAttribute("href")) || "") + " " + ((L == null ? void 0 : L.href) || "");
      if (n && U.includes(n)) {
        i = D;
        break;
      }
      const z = D.querySelector('div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb'), A = ((z == null ? void 0 : z.textContent) || "").toLowerCase().trim().replace(/[^a-z0-9]/gi, "");
      if (l && (A === l || l.length >= 4 && (A.includes(l) || l.includes(A)))) {
        i = D;
        break;
      }
    }
    let r = s.name, c = s.rating ?? null, u = s.reviewCount ?? null, d = s.phone ?? null, h = s.address ?? null, p = s.category ?? null, f = s.website ?? null;
    if (i) {
      const D = i.querySelector(
        'div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb, div.fontTitleMedium'
      );
      (T = D == null ? void 0 : D.textContent) != null && T.trim() && (r = D.textContent.trim());
      const L = i.querySelector('[aria-label*="star" i]');
      if (L) {
        const O = L.getAttribute("aria-label") || "";
        if (c === null) {
          const A = O.match(/(\d+\.?\d*)\s*stars?/i);
          if (A) {
            const M = parseFloat(A[1]);
            !isNaN(M) && M > 0 && M <= 5 && (c = M);
          }
        }
        if (u === null) {
          const A = O.match(/(\d[\d,]*)\s*reviews?/i);
          if (A) {
            const M = parseInt(A[1].replace(/,/g, ""), 10);
            isNaN(M) || (u = M);
          }
        }
      }
      if (u === null) {
        const O = i.querySelector('span[class*="UY7F9"]');
        if (O) {
          const A = parseInt(((I = O.textContent) == null ? void 0 : I.replace(/[^\d]/g, "")) || "", 10);
          isNaN(A) || (u = A);
        }
      }
      if (!f) {
        const O = i.querySelector(
          'a[data-value="Website"], a[aria-label*="Website" i], a[data-tooltip*="Website" i], a[href*="/url?q="], a[href*="google.com/url?q="]'
        );
        if (O) {
          const A = O.getAttribute("href") || O.href || "", M = re(A);
          M && (f = M);
        }
      }
      const U = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/, z = i.querySelectorAll("div.W4Efsd span");
      for (const O of Array.from(z)) {
        const A = ((S = O.textContent) == null ? void 0 : S.trim()) || "";
        if (!(!A || A === "·" || A.includes("★") || /^\d+(\.\d+)?$/.test(A))) {
          if (!d) {
            const M = A.match(U);
            M && M[0].replace(/\D/g, "").length >= 8 && (d = M[0].trim());
          }
          !p && /clinic|dentist|hospital|doctor|care|store|shop|hotel|restaurant|service|agency/i.test(A) ? p = A : !h && A.length > 5 && (/\d+|road|rd|street|st|lane|nagar|market|chowk|post|dist|marg/i.test(A) || A.includes(",")) && (h = A);
        }
      }
    }
    const m = s.cardRef || "", b = K(m), _ = Ee(m);
    return {
      name: r || "Local Business",
      primaryCategory: p || "Local Business",
      secondaryCategories: [],
      rating: c,
      reviewCount: u,
      priceLevel: null,
      address: h || null,
      phone: d || null,
      websiteUrl: f || null,
      socialUrls: [],
      mapsUrl: m,
      placeIdentifier: b,
      plusCode: null,
      coordinates: _,
      hours: null,
      businessStatus: "operational",
      description: null,
      serviceOptions: [],
      attributes: []
    };
  }
  normalizeBusiness(e) {
    var o, r, c, u, d, h;
    const s = cs(e.websiteUrl, e.socialUrls), i = gs(e.phone, { address: e.address }), n = {
      business_name: ((o = e.name) == null ? void 0 : o.trim()) || "",
      primary_category: ((r = e.primaryCategory) == null ? void 0 : r.trim()) || "Local Business",
      secondary_categories: e.secondaryCategories || [],
      rating: e.rating ?? null,
      review_count: e.reviewCount ?? null,
      price_level: e.priceLevel ?? null,
      address: ((c = e.address) == null ? void 0 : c.trim()) || "",
      phone: i.phone_normalized || ((u = e.phone) == null ? void 0 : u.trim()) || "",
      phone_raw: i.phone_raw,
      phone_normalized: i.phone_normalized,
      phone_country: i.phone_country,
      phone_country_calling_code: i.phone_country_calling_code,
      phone_country_source: i.phone_country_source,
      phone_status: i.phone_status,
      whatsapp_link: i.whatsapp_link,
      website: s.website,
      website_status: s.website_status,
      social_links: s.social_links,
      maps_url: e.mapsUrl || "",
      place_identifier: e.placeIdentifier || null,
      plus_code: e.plusCode || null,
      latitude: ((d = e.coordinates) == null ? void 0 : d.lat) ?? null,
      longitude: ((h = e.coordinates) == null ? void 0 : h.lng) ?? null,
      opening_hours: e.hours || null,
      business_status: e.businessStatus || "operational",
      description: e.description || null,
      service_options: e.serviceOptions || [],
      attributes: e.attributes || [],
      source_platform: "google_maps",
      duplicate_of: null,
      error_fields: s.error_fields || []
    }, { missing_fields: a, error_fields: l } = Je(
      n,
      e.unconfirmedFields
    );
    return n.missing_fields = a, n.error_fields = l, l.length > 0 && (!n.business_name || !n.address) ? n.extraction_status = "failed" : l.length > 0 ? n.extraction_status = "partial" : n.extraction_status = "complete", n;
  }
  getBusinessIdentifier(e) {
    const s = ce(e);
    return s.placeIdentifier ? { primary: s.placeIdentifier, type: "place_identifier" } : s.normalizedWebsite ? { primary: s.normalizedWebsite, type: "website" } : s.normalizedMapsUrl ? { primary: s.normalizedMapsUrl, type: "maps_url" } : s.nameAddressKey ? { primary: s.nameAddressKey, type: "name_address" } : s.namePhoneKey ? { primary: s.namePhoneKey, type: "name_phone" } : {
      primary: e.business_name || "unknown",
      type: "name_address"
    };
  }
  detectCompletion(e) {
    return Ss(e);
  }
  detectVerification(e) {
    return qs(e);
  }
  async returnToResults() {
    return Qe();
  }
  detectUnexpectedNavigation(e, s, i) {
    return vs(e, s, i);
  }
  /**
   * Detect if the current page is a single business page (PRD §7.2, §37)
   */
  detectBusinessPage(e, s) {
    if (!this.detectPlatform(e, s)) return null;
    const i = e.querySelector('div[role="feed"]'), n = e.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"]');
    if (i && !n && !s.includes("/maps/place/"))
      return null;
    const a = pt(e);
    if (!a.value) return null;
    const o = ut(e).value, r = s.includes("/maps/place/");
    let c = s;
    if (!r) {
      const d = e.querySelector('button[data-item-id*="share" i], button[aria-label*="Share" i]'), h = (d == null ? void 0 : d.getAttribute("data-url")) || (d == null ? void 0 : d.getAttribute("data-link"));
      if (h && h.includes("/maps/place/"))
        c = h;
      else {
        const p = e.querySelector('a[href*="/maps/place/"]');
        p != null && p.href && (c = p.href);
      }
    }
    const u = a.strategyUsed === 0 && c.includes("/maps/place/") ? "high" : "low";
    return {
      business_name: a.value,
      address_preview: o,
      maps_url: c,
      confidence: u
    };
  }
  /**
   * Discover rendered media items (PRD §8, §37)
   */
  async discoverMedia(e, s = "business_gallery") {
    return Ts(e, s);
  }
  /**
   * Trigger further media loading (e.g. scroll gallery)
   */
  async discoverMoreMedia(e) {
    return xs(e);
  }
  /**
   * Discover rendered reviews (PRD §13, §37)
   */
  async discoverReviews(e) {
    return Rs(e);
  }
  /**
   * Trigger further reviews loading: clicks "More reviews" button first, then scrolls.
   */
  async discoverMoreReviews(e) {
    return await Ms(e) ? !0 : Os(e);
  }
  /**
   * Switch between Overview, Photos, Reviews, About tabs
   */
  async switchToBusinessTab(e, s) {
    return As(e, s);
  }
}
const Ws = {
  idle: ["running", "detecting", "queued"],
  detecting: ["queued", "idle", "failed"],
  queued: ["running", "idle"],
  running: ["paused", "completed", "stopped", "failed"],
  paused: ["running", "stopped", "failed"],
  completed: ["running", "queued"],
  // Can restart/resume if new items discovered
  stopped: ["running", "queued"],
  failed: ["running", "queued", "idle"]
};
function ae(t, e) {
  var s;
  return ((s = Ws[t]) == null ? void 0 : s.includes(e)) ?? !1;
}
function pe(t, e) {
  const s = {
    ...t,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  switch (e.type) {
    case "START": {
      ae(t.status, "running") && (s.status = "running", s.pauseReason = null, s.completionReason = null);
      break;
    }
    case "PAUSE": {
      ae(t.status, "paused") && (s.status = "paused", s.pauseReason = e.reason || "user");
      break;
    }
    case "RESUME": {
      ae(t.status, "running") && (s.status = "running", s.pauseReason = null, s.completionReason = null);
      break;
    }
    case "STOP": {
      ae(t.status, "stopped") && (s.status = "stopped", s.completionReason = "user_stopped");
      break;
    }
    case "COMPLETE": {
      ae(t.status, "completed") && (s.status = "completed", s.completionReason = e.reason);
      break;
    }
    case "QUEUE_EXHAUSTED": {
      ae(t.status, "completed") && (s.status = "completed", s.completionReason = "results_exhausted");
      break;
    }
    case "FAIL": {
      ae(t.status, "failed") && (s.status = "failed");
      break;
    }
  }
  return s;
}
function Xe() {
  return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t) => {
    const e = Math.random() * 16 | 0;
    return (t === "x" ? e : e & 3 | 8).toString(16);
  });
}
function gt(t, e, s = "google_maps", i = {}) {
  const n = (/* @__PURE__ */ new Date()).toISOString();
  return {
    sessionId: Xe(),
    platform: s,
    sourceUrl: t,
    searchContext: e,
    status: "idle",
    pauseReason: null,
    createdAt: n,
    updatedAt: n,
    queue: [],
    processedCount: 0,
    successCount: 0,
    partialCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    websiteCount: 0,
    socialCount: 0,
    noWebsiteCount: 0,
    settingsSnapshot: { ...ge, ...i }
  };
}
function Ge(t, e) {
  const s = new Set(t.queue.map((a) => a.cardFingerprint)), i = [], n = t.settingsSnapshot.maxBusinesses;
  for (const a of e) {
    if (n > 0 && t.queue.length >= n)
      break;
    if (s.has(a.cardFingerprint))
      continue;
    s.add(a.cardFingerprint);
    const l = {
      queueId: Xe(),
      sessionId: t.sessionId,
      discoveryIndex: a.discoveryIndex !== void 0 ? a.discoveryIndex : t.queue.length,
      status: "queued",
      cardRef: a.cardRef,
      name: a.name,
      address: a.address,
      phone: a.phone,
      website: a.website,
      rating: a.rating ?? null,
      reviewCount: a.reviewCount ?? null,
      category: a.category,
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: a.cardFingerprint
    };
    t.queue.push(l), i.push(l);
  }
  return t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), { addedCount: i.length, newQueueItems: i };
}
function bt(t) {
  return t.queue.find((e) => e.status === "queued") || null;
}
function Bs(t) {
  const e = [];
  for (const s of t.queue)
    s.status === "failed" && (s.status = "queued", s.lastError = null, e.push(s));
  return t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), e;
}
async function W(t) {
  const e = await N();
  t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await e.put("sessions", t);
}
async function Ae(t) {
  return (await N()).get("sessions", t);
}
async function $s() {
  return (await (await N()).transaction("sessions", "readonly").store.index("updatedAt").getAll()).reverse();
}
async function He(t) {
  const s = (await N()).transaction(["sessions", "queue_items", "business_records"], "readwrite");
  await s.objectStore("sessions").delete(t);
  let n = await s.objectStore("queue_items").index("sessionId").openKeyCursor(IDBKeyRange.only(t));
  for (; n; )
    await s.objectStore("queue_items").delete(n.primaryKey), n = await n.continue();
  let l = await s.objectStore("business_records").index("sessionId").openKeyCursor(IDBKeyRange.only(t));
  for (; l; )
    await s.objectStore("business_records").delete(l.primaryKey), l = await l.continue();
  await s.done;
}
async function Gs(t, e) {
  const i = (await N()).transaction("sessions", "readwrite"), n = await i.store.get(t);
  if (!n) {
    await i.done;
    return;
  }
  return n.customName = e.trim(), n.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await i.store.put(n), await i.done, n;
}
async function Hs(t) {
  for (const e of t)
    await He(e);
}
function ve(t) {
  return !!(t == null || typeof t == "string" && t.trim() === "" || Array.isArray(t) && t.length === 0);
}
function Ks(t, e) {
  var l;
  const s = { ...t }, i = [
    "phone",
    "website",
    "rating",
    "review_count",
    "price_level",
    "plus_code",
    "latitude",
    "longitude",
    "opening_hours",
    "description",
    "service_options",
    "attributes",
    "secondary_categories",
    "place_identifier"
  ];
  for (const o of i) {
    const r = t[o], c = e[o];
    ve(r) && !ve(c) && (s[o] = c);
  }
  ve(t.website) && !ve(e.website) && (s.website = e.website, s.website_status = e.website_status || "website"), (!t.social_links || t.social_links.length === 0) && ((l = e.social_links) != null && l.length) && (s.social_links = [...e.social_links]);
  const { missing_fields: n, error_fields: a } = Je(s, t.error_fields);
  return s.missing_fields = n, s.error_fields = a, s;
}
async function zs(t) {
  return (await N()).get("business_records", t);
}
async function Me(t) {
  return (await N()).transaction("business_records", "readonly").store.index("sessionId").getAll(IDBKeyRange.only(t));
}
async function Vs(t, e, s = "all_sessions") {
  const a = (await N()).transaction("business_records", "readonly").store, l = ce(e);
  if (l.placeIdentifier) {
    const r = await a.index("placeIdentifier").getAll(IDBKeyRange.only(l.placeIdentifier)), c = r.find((u) => u.sessionId === t);
    if (c) return c;
    if (s === "all_sessions") {
      const u = r.find((d) => d.extraction_status !== "duplicate");
      if (u) return u;
      if (r.length > 0) return r[0];
    }
  }
  if (l.nameAddressKey) {
    const r = await a.index("normalizedNameAddress").getAll(IDBKeyRange.only(l.nameAddressKey)), c = r.find((u) => u.sessionId === t && de(e, u));
    if (c) return c;
    if (s === "all_sessions") {
      const u = r.find((d) => de(e, d));
      if (u) return u;
    }
  }
  if (l.namePhoneKey) {
    const r = await a.index("normalizedNamePhone").getAll(IDBKeyRange.only(l.namePhoneKey)), c = r.find((u) => u.sessionId === t && de(e, u));
    if (c) return c;
    if (s === "all_sessions") {
      const u = r.find((d) => de(e, d));
      if (u) return u;
    }
  }
  if (l.normalizedWebsite || l.normalizedMapsUrl)
    if (s === "current_session") {
      const r = await a.index("sessionId").getAll(IDBKeyRange.only(t));
      for (const c of r)
        if (de(e, c))
          return c;
    } else {
      const o = await a.getAll();
      for (const r of o)
        if (de(e, r))
          return r;
    }
  return null;
}
async function Js(t, e, s) {
  const i = t.settingsSnapshot.duplicateScope ?? "all_sessions", n = await Vs(t.sessionId, s, i), l = (await N()).transaction(["business_records", "queue_items", "sessions"], "readwrite"), o = l.objectStore("business_records"), r = l.objectStore("queue_items"), c = l.objectStore("sessions");
  let u, d = !1;
  if (n) {
    d = !0;
    const p = n.sessionId === t.sessionId;
    if (p && t.settingsSnapshot.duplicateMergePolicy === "fill_gaps") {
      u = Ks(n, s);
      const b = ce(u), _ = {
        ...u,
        sessionId: t.sessionId,
        normalizedNameAddress: b.nameAddressKey || "",
        normalizedNamePhone: b.namePhoneKey || ""
      };
      await o.put(_);
    } else
      u = s;
    const f = ce(s), m = {
      ...s,
      record_id: s.record_id,
      sessionId: t.sessionId,
      extraction_status: "duplicate",
      duplicate_of: n.record_id,
      normalizedNameAddress: f.nameAddressKey || "",
      normalizedNamePhone: f.namePhoneKey || ""
    };
    await o.put(m), e.status = "duplicate", e.recordId = n.record_id, t.duplicateCount += 1, (!p || t.settingsSnapshot.duplicateMergePolicy !== "fill_gaps") && (u = m);
  } else {
    u = s;
    const p = ce(u), f = {
      ...u,
      sessionId: t.sessionId,
      normalizedNameAddress: p.nameAddressKey || "",
      normalizedNamePhone: p.namePhoneKey || ""
    };
    await o.put(f), e.status = u.extraction_status, e.recordId = u.record_id, u.extraction_status === "complete" ? t.successCount += 1 : u.extraction_status === "partial" ? t.partialCount += 1 : u.extraction_status === "failed" && (t.failedCount += 1), u.website_status === "website" ? t.websiteCount += 1 : u.website_status === "social_only" ? t.socialCount += 1 : t.noWebsiteCount += 1;
  }
  t.processedCount += 1, t.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const h = t.queue.findIndex((p) => p.queueId === e.queueId);
  return h >= 0 && (t.queue[h] = { ...e }), await r.put(e), await c.put(t), await l.done, {
    savedRecord: u,
    isDuplicateRecord: d,
    updatedSession: t
  };
}
class Qs {
  constructor(e, s) {
    v(this, "session");
    v(this, "adapter", new Fs());
    v(this, "callbacks");
    v(this, "isLoopRunning", !1);
    v(this, "consecutiveFailures", 0);
    v(this, "loopPromise", null);
    this.session = e, this.callbacks = s;
  }
  getSession() {
    return this.session;
  }
  setSession(e) {
    this.session = e;
  }
  /**
   * Starts extraction loop
   */
  async start() {
    this.session.status !== "running" && (this.session = pe(this.session, { type: "START" }), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session }), this.loopPromise = this.runLoop());
  }
  /**
   * Waits for the currently running extraction loop to finish or pause
   */
  async waitForCompletion() {
    return this.loopPromise && await this.loopPromise, this.session;
  }
  /**
   * Pauses extraction loop
   */
  async pause(e = "user") {
    this.session = pe(this.session, { type: "PAUSE", reason: e }), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
  }
  /**
   * Resumes extraction loop
   */
  async resume() {
    this.session.status !== "running" && (this.session = pe(this.session, { type: "RESUME" }), this.consecutiveFailures = 0, await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session }), this.loopPromise = this.runLoop());
  }
  /**
   * Stops extraction permanently, preserving all saved records
   */
  async stop() {
    this.session = pe(this.session, { type: "STOP" }), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
  }
  /**
   * Resets only failed items and resumes extraction
   */
  async retryFailed() {
    Bs(this.session), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session }), await this.resume();
  }
  /**
   * Main sequential processing loop
   */
  async runLoop() {
    if (!this.isLoopRunning) {
      this.isLoopRunning = !0;
      try {
        for (; this.session.status === "running"; ) {
          const e = this.session.settingsSnapshot.maxBusinesses;
          if (e > 0 && this.session.processedCount >= e) {
            this.session = pe(this.session, {
              type: "COMPLETE",
              reason: "limit_reached"
            }), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
            break;
          }
          const s = this.session.queue.filter((a) => a.status === "queued").length;
          if (s < 10 && (e <= 0 || this.session.processedCount + s < e))
            try {
              const a = await this.callbacks.sendToContent({
                type: "SCROLL_RESULTS_FEED"
              });
              if (a != null && a.cards && a.cards.length > 0) {
                const { addedCount: l } = Ge(this.session, a.cards);
                l > 0 && (await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session }));
              }
            } catch (a) {
              console.debug("[Orchestrator] Proactive feed scroll error:", a);
            }
          let i = bt(this.session);
          if (!i) {
            let a = !1;
            for (let l = 0; l < 8 && this.session.status === "running"; l++)
              try {
                const o = await this.callbacks.sendToContent({
                  type: "SCROLL_RESULTS_FEED"
                });
                if (o != null && o.cards && o.cards.length > 0) {
                  const { addedCount: c } = Ge(this.session, o.cards);
                  c > 0 && (await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session }));
                }
                if (i = bt(this.session), i) {
                  a = !0;
                  break;
                }
                const r = Math.min(200, Math.max(20, Math.round((this.session.settingsSnapshot.minDelaySeconds || 0.2) * 500)));
                await B(r);
              } catch (o) {
                console.debug("[Orchestrator] Exhaustion recovery scroll error:", o);
              }
            if (!a || !i) {
              this.session = pe(this.session, {
                type: "COMPLETE",
                reason: "results_exhausted"
              }), await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
              break;
            }
          }
          if (await this.processSingleBusiness(i), this.session.status !== "running")
            break;
          const n = Ce(
            this.session.settingsSnapshot.minDelaySeconds,
            this.session.settingsSnapshot.maxDelaySeconds
          );
          n > 0 && await B(n);
        }
      } finally {
        this.isLoopRunning = !1;
      }
    }
  }
  /**
   * Processes a single business item in sequence
   */
  async processSingleBusiness(e) {
    e.status = "processing", this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    try {
      const s = await this.callbacks.requestRawExtraction(e);
      if (!s || !s.name)
        throw new Error("Empty raw extraction received from target detail panel");
      const i = s.name.trim();
      if (!i || i.toLowerCase() === "results" || i.toLowerCase().startsWith("results for") || i.toLowerCase() === "search results" || i.toLowerCase() === "google maps")
        throw new Error(`Invalid business name extracted from detail panel: "${i}"`);
      const a = this.adapter.normalizeBusiness(s), l = K(e.cardRef), o = a.place_identifier || (s.mapsUrl ? K(s.mapsUrl) : null);
      if (!!(!!!(e.name && a.business_name && (a.business_name.toLowerCase().includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(a.business_name.toLowerCase()))) && l && o && l.toLowerCase() !== o.toLowerCase()))
        throw new Error(`Target place mismatch: expected ${l}, got ${o}`);
      const u = a.business_name || e.name, h = !(!a.maps_url || a.maps_url.includes("/maps/search/") || a.maps_url.includes("/search?") || a.maps_url.endsWith("/maps") || a.maps_url.endsWith("/maps/")) && a.maps_url ? a.maps_url : e.cardRef || "", p = a.place_identifier || (h ? K(h) : null), f = a.latitude === null || a.latitude === void 0 ? Ee(h) : { lat: a.latitude, lng: a.longitude }, m = {
        record_id: Xe(),
        business_name: u,
        primary_category: a.primary_category || e.category || "Local Business",
        secondary_categories: a.secondary_categories || [],
        rating: a.rating ?? e.rating ?? null,
        review_count: a.review_count ?? e.reviewCount ?? null,
        price_level: a.price_level ?? null,
        address: a.address || e.address || "",
        phone: a.phone || e.phone || "",
        phone_raw: a.phone_raw ?? e.phone ?? "",
        phone_normalized: a.phone_normalized ?? "",
        phone_country: a.phone_country ?? "",
        phone_country_calling_code: a.phone_country_calling_code ?? "",
        phone_country_source: a.phone_country_source ?? "unknown",
        phone_status: a.phone_status ?? "unknown",
        whatsapp_link: a.whatsapp_link ?? "",
        website: a.website || "",
        website_status: a.website_status || "none",
        social_links: a.social_links || [],
        maps_url: h,
        place_identifier: p,
        plus_code: a.plus_code || null,
        latitude: f.lat ?? null,
        longitude: f.lng ?? null,
        opening_hours: a.opening_hours || null,
        business_status: a.business_status || "operational",
        description: a.description || null,
        service_options: a.service_options || [],
        attributes: a.attributes || [],
        extraction_status: "complete",
        extraction_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        missing_fields: [],
        error_fields: [],
        source_platform: "google_maps",
        duplicate_of: null
      }, { missing_fields: b, error_fields: _ } = Je(m);
      m.missing_fields = b, m.error_fields = _;
      const T = ["phone", "website", "rating"], I = b.some(
        (D) => T.includes(D)
      );
      m.extraction_status = _.length > 0 || I ? "partial" : "complete";
      const S = await Js(this.session, e, m);
      this.session = S.updatedSession, this.consecutiveFailures = 0, this.callbacks.broadcastToUI({ type: "RECORD_SAVED", record: S.savedRecord }), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    } catch (s) {
      const i = s instanceof Error ? s.message : String(s);
      if (console.debug(`[Orchestrator] Business "${e.name}" failed (retry ${e.retryCount}):`, i), i.includes("verification_required")) {
        await this.pause("verification_required");
        return;
      }
      const n = i.includes("timed out") || i.includes("Could not establish connection") || i.includes("Receiving end does not exist") || i.includes("message channel closed") || i.includes("Empty raw extraction") || i.includes("target_detail_not_ready") || i.includes("Target place mismatch") || i.includes("communication error");
      if (e.retryCount += 1, e.lastError = i, e.retryCount <= this.session.settingsSnapshot.maxRetriesPerBusiness) {
        const a = this.session.settingsSnapshot.minDelaySeconds <= 0.5 ? 0.2 : 2, l = ns(e.retryCount, a);
        e.status = "queued", await B(l);
      } else
        e.status = "failed", this.session.failedCount += 1, this.session.processedCount += 1, n || (this.consecutiveFailures += 1);
      if (this.consecutiveFailures >= this.session.settingsSnapshot.maxConsecutiveFailures) {
        await this.pause("error_threshold");
        return;
      }
      await W(this.session), this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    }
  }
}
const Xs = {
  general: {
    id: "general",
    name: "General Qualification",
    targetDescription: "Balanced overview of business contactability, reputation, and presence",
    evaluateOpportunity: (t, e, s) => {
      const i = [], n = [], a = !!(t.phone && t.phone.trim().length >= 6), l = t.business_status === "operational", o = !!(t.rating && t.rating >= 4);
      return a && l && o ? (n.push("sig_full_contact", "sig_rating_excellent"), i.push("Verified operational business with positive ratings and direct phone line."), {
        profileId: "general",
        profileName: "General Qualification",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : a || l ? (n.push("sig_phone_available"), i.push("Reachable local business with standard listing presence."), {
        profileId: "general",
        profileName: "General Qualification",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push("Listing has limited contact information or restricted public activity."), {
        profileId: "general",
        profileName: "General Qualification",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  },
  web_dev: {
    id: "web_dev",
    name: "Web Development & Funnels",
    targetDescription: "Finds established businesses lacking dedicated websites or conversion portals",
    evaluateOpportunity: (t, e, s) => {
      const i = [], n = [], a = t.website_status === "none", l = t.website_status === "social_only", o = t.review_count || 0, r = t.rating || 0;
      return (a || l) && (o >= 30 || r >= 4.3) ? (n.push("sig_no_website", "sig_opp_high_rev_no_site"), i.push(
        `Strong local customer flow (${o} reviews, ${r.toFixed(1)} rating) with no dedicated website domain.`
      ), {
        profileId: "web_dev",
        profileName: "Web Development & Funnels",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : a || l ? (n.push(a ? "sig_no_website" : "sig_social_only"), i.push("No dedicated website detected. Prime prospect for custom web design."), {
        profileId: "web_dev",
        profileName: "Web Development & Funnels",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push("Business already has an active registered website domain."), {
        profileId: "web_dev",
        profileName: "Web Development & Funnels",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  },
  seo: {
    id: "seo",
    name: "SEO & Local Search (GBP)",
    targetDescription: "Highlights incomplete Google Business Profiles and low local visibility",
    evaluateOpportunity: (t, e, s) => {
      var c, u, d;
      const i = [], n = [], a = ((c = t.missing_fields) == null ? void 0 : c.length) || 0, l = t.review_count || 0, o = (u = t.missing_fields) == null ? void 0 : u.includes("hours"), r = (d = t.missing_fields) == null ? void 0 : d.includes("description");
      return a >= 2 && (l >= 15 || o || r) ? (n.push("sig_profile_incomplete", "sig_opp_incomplete_active"), i.push(
        `Incomplete Google Business Profile (${a} missing fields) with existing local customer activity.`
      ), {
        profileId: "seo",
        profileName: "SEO & Local Search (GBP)",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : a > 0 || l < 20 && l > 0 ? (n.push("sig_profile_incomplete"), i.push("Listing has optimization gaps in content, hours, or review authority."), {
        profileId: "seo",
        profileName: "SEO & Local Search (GBP)",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push("Profile is well-populated with complete listing attributes."), {
        profileId: "seo",
        profileName: "SEO & Local Search (GBP)",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  },
  reputation: {
    id: "reputation",
    name: "Reputation Management",
    targetDescription: "Targets businesses with low ratings or low review volume needing review funnels",
    evaluateOpportunity: (t, e, s) => {
      const i = [], n = [], a = t.rating, l = t.review_count || 0;
      return a !== null && a < 4 && l >= 10 ? (n.push("sig_rating_poor", "sig_opp_low_rate_high_rev"), i.push(
        `Sub-optimal rating (${a.toFixed(1)} stars across ${l} reviews) indicates urgent reputation repair need.`
      ), {
        profileId: "reputation",
        profileName: "Reputation Management",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : l <= 10 && l > 0 ? (n.push("sig_reviews_low"), i.push(`Low review volume (${l} reviews) needs automated review generation funnels.`), {
        profileId: "reputation",
        profileName: "Reputation Management",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push(`Healthy star rating (${(a == null ? void 0 : a.toFixed(1)) || "N/A"}) with sufficient customer volume.`), {
        profileId: "reputation",
        profileName: "Reputation Management",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  },
  social_media: {
    id: "social_media",
    name: "Social Media Marketing",
    targetDescription: "Targets businesses with missing social presence or reliance on social-only channels",
    evaluateOpportunity: (t, e, s) => {
      var r;
      const i = [], n = [], a = ((r = t.social_links) == null ? void 0 : r.length) || 0, l = t.review_count || 0, o = t.website_status === "social_only";
      return a === 0 && l >= 20 ? (n.push("sig_no_social"), i.push(`Active business (${l} reviews) has no linked social media channels on Google Maps.`), {
        profileId: "social_media",
        profileName: "Social Media Marketing",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : o ? (n.push("sig_social_only"), i.push("Business relies exclusively on social profiles without integrated branding."), {
        profileId: "social_media",
        profileName: "Social Media Marketing",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push("Listing has connected social profiles or minimal digital demand."), {
        profileId: "social_media",
        profileName: "Social Media Marketing",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  },
  ads: {
    id: "ads",
    name: "Paid Ads & PPC Scaling",
    targetDescription: "Finds mature businesses with websites and high ratings ready for traffic scaling",
    evaluateOpportunity: (t, e, s) => {
      const i = [], n = [], a = t.website_status === "website", l = !!(t.phone && t.phone.trim().length >= 6), o = t.rating || 0, r = t.review_count || 0;
      return a && l && o >= 4.2 && r >= 25 && s >= 65 ? (n.push("sig_web_and_social", "sig_full_contact", "sig_rating_excellent"), i.push(
        `Solid foundation (${s}/100 digital score, ${o.toFixed(1)} rating, website + phone) ready for paid ad acquisition.`
      ), {
        profileId: "ads",
        profileName: "Paid Ads & PPC Scaling",
        opportunityLevel: "high",
        matchedSignals: n,
        reasons: i
      }) : a && (l || r >= 10) ? (n.push("sig_phone_available"), i.push("Active website present. Potential candidate for targeted local campaigns."), {
        profileId: "ads",
        profileName: "Paid Ads & PPC Scaling",
        opportunityLevel: "medium",
        matchedSignals: n,
        reasons: i
      }) : (i.push("Missing core conversion infrastructure (website or direct phone line) for paid advertising."), {
        profileId: "ads",
        profileName: "Paid Ads & PPC Scaling",
        opportunityLevel: "low",
        matchedSignals: n,
        reasons: i
      });
    }
  }
};
function Ys(t) {
  let e = 0;
  t.website_status === "website" ? e += 30 : t.website_status === "social_only" && (e += 15), t.phone && t.phone.trim().length >= 6 && (e += 15), t.address && t.address.trim().length >= 5 && (e += 10);
  const s = t.rating;
  s !== null && s >= 4 ? e += 15 : s !== null && s >= 3 ? e += 10 : s !== null && s > 0 && (e += 5);
  const i = t.review_count || 0;
  return i >= 50 ? e += 10 : i >= 10 ? e += 5 : i > 0 && (e += 2), t.opening_hours && t.opening_hours.length > 0 && (e += 5), t.description && t.description.trim().length > 10 && (e += 5), t.social_links && t.social_links.length > 0 && (e += 5), t.business_status === "operational" && (e += 5), Math.min(100, Math.max(0, e));
}
function me(t, e = "general") {
  var L;
  const s = [], i = t.website_status === "website", n = t.website_status === "social_only", a = t.website_status === "none", l = t.social_links && t.social_links.length > 0, o = !!(t.phone && t.phone.trim().length >= 6), r = !!(t.address && t.address.trim().length >= 5), c = t.rating, u = t.review_count || 0, d = t.missing_fields || [];
  a ? s.push({
    id: "sig_no_website",
    label: "No Website",
    category: "online_presence",
    description: "No dedicated conventional website domain detected.",
    evidence: "Website field is unpopulated."
  }) : n ? s.push({
    id: "sig_social_only",
    label: "Social Only",
    category: "online_presence",
    description: "Listing links only to social media profiles without a dedicated website.",
    evidence: `Social channels detected: ${((L = t.social_links) == null ? void 0 : L.join(", ")) || "None"}.`
  }) : i && l && s.push({
    id: "sig_web_and_social",
    label: "Website + Social",
    category: "online_presence",
    description: "Maintains both an active website domain and linked social channels.",
    evidence: `Website: ${t.website}, Social: ${t.social_links.length} profiles.`
  }), l || s.push({
    id: "sig_no_social",
    label: "No Social Links",
    category: "online_presence",
    description: "No linked social media channels discovered on listing.",
    evidence: "Social links array is empty."
  }), o ? s.push({
    id: "sig_phone_available",
    label: "Phone Available",
    category: "contactability",
    description: "Direct telephone contact is listed and accessible.",
    evidence: `Phone: ${t.phone}`
  }) : s.push({
    id: "sig_phone_missing",
    label: "Phone Missing",
    category: "contactability",
    description: "No phone number listed on Google Maps profile.",
    evidence: "Phone field is empty."
  }), o && r && s.push({
    id: "sig_full_contact",
    label: "Full Contact Info",
    category: "contactability",
    description: "Both direct phone and physical address are verified.",
    evidence: `Phone: ${t.phone}, Address: ${t.address}`
  }), c !== null && c >= 4.5 ? s.push({
    id: "sig_rating_excellent",
    label: "Rating 4.5+",
    category: "reputation",
    description: "Highly rated business with strong customer satisfaction.",
    evidence: `Star rating: ${c.toFixed(1)} / 5.0`
  }) : c !== null && c < 4 && c > 0 && s.push({
    id: "sig_rating_poor",
    label: "Rating Under 4.0",
    category: "reputation",
    description: "Below-average rating represents reputation repair opportunity.",
    evidence: `Star rating: ${c.toFixed(1)} / 5.0`
  }), u >= 100 ? s.push({
    id: "sig_reviews_high",
    label: "100+ Reviews",
    category: "reputation",
    description: "Strong public proof with high customer review volume.",
    evidence: `${u} verified reviews recorded.`
  }) : u <= 10 && u > 0 ? s.push({
    id: "sig_reviews_low",
    label: "10 or Fewer Reviews",
    category: "reputation",
    description: "Low review volume indicates need for review generation.",
    evidence: `Only ${u} reviews recorded.`
  }) : (u === 0 || c === null) && s.push({
    id: "sig_unreviewed",
    label: "No Reviews",
    category: "reputation",
    description: "Listing has zero customer reviews on Google Maps.",
    evidence: "Review count is 0 or unlisted."
  }), d.length === 0 ? s.push({
    id: "sig_profile_complete",
    label: "Complete Profile",
    category: "profile",
    description: "All core business information fields are populated.",
    evidence: "No missing fields flagged."
  }) : s.push({
    id: "sig_profile_incomplete",
    label: "Incomplete Profile",
    category: "profile",
    description: "Listing has missing information fields.",
    evidence: `Missing fields: ${d.join(", ")}`
  }), u >= 30 && a && s.push({
    id: "sig_opp_high_rev_no_site",
    label: "High Reviews / No Website",
    category: "opportunity",
    description: "Established business with proven customer demand but no web portal.",
    evidence: `${u} reviews recorded, but website is missing.`
  }), c !== null && c >= 4.5 && a && s.push({
    id: "sig_opp_high_rate_no_site",
    label: "High Rating / No Website",
    category: "opportunity",
    description: "Quality business with top ratings lacking a conversion website.",
    evidence: `${c.toFixed(1)} rating, but website is missing.`
  }), u >= 30 && n && s.push({
    id: "sig_opp_high_rev_social",
    label: "High Reviews / Social Only",
    category: "opportunity",
    description: "Active customer volume relying exclusively on third-party social pages.",
    evidence: `${u} reviews recorded, social only presence.`
  }), c !== null && c < 4 && u >= 20 && s.push({
    id: "sig_opp_low_rate_high_rev",
    label: "Low Rating / Active Reviews",
    category: "opportunity",
    description: "High traffic business suffering from reputation and sentiment issues.",
    evidence: `${c.toFixed(1)} rating across ${u} reviews.`
  }), d.length >= 2 && u >= 15 && s.push({
    id: "sig_opp_incomplete_active",
    label: "Incomplete / Active Business",
    category: "opportunity",
    description: "Active business with an unmanaged or poorly configured Google listing.",
    evidence: `${d.length} missing fields with ${u} reviews.`
  });
  let h = "no_presence";
  i && l ? h = "website_and_social" : i ? h = "website_only" : n && (h = "social_only");
  let p = "unreachable";
  o && r ? p = "complete" : o ? p = "phone_only" : r && (p = "address_only");
  let f = "unreviewed";
  c !== null && c >= 4.5 ? f = "excellent" : c !== null && c >= 4 ? f = "good" : c !== null && c > 0 && (f = "poor");
  let m = "none";
  u >= 100 ? m = "high" : u >= 25 ? m = "moderate" : u > 0 && (m = "low");
  const b = 8, _ = Math.max(0, b - d.length), T = Math.round(_ / b * 100), I = Ys(t), S = {};
  for (const [U, z] of Object.entries(Xs))
    S[U] = z.evaluateOpportunity(t, s, I);
  const D = S[e] || S.general;
  return {
    digitalMaturityScore: I,
    onlinePresenceType: h,
    contactabilityTier: p,
    reputationTier: f,
    reviewVolumeTier: m,
    profileCompletenessPercentage: T,
    signals: s,
    activeNiche: D,
    nicheQualifications: S
  };
}
const Zs = [
  "extraction_status",
  "business_name",
  "primary_category",
  "secondary_categories",
  "rating",
  "review_count",
  "price_level",
  "phone",
  "phone_raw",
  "phone_normalized",
  "phone_country",
  "phone_country_calling_code",
  "whatsapp_link",
  "website",
  "website_status",
  "social_links",
  "address",
  "latitude",
  "longitude",
  "plus_code",
  "maps_url",
  "business_status",
  "opening_hours",
  "description",
  "service_options",
  "attributes",
  "missing_fields",
  "error_fields",
  "extraction_timestamp",
  "source_platform"
], ei = [
  "digital_maturity_score",
  "opportunity_level",
  "niche_profile",
  "lead_signals",
  "lead_reasons"
], ti = [
  "record_id",
  "place_identifier",
  "duplicate_of"
];
function _t(t) {
  const e = /[",\r\n]/.test(t), s = t.replace(/"/g, '""');
  return e ? `"${s}"` : s;
}
function si(t) {
  return !t || !Array.isArray(t) || t.length === 0 ? "" : t.map((e) => `${e.day}: ${e.hours}`).join("; ");
}
function ii(t, e, s = "", i = "general") {
  if (e === "digital_maturity_score" || e === "lead_score") {
    const a = me(t, i);
    return String(a.digitalMaturityScore);
  }
  if (e === "opportunity_level")
    return me(t, i).activeNiche.opportunityLevel;
  if (e === "niche_profile")
    return me(t, i).activeNiche.profileName;
  if (e === "lead_signals") {
    const a = me(t, i);
    return a.signals.length === 0 ? s : a.signals.map((l) => l.label).join("; ");
  }
  if (e === "lead_reasons") {
    const a = me(t, i);
    return a.activeNiche.reasons.length === 0 ? s : a.activeNiche.reasons.join("; ");
  }
  const n = t[e];
  if (n == null)
    return s;
  if (e === "opening_hours")
    return si(n) || s;
  if (Array.isArray(n))
    return n.length === 0 ? s : n.join("; ");
  if (typeof n == "string") {
    const a = n.trim();
    return a === "" ? s : a;
  }
  return String(n);
}
function ni(t, e = {}) {
  const {
    includeInternalIdentifiers: s = !1,
    includeLeadIntelligence: i = !0,
    nicheProfileId: n = "general",
    missingPlaceholder: a = "",
    includeDuplicates: l = !1
  } = e;
  let o;
  e.columns ? o = [...e.columns] : (o = [...Zs], i && (o = [...o, ...ei])), s && (o = [...o, ...ti]);
  const r = l ? t : t.filter((d) => d.extraction_status !== "duplicate"), c = o.map((d) => _t(String(d))).join(","), u = r.map(
    (d) => o.map(
      (h) => _t(ii(d, h, a, n))
    ).join(",")
  );
  return "\uFEFF" + [c, ...u].join(`\r
`);
}
function ai(t, e, s = {}) {
  const {
    includeDuplicates: i = !1,
    includeLeadIntelligence: n = !0,
    nicheProfileId: a = "general"
  } = s;
  let l = e, o = 0;
  i || (l = e.filter((p) => p.extraction_status !== "duplicate"), o = e.length - l.length);
  const r = l.filter(
    (p) => p.extraction_status === "complete"
  ).length, c = l.filter(
    (p) => p.extraction_status === "partial"
  ).length, u = l.filter(
    (p) => p.extraction_status === "failed"
  ).length, d = l.map((p) => {
    if (!n) return p;
    const f = me(p, a);
    return {
      ...p,
      lead_intelligence: {
        digital_maturity_score: f.digitalMaturityScore,
        online_presence_type: f.onlinePresenceType,
        contactability_tier: f.contactabilityTier,
        reputation_tier: f.reputationTier,
        review_volume_tier: f.reviewVolumeTier,
        profile_completeness_percentage: f.profileCompletenessPercentage,
        active_niche: {
          profile_id: f.activeNiche.profileId,
          profile_name: f.activeNiche.profileName,
          opportunity_level: f.activeNiche.opportunityLevel,
          reasons: f.activeNiche.reasons
        },
        signals: f.signals.map((m) => ({
          id: m.id,
          label: m.label,
          category: m.category,
          description: m.description,
          evidence: m.evidence
        }))
      }
    };
  }), h = {
    export_metadata: {
      export_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source_platform: t.platform || "google_maps",
      search_context: {
        query: t.searchContext.query,
        source_url: t.sourceUrl
      },
      total_records: l.length,
      successful_records: r,
      partial_records: c,
      failed_records: u,
      duplicate_records_excluded: o,
      tool_version: "1.0.0"
    },
    businesses: d
  };
  return JSON.stringify(h, null, 2);
}
function ri(t) {
  if (!t || t.length === 0) return "";
  let e = "";
  for (const s of t) {
    if (!s.phone_normalized && !s.phone || s.website_status === "website" || s.website && s.website.trim() !== "")
      continue;
    const i = s.business_name || "Unknown Business", n = s.phone_normalized || s.phone || "";
    e += `BEGIN:VCARD\r
`, e += `VERSION:3.0\r
`, e += `FN:${i}\r
`, e += `ORG:${i}\r
`, n && (e += `TEL;TYPE=WORK,VOICE:${n}\r
`), s.address && (e += `ADR;TYPE=WORK:;;${s.address.replace(/,/g, "\\,")}\r
`), s.primary_category && (e += `NOTE:Category: ${s.primary_category}\r
`), e += `END:VCARD\r
`;
  }
  return e;
}
function y(t, e = "") {
  if (t == null)
    return e;
  let s = "";
  return Array.isArray(t) ? s = t.join("; ") : typeof t == "object" ? s = JSON.stringify(t) : s = String(t), s === "" ? e : s.includes(",") || s.includes('"') || s.includes(`
`) || s.includes("\r") ? `"${s.replace(/"/g, '""')}"` : s;
}
function oi(t, e = {}, s) {
  const i = e.missingPlaceholder ?? "", n = e.includeDuplicates ? t : t.filter((o) => o.extraction_status !== "duplicate"), l = [[
    "business_name",
    "business_id",
    "media_id",
    "source_media_id",
    "source_business_id",
    "review_id",
    "type",
    "source_context",
    "source_url",
    "media_url",
    "embed_url",
    "thumbnail_url",
    "title",
    "caption",
    "width",
    "height",
    "duration",
    "source_platform",
    "extraction_status",
    "extraction_timestamp",
    "missing_fields",
    "error_fields"
  ].join(",")];
  for (const o of n) {
    const r = [
      y(s || "", i),
      y(o.business_id, i),
      y(o.media_id, i),
      y(o.source_media_id, i),
      y(o.source_business_id, i),
      y(o.review_id, i),
      y(o.type, i),
      y(o.source_context, i),
      y(o.source_url, i),
      y(o.media_url, i),
      y(o.embed_url, i),
      y(o.thumbnail_url, i),
      y(o.title, i),
      y(o.caption, i),
      y(o.width, i),
      y(o.height, i),
      y(o.duration, i),
      y(o.source_platform, i),
      y(o.extraction_status, i),
      y(o.extraction_timestamp, i),
      y(o.missing_fields, i),
      y(o.error_fields, i)
    ];
    l.push(r.join(","));
  }
  return l.join(`\r
`);
}
function li(t, e = {}, s) {
  var o, r, c;
  const i = e.missingPlaceholder ?? "", n = e.includeDuplicates ? t : t.filter((u) => u.extraction_status !== "duplicate"), l = [[
    "business_name",
    "business_id",
    "review_id",
    "source_review_id",
    "source_business_id",
    "author_name",
    "author_profile_url",
    "author_review_count",
    "rating",
    "review_date",
    "review_relative_time",
    "review_text",
    "owner_response_text",
    "owner_response_date",
    "review_url",
    "media_count",
    "source_platform",
    "extraction_status",
    "extraction_timestamp",
    "missing_fields",
    "error_fields"
  ].join(",")];
  for (const u of n) {
    const d = [
      y(s || "", i),
      y(u.business_id, i),
      y(u.review_id, i),
      y(u.source_review_id, i),
      y(u.source_business_id, i),
      y(u.author_name, i),
      y(u.author_profile_url, i),
      y(u.author_review_count, i),
      y(u.rating, i),
      y(u.review_date, i),
      y(u.review_relative_time, i),
      y(u.review_text, i),
      y(((o = u.owner_response) == null ? void 0 : o.text) ?? null, i),
      y(((r = u.owner_response) == null ? void 0 : r.date) ?? null, i),
      y(u.review_url, i),
      y(((c = u.media) == null ? void 0 : c.length) || 0, i),
      y(u.source_platform, i),
      y(u.extraction_status, i),
      y(u.extraction_timestamp, i),
      y(u.missing_fields, i),
      y(u.error_fields, i)
    ];
    l.push(d.join(","));
  }
  return l.join(`\r
`);
}
function ci(t, e, s, i = {}) {
  var c, u;
  const n = i.includeDuplicates ? e : e.filter((d) => d.extraction_status !== "duplicate"), a = i.includeDuplicates ? s : s.filter((d) => d.extraction_status !== "duplicate"), l = (t == null ? void 0 : t.record_id) || ((c = e[0]) == null ? void 0 : c.business_id) || ((u = s[0]) == null ? void 0 : u.business_id) || "unknown", o = (t == null ? void 0 : t.business_name) || "Unknown Business", r = {
    export_metadata: {
      format: "business_media_reviews_v1",
      exported_at: (/* @__PURE__ */ new Date()).toISOString(),
      business_id: l,
      business_name: o,
      media_count: n.length,
      review_count: a.length
    },
    business: t || null,
    media: n,
    reviews: a
  };
  return JSON.stringify(r, null, 2);
}
function ui(t) {
  if (!t) return "";
  const e = /\{([^{}]+)\}/;
  let s = t, i = 0;
  const n = 50;
  for (; e.test(s) && i < n; )
    s = s.replace(e, (a, l) => {
      const o = l.split("|");
      return o[Math.floor(Math.random() * o.length)];
    }), i++;
  return s;
}
function di(t) {
  if (!t || !t.trim()) return "your area";
  const e = t.split(",").map((s) => s.trim()).filter(Boolean);
  if (e.length >= 3) {
    const i = e[e.length - 2].replace(/\b\d{4,8}\b/g, "").trim();
    if (i.length > 1) return i;
  } else if (e.length === 2) {
    const s = e[0].replace(/\b\d{4,8}\b/g, "").trim();
    if (s.length > 1) return s;
  }
  return e[0] || "your area";
}
function hi(t, e) {
  if (!t) return "";
  const s = e.business_name ? e.business_name.trim() : "Business Owner", i = e.primary_category ? e.primary_category.trim().toLowerCase() : "local", n = e.address ? e.address.trim() : "", a = di(n), l = e.rating !== null && e.rating !== void 0 ? e.rating.toFixed(1) : "", o = e.review_count !== null && e.review_count !== void 0 ? String(e.review_count) : "";
  return t.replace(/\{business_name\}/gi, s).replace(/\{category\}/gi, i).replace(/\{city\}/gi, a).replace(/\{address\}/gi, n).replace(/\{rating\}/gi, l).replace(/\{review_count\}/gi, o);
}
function pi(t, e) {
  const s = hi(t, e);
  return ui(s);
}
async function _e(t) {
  await (await N()).put("whatsapp_outreach", t);
}
async function fi() {
  const e = await (await N()).getAll("whatsapp_outreach"), s = /* @__PURE__ */ new Set();
  for (const i of e)
    i.phone_normalized && i.status === "sent" && s.add(i.phone_normalized);
  return s;
}
async function mi() {
  return (await (await N()).getAll("whatsapp_outreach")).sort(
    (s, i) => new Date(i.sent_timestamp).getTime() - new Date(s.sent_timestamp).getTime()
  );
}
async function gi() {
  const t = await N();
  let e = await t.getAll("outreach_templates");
  for (const i of Et) {
    const n = e.find((a) => a.template_id === i.template_id);
    (!n || n.content !== i.content || n.title !== i.title) && await t.put("outreach_templates", {
      ...i,
      is_default: i.is_default ? 1 : 0
    });
  }
  return e = await t.getAll("outreach_templates"), e.find((i) => i.template_id === "tpl_default_no_website") && (await t.delete("outreach_templates", "tpl_default_no_website"), e = e.filter((i) => i.template_id !== "tpl_default_no_website")), e.sort((i, n) => i.is_default ? -1 : n.is_default ? 1 : 0);
}
async function bi(t) {
  await (await N()).put("outreach_templates", t);
}
async function _i(t) {
  await (await N()).delete("outreach_templates", t);
}
class wi {
  constructor(e, s, i, n, a, l) {
    v(this, "status", "idle");
    v(this, "queue", []);
    v(this, "template");
    v(this, "settings");
    v(this, "sessionId");
    v(this, "callbacks");
    v(this, "progress", {
      status: "idle",
      totalEligible: 0,
      processedCount: 0,
      sentCount: 0,
      skippedDuplicateCount: 0,
      invalidNumberCount: 0,
      failedCount: 0,
      consecutiveErrors: 0
    });
    v(this, "isHalted", !1);
    v(this, "sleepAbortReject", null);
    v(this, "tabStabilizeDelayMs");
    v(this, "templatePool", []);
    this.queue = e, this.template = s, this.sessionId = i, this.settings = n, this.callbacks = a, this.progress.totalEligible = e.length, this.tabStabilizeDelayMs = (l == null ? void 0 : l.tabStabilizeDelayMs) ?? (n.minDelaySeconds === 0 ? 0 : 2500), this.templatePool = l != null && l.templatePool && l.templatePool.length > 0 ? l.templatePool : [];
  }
  getProgress() {
    return { ...this.progress };
  }
  getStatus() {
    return this.status;
  }
  broadcastUpdate() {
    this.callbacks.broadcastToUI({
      type: "WHATSAPP_CAMPAIGN_PROGRESS",
      progress: this.getProgress()
    });
  }
  logActivity(e, s, i, n, a) {
    this.callbacks.broadcastToUI({
      type: "WHATSAPP_CAMPAIGN_LOG",
      entry: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        businessName: e,
        phone: s,
        status: i,
        messageSnippet: n,
        errorMessage: a
      }
    });
  }
  async sleep(e) {
    return new Promise((s, i) => {
      const n = setTimeout(() => {
        this.sleepAbortReject = null, s();
      }, e);
      this.sleepAbortReject = () => {
        clearTimeout(n), this.sleepAbortReject = null, i(new Error("ABORTED"));
      };
    });
  }
  async start() {
    var s, i, n, a, l;
    if (this.status === "running") return;
    this.status = "running", this.isHalted = !1, this.progress.status = "running", this.broadcastUpdate();
    let e = /* @__PURE__ */ new Set();
    if (this.settings.skipPreviouslyMessaged)
      try {
        e = await fi();
      } catch (o) {
        console.warn("[WhatsApp Orchestrator] Could not load messaged phones", o);
      }
    for (let o = 0; o < this.queue.length && !(this.isHalted || this.status === "stopped"); o++) {
      for (; this.status === "paused" && !(this.isHalted || this.status === "stopped"); )
        await new Promise((f) => setTimeout(f, 500));
      if (this.isHalted || this.status === "stopped") break;
      if (this.progress.sentCount >= this.settings.batchSizeLimit) {
        this.progress.errorAlert = `Batch limit reached (${this.settings.batchSizeLimit} messages). Pausing campaign.`;
        break;
      }
      const r = this.queue[o], c = r.phone_normalized || r.phone || "", u = c.replace(/\D/g, "");
      if (!u || u.length < 8) {
        this.progress.processedCount++, this.progress.failedCount++, this.logActivity(r.business_name, c, "failed", "-", "Invalid phone format"), this.broadcastUpdate();
        continue;
      }
      if (this.settings.skipPreviouslyMessaged && e.has(c)) {
        this.progress.processedCount++, this.progress.skippedDuplicateCount++, this.logActivity(
          r.business_name,
          c,
          "skipped_duplicate",
          "-",
          "Already messaged previously"
        ), this.broadcastUpdate();
        continue;
      }
      const d = await new Promise((f) => {
        chrome.storage.local.get("extractionSettings", (m) => {
          var b;
          f(((b = m == null ? void 0 : m.extractionSettings) == null ? void 0 : b.geminiApiKey) || "");
        });
      });
      this.progress.currentBusinessName = r.business_name, this.broadcastUpdate();
      const h = `https://web.whatsapp.com/send?phone=${u}`;
      let p = null;
      try {
        await this.callbacks.navigateWhatsAppTab(h), this.tabStabilizeDelayMs > 0 && await this.sleep(this.tabStabilizeDelayMs), p = await this.callbacks.sendToWhatsAppTab({
          type: "VERIFY_WHATSAPP_NUMBER"
        });
        const f = `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (p && p.status === "invalid_number") {
          this.progress.invalidNumberCount++, this.progress.processedCount++, await _e({
            outreach_id: f,
            record_id: r.record_id,
            session_id: this.sessionId,
            business_name: r.business_name,
            phone_normalized: c,
            sent_text: "-",
            status: "invalid_number",
            sent_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            error_message: "Phone number is not registered on WhatsApp"
          }), this.logActivity(
            r.business_name,
            c,
            "invalid_number",
            "-",
            "Not on WhatsApp (Dialog auto-dismissed — instant skip)"
          ), this.broadcastUpdate(), this.tabStabilizeDelayMs > 0 && o < this.queue.length - 1 && this.status === "running" && (this.progress.nextDelaySeconds = 1, this.broadcastUpdate(), await this.sleep(1500), this.progress.nextDelaySeconds = void 0, this.broadcastUpdate());
          continue;
        } else if (p && p.status === "auth_required") {
          this.progress.errorAlert = "WhatsApp Web requires QR login. Campaign paused.", this.status = "paused", this.progress.status = "paused", this.broadcastUpdate();
          return;
        } else if (p && !p.success) {
          this.progress.failedCount++, this.progress.processedCount++, this.progress.consecutiveErrors++, await _e({
            outreach_id: f,
            record_id: r.record_id,
            session_id: this.sessionId,
            business_name: r.business_name,
            phone_normalized: c,
            sent_text: "-",
            status: "failed",
            sent_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            error_message: (p == null ? void 0 : p.status) || "Unknown verification failure"
          }), this.logActivity(
            r.business_name,
            c,
            "failed",
            "-",
            (p == null ? void 0 : p.status) || "Verification failed"
          ), this.broadcastUpdate();
          continue;
        }
        let m = "";
        if (d) {
          const _ = this.settings.aiLanguage || "English", T = `I am a web developer sending a cold WhatsApp message to a local business owner who does NOT have a website. Their business name is '${r.business_name}' and their category is '${r.primary_category || "Local Business"}'.
Write a personalized, highly human-sounding, and conversational message in simple ${_}.
Use this exact structure: "Hi {Greeting Name if any, else *Business Name*}, I noticed you don't have a website yet. I know that for a {Category} business, the biggest challenge is {identify a very specific problem they face getting customers, e.g. relying only on referrals}. A professional website solves this by {how a website fixes it, e.g. allowing direct bookings/calls}. We recently built one for a competitor in your area and they've seen great growth. Can I send you a free demo mockup I made for *{Business Name}*?"
CRITICAL RULES:
1. If ${_} is not English, translate the structure gracefully but keep the meaning identical.
2. You MUST include the sentence about the competitor seeing great growth. Do NOT remove it.
3. You MUST end the message with the free demo hook. 
4. Do NOT sound robotic. Do not use placeholders, fill them in with the actual business details. 
5. Format the business name in bold using WhatsApp formatting (like *Business Name*).`;
          let I = 3;
          for (; I > 0 && !m; )
            try {
              this.logActivity(r.business_name, c, "pending", "-", `Generating AI message (Attempt ${4 - I}/3)...`), this.broadcastUpdate();
              const S = new AbortController(), D = setTimeout(() => S.abort(), 15e3), L = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${d}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: S.signal,
                body: JSON.stringify({
                  contents: [{ parts: [{ text: T }] }],
                  generationConfig: { temperature: 0.7 }
                })
              });
              clearTimeout(D);
              const U = await L.json();
              if (U.candidates && ((a = (n = (i = (s = U.candidates[0]) == null ? void 0 : s.content) == null ? void 0 : i.parts) == null ? void 0 : n[0]) != null && a.text))
                m = U.candidates[0].content.parts[0].text.trim(), this.logActivity(r.business_name, c, "pending", m, "AI message generated"), this.broadcastUpdate(), await this.sleep(2e3);
              else
                throw new Error(((l = U.error) == null ? void 0 : l.message) || "No candidates returned.");
            } catch (S) {
              console.error(`[WhatsAppOrchestrator] Gemini API Error (Retries left: ${I - 1}):`, S), this.logActivity(r.business_name, c, "pending", "-", `API Error: ${S.message || S}. Retrying...`), this.broadcastUpdate(), I--, I > 0 && await this.sleep(3e3);
            }
        }
        if (!m) {
          let _ = "";
          d ? _ = "Gemini AI generation failed entirely. Skipping." : _ = "Gemini API Key missing. Skipping AI generation.", this.logActivity(r.business_name, c, "failed", "-", _), await _e({
            outreach_id: f,
            record_id: r.record_id,
            session_id: this.sessionId,
            business_name: r.business_name,
            phone_normalized: c,
            sent_text: "-",
            status: "failed",
            sent_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            error_message: _
          }), this.progress.failedCount++, this.progress.processedCount++, this.broadcastUpdate(), this.tabStabilizeDelayMs > 0 && o < this.queue.length - 1 && this.status === "running" && (this.progress.nextDelaySeconds = 1, this.broadcastUpdate(), await this.sleep(1500), this.progress.nextDelaySeconds = void 0, this.broadcastUpdate());
          continue;
        }
        console.debug("Templates temporarily unused:", this.template, this.templatePool, pi), this.logActivity(r.business_name, c, "pending", m, "Typing message (human simulation)..."), this.broadcastUpdate();
        const b = await this.callbacks.sendToWhatsAppTab({
          type: "EXECUTE_WHATSAPP_SEND",
          text: m,
          leadId: r.record_id
        });
        if (b && b.success ? (this.progress.sentCount++, this.progress.processedCount++, this.progress.consecutiveErrors = 0, e.add(c), await _e({
          outreach_id: f,
          record_id: r.record_id,
          session_id: this.sessionId,
          business_name: r.business_name,
          phone_normalized: c,
          sent_text: m,
          status: "sent",
          sent_timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }), this.logActivity(
          r.business_name,
          c,
          "sent",
          m.slice(0, 60) + "..."
        )) : (this.progress.failedCount++, this.progress.processedCount++, this.progress.consecutiveErrors++, await _e({
          outreach_id: f,
          record_id: r.record_id,
          session_id: this.sessionId,
          business_name: r.business_name,
          phone_normalized: c,
          sent_text: m,
          status: "failed",
          sent_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          error_message: (b == null ? void 0 : b.reason) || "Unknown send failure"
        }), this.logActivity(
          r.business_name,
          c,
          "failed",
          "-",
          (b == null ? void 0 : b.reason) || "Send failed"
        )), this.broadcastUpdate(), o < this.queue.length - 1 && this.status === "running")
          if (!(b != null && b.success))
            this.tabStabilizeDelayMs > 0 && (this.progress.nextDelaySeconds = 1, this.broadcastUpdate(), await this.sleep(1500), this.progress.nextDelaySeconds = void 0, this.broadcastUpdate());
          else {
            const _ = Math.max(6, this.settings.minDelaySeconds), T = Math.max(_ + 1, this.settings.maxDelaySeconds), I = Math.floor(Math.random() * (T - _ + 1)) + _;
            this.progress.nextDelaySeconds = I, this.broadcastUpdate();
            for (let S = I; S > 0 && !(this.isHalted || this.status === "stopped"); S--) {
              for (; this.status === "paused" && !(this.isHalted || this.status === "stopped"); )
                await new Promise((D) => setTimeout(D, 500));
              if (this.isHalted || this.status === "stopped") break;
              this.progress.nextDelaySeconds = S, this.broadcastUpdate(), await this.sleep(1e3);
            }
            this.progress.nextDelaySeconds = void 0, this.broadcastUpdate();
          }
      } catch (f) {
        if ((f == null ? void 0 : f.message) === "ABORTED") {
          if (this.isHalted || this.status === "stopped")
            break;
          for (; this.status === "paused" && !(this.isHalted || this.status === "stopped"); )
            await new Promise((m) => setTimeout(m, 500));
          if (this.isHalted || this.status === "stopped") break;
          continue;
        }
        this.progress.failedCount++, this.progress.processedCount++, this.progress.consecutiveErrors++, this.broadcastUpdate();
      }
    }
    this.status !== "stopped" && this.status !== "paused" && (this.status = "completed", this.progress.status = "completed", this.progress.currentBusinessName = void 0, this.progress.nextDelaySeconds = void 0), this.broadcastUpdate();
  }
  pause() {
    this.status = "paused", this.progress.status = "paused", this.sleepAbortReject && this.sleepAbortReject(), this.broadcastUpdate();
  }
  resume() {
    this.status = "running", this.progress.status = "running", this.progress.errorAlert = void 0, this.broadcastUpdate();
  }
  stop() {
    this.status = "stopped", this.isHalted = !0, this.progress.status = "stopped", this.progress.currentBusinessName = void 0, this.progress.nextDelaySeconds = void 0, this.sleepAbortReject && this.sleepAbortReject(), this.broadcastUpdate();
  }
}
async function F(t) {
  const e = await N();
  t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), await e.put("linkedin_sessions", t);
}
async function wt(t) {
  return (await N()).get("linkedin_sessions", t);
}
async function yi() {
  return (await (await N()).getAllFromIndex(
    "linkedin_sessions",
    "updatedAt"
  )).reverse();
}
async function Si(t) {
  const s = (await N()).transaction(
    ["linkedin_sessions", "linkedin_profiles"],
    "readwrite"
  );
  let n = await s.objectStore("linkedin_profiles").index("sessionId").openCursor(
    IDBKeyRange.only(t)
  );
  for (; n; )
    await n.delete(), n = await n.continue();
  await s.objectStore("linkedin_sessions").delete(t), await s.done;
}
async function Ke(t) {
  await (await N()).put("linkedin_profiles", t);
}
async function ze(t) {
  return (await N()).getAllFromIndex("linkedin_profiles", "sessionId", t);
}
function Te() {
  return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t) => {
    const e = Math.random() * 16 | 0;
    return (t === "x" ? e : e & 3 | 8).toString(16);
  });
}
function yt(t, e) {
  const s = (/* @__PURE__ */ new Date()).toISOString();
  return {
    sessionId: Te(),
    platform: "linkedin",
    sourceUrl: t,
    searchQuery: e,
    status: "idle",
    phase: "scraping",
    pauseReason: null,
    createdAt: s,
    updatedAt: s,
    queue: [],
    processedCount: 0,
    connectedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    alreadyConnectedCount: 0,
    pendingCount: 0
  };
}
function Ve(t, e) {
  const s = new Set(
    t.queue.map((n) => n.cardFingerprint)
  );
  let i = 0;
  for (const n of e) {
    if (s.has(n.cardFingerprint)) continue;
    s.add(n.cardFingerprint);
    const a = {
      queueId: Te(),
      sessionId: t.sessionId,
      discoveryIndex: n.discoveryIndex ?? t.queue.length,
      status: "queued",
      profileUrl: n.profileUrl,
      profileType: n.profileType,
      name: n.name,
      headline: n.headline,
      location: n.location,
      profileId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: n.cardFingerprint
    };
    t.queue.push(a), i++;
  }
  return t.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), { addedCount: i };
}
function vi(t) {
  return t.queue.find((e) => e.status === "queued") || null;
}
const Ii = 2, Ei = 5, Ai = 5, Ci = 8;
class Ti {
  constructor(e, s) {
    v(this, "session");
    v(this, "callbacks");
    v(this, "isLoopRunning", !1);
    v(this, "consecutiveFailures", 0);
    v(this, "loopPromise", null);
    this.session = e, this.callbacks = s;
  }
  getSession() {
    return this.session;
  }
  setSession(e) {
    this.session = e;
  }
  getStatus() {
    return this.session.status;
  }
  // ---------- Lifecycle ----------------------------------------------------
  async start() {
    this.session.status !== "running" && (this.session.status = "running", this.session.pauseReason = null, await F(this.session), this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session
    }), this.loopPromise = this.runLoop());
  }
  async pause(e = "user") {
    this.session.status = "paused", this.session.pauseReason = e, await F(this.session), this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session
    });
  }
  async resume() {
    this.session.status !== "running" && (this.session.status = "running", this.session.pauseReason = null, this.consecutiveFailures = 0, await F(this.session), this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session
    }), this.loopPromise = this.runLoop());
  }
  async stop() {
    if (this.session.phase === "scraping") {
      this.session.phase = "connecting", await F(this.session), this.callbacks.broadcastToUI({
        type: "LINKEDIN_SESSION_UPDATED",
        session: this.session
      });
      return;
    }
    this.session.status = "stopped", this.session.completionReason = "user_stopped", await F(this.session), this.callbacks.broadcastToUI({
      type: "LINKEDIN_SESSION_UPDATED",
      session: this.session
    });
  }
  async waitForCompletion() {
    return this.loopPromise && await this.loopPromise, this.session;
  }
  // ---------- Main processing loop -----------------------------------------
  async runLoop() {
    if (!this.isLoopRunning) {
      this.isLoopRunning = !0;
      try {
        this.session.phase || (this.session.phase = "scraping", await F(this.session)), this.session.phase === "scraping" && await this.runScrapingPhase(), this.session.phase === "connecting" && this.session.status === "running" && await this.runConnectingPhase();
      } finally {
        this.isLoopRunning = !1;
      }
    }
  }
  // ---------- Phase 1: Scrape all pages -------------------------------------
  async runScrapingPhase() {
    for (; this.session.phase === "scraping" && this.session.status === "running"; ) {
      try {
        const e = await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_SCAN_RESULT_CARDS" },
          12e3
        );
        if (e != null && e.cards && e.cards.length > 0) {
          const { addedCount: s } = Ve(this.session, e.cards);
          s > 0 && (await F(this.session), this.callbacks.broadcastToUI({
            type: "LINKEDIN_SESSION_UPDATED",
            session: this.session
          }));
        }
      } catch (e) {
        console.debug("[LinkedInOrchestrator] Scan cards error:", e);
      }
      if (this.session.status !== "running" || this.session.phase !== "scraping") break;
      try {
        const e = await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_CHECK_NEXT_PAGE" },
          5e3
        );
        if (e != null && e.hasNextPage)
          await this.callbacks.sendToLinkedIn(
            { type: "LINKEDIN_GO_NEXT_PAGE" },
            1e4
          ), await B(4e3 + Math.floor(Math.random() * 2e3));
        else {
          this.session.phase = "connecting", await F(this.session), this.callbacks.broadcastToUI({
            type: "LINKEDIN_SESSION_UPDATED",
            session: this.session
          });
          break;
        }
      } catch (e) {
        console.debug("[LinkedInOrchestrator] Next page check error:", e), this.session.phase = "connecting", await F(this.session), this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
        break;
      }
    }
  }
  // ---------- Phase 2: Connect profiles -------------------------------------
  async runConnectingPhase() {
    for (; this.session.phase === "connecting" && this.session.status === "running"; ) {
      let e = vi(this.session);
      if (!e) {
        this.session.status = "completed", this.session.completionReason = "results_exhausted", await F(this.session), this.callbacks.broadcastToUI({
          type: "LINKEDIN_SESSION_UPDATED",
          session: this.session
        });
        break;
      }
      if (await this.processProfile(e), this.session.status !== "running") break;
      const s = Ce(Ai, Ci);
      s > 0 && await B(s);
    }
  }
  // ---------- Process a single profile item ---------------------------------
  async processProfile(e) {
    e.status = "processing", this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
    try {
      await this.callbacks.sendToLinkedIn(
        { type: "LINKEDIN_OPEN_PROFILE", profileUrl: e.profileUrl, queueId: e.queueId },
        8e3
      ), await B(1e3 + Math.floor(Math.random() * 800));
      const s = await this.callbacks.sendToLinkedIn(
        { type: "LINKEDIN_EXTRACT_PROFILE", queueId: e.queueId },
        12e3
      );
      let i = "none", n = [], a = "";
      if (s != null && s.navigating || (s == null ? void 0 : s.websiteStatus) === "navigating_to_contact_info") {
        await B(800 + Math.floor(Math.random() * 700));
        const c = await this.callbacks.sendToLinkedIn(
          { type: "LINKEDIN_EXTRACT_PROFILE", queueId: e.queueId },
          12e3
        );
        i = (c == null ? void 0 : c.websiteStatus) || "none", n = (c == null ? void 0 : c.foundUrls) || [], a = (c == null ? void 0 : c.headline) || "";
      } else
        i = (s == null ? void 0 : s.websiteStatus) || "none", n = (s == null ? void 0 : s.foundUrls) || [], a = (s == null ? void 0 : s.headline) || "";
      a && (e.headline = a);
      let l = "queued";
      i === "website" ? (l = "skipped_has_website", e.status = "skipped", this.session.skippedCount += 1) : (l = "queued", e.status = "complete", this.session.connectedCount += 1);
      const o = Te();
      e.profileId = o;
      const r = {
        profileId: o,
        sessionId: this.session.sessionId,
        profileUrl: e.profileUrl,
        // profile URL saved for future use
        profileType: e.profileType,
        name: e.name,
        headline: e.headline || "",
        location: e.location || "",
        websiteStatus: i,
        foundUrls: n,
        connectionStatus: l,
        extractionTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      await Ke(r), this.session.processedCount += 1, this.consecutiveFailures = 0, await F(this.session), this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile: r }), this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
    } catch (s) {
      const i = s instanceof Error ? s.message : String(s);
      if (console.debug(`[LinkedInOrchestrator] Profile "${e.name}" failed (retry ${e.retryCount}):`, i), e.retryCount += 1, e.lastError = i, e.retryCount <= Ii)
        e.status = "queued", await B(3e3 * e.retryCount);
      else {
        e.status = "failed", this.session.failedCount += 1, this.session.processedCount += 1;
        const n = Te();
        e.profileId = n;
        const a = {
          profileId: n,
          sessionId: this.session.sessionId,
          profileUrl: e.profileUrl,
          profileType: e.profileType,
          name: e.name,
          headline: e.headline || "",
          location: e.location || "",
          websiteStatus: "none",
          foundUrls: [],
          connectionStatus: "failed",
          extractionTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
          error: i
        };
        await Ke(a), this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile: a }), i.includes("timed out") || i.includes("message channel closed") || i.includes("Receiving end does not exist") || i.includes("navigating") || (this.consecutiveFailures += 1);
      }
      if (this.consecutiveFailures >= Ei) {
        await this.pause("error_threshold");
        return;
      }
      await F(this.session), this.callbacks.broadcastToUI({ type: "LINKEDIN_SESSION_UPDATED", session: this.session });
    }
  }
}
function Y(t) {
  const e = t == null ? "" : String(t);
  return e.includes(",") || e.includes('"') || e.includes(`
`) ? `"${e.replace(/"/g, '""')}"` : e;
}
function xi(t) {
  const e = [
    "Name",
    "Headline",
    "Location",
    "Profile URL",
    "Website Status",
    "Found URLs",
    "Connection Status",
    "Extraction Timestamp",
    "Error"
  ], s = t.map((i) => [
    Y(i.name),
    Y(i.headline),
    Y(i.location),
    Y(i.profileUrl),
    Y(i.websiteStatus),
    Y(i.foundUrls.join(" | ")),
    Y(i.connectionStatus),
    Y(i.extractionTimestamp),
    Y(i.error)
  ]);
  return [e.join(","), ...s.map((i) => i.join(","))].join(`
`);
}
function Di(t, e) {
  return JSON.stringify(
    {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      session: {
        sessionId: t.sessionId,
        platform: t.platform,
        sourceUrl: t.sourceUrl,
        searchQuery: t.searchQuery,
        status: t.status,
        processedCount: t.processedCount,
        connectedCount: t.connectedCount,
        skippedCount: t.skippedCount,
        failedCount: t.failedCount,
        alreadyConnectedCount: t.alreadyConnectedCount,
        pendingCount: t.pendingCount,
        createdAt: t.createdAt,
        completionReason: t.completionReason
      },
      profiles: e
    },
    null,
    2
  );
}
const Oe = (t) => new Promise((e) => setTimeout(e, t)), St = (t, e) => Math.floor(Math.random() * (e - t + 1)) + t, Ni = [
  "Hi {name}, I noticed your profile and was impressed by your work. I specialize in building high-converting websites and funnels. Would you be open to a quick chat about upgrading your online presence?",
  "Hello {name}! I help professionals like you establish a premium web presence. Are you currently looking to revamp or build a new website?",
  "Hi {name}, I'm reaching out because I design custom websites that help professionals stand out. I'd love to connect and share some ideas for your personal brand.",
  "Hey {name}, great profile! If you ever need a professional website or landing page to showcase your services, let's connect. I'd love to help.",
  "Hi {name}, just wanted to connect. I build tailored websites for industry experts and thought you might be interested in a quick brainstorm session about your digital presence."
], Pi = [
  "Hi, I noticed {name} on LinkedIn and love what you're doing. I help businesses scale with high-converting websites and funnels. Would you be open to a quick chat?",
  "Hello team at {name}! A strong digital presence is key to growth. I specialize in building custom websites for businesses in your space. Are you looking to upgrade your current site?",
  "Hi, I help companies like {name} generate more leads through optimized web design. I'd love to connect and see if we can help you grow.",
  "Hey there, great page! I build professional websites and landing pages for businesses. Let me know if {name} needs any help standing out online.",
  "Hi, I was exploring your page and wanted to connect. If {name} ever needs a website revamp or a new funnel to drive sales, I'd love to assist."
];
class ki {
  constructor(e, s, i) {
    v(this, "sessionId");
    v(this, "callbacks");
    v(this, "isLoopRunning", !1);
    v(this, "loopPromise", null);
    v(this, "currentTabId", null);
    v(this, "progress", {
      status: "idle",
      totalEligible: 0,
      processedCount: 0,
      sentCount: 0,
      skippedDuplicateCount: 0,
      invalidNumberCount: 0,
      failedCount: 0,
      consecutiveErrors: 0
    });
    v(this, "settings");
    this.sessionId = e, this.callbacks = s, this.settings = i || {};
  }
  getProgress() {
    return this.progress;
  }
  broadcastProgress() {
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_CAMPAIGN_PROGRESS",
      progress: this.progress
    });
  }
  broadcastLog(e) {
    this.callbacks.broadcastToUI({
      type: "LINKEDIN_CAMPAIGN_LOG",
      entry: e
    });
  }
  async start() {
    this.isLoopRunning || (this.isLoopRunning = !0, this.progress.status = "running", this.broadcastProgress(), this.loopPromise = this.loop());
  }
  pause() {
    this.isLoopRunning = !1, this.progress.status = "paused", this.broadcastProgress();
  }
  async stop() {
    this.isLoopRunning = !1, this.progress.status = "stopped", this.broadcastProgress(), this.currentTabId && (await this.callbacks.closeTab(this.currentTabId), this.currentTabId = null), this.loopPromise && await this.loopPromise;
  }
  async waitForPageLoadAndMessage(e, s) {
    for (let i = 0; i < 15; i++) {
      if (!this.isLoopRunning) return null;
      await Oe(1e3);
      try {
        const n = await this.callbacks.sendMessageToTab(e, { type: "PING" });
        if (n != null && n.pong)
          return await Oe(2e3), await this.callbacks.sendMessageToTab(e, s);
      } catch {
      }
    }
    return { success: !1, reason: "timeout_waiting_for_page" };
  }
  async loop() {
    var e, s, i, n, a;
    try {
      const l = await ze(this.sessionId), o = l.filter((r) => !r.campaignMessageSent);
      this.progress.totalEligible = l.length, this.progress.processedCount = l.length - o.length, this.progress.skippedDuplicateCount = this.progress.processedCount, this.broadcastProgress(), console.log(`[LinkedInCampaignOrchestrator] Starting campaign for ${o.length} profiles.`);
      for (const r of o) {
        if (!this.isLoopRunning) break;
        if (this.progress.processedCount++, !r.profileUrl) {
          this.progress.invalidNumberCount++, this.broadcastProgress();
          continue;
        }
        console.log(`[LinkedInCampaignOrchestrator] Messaging: ${r.name} (${r.profileUrl})`);
        try {
          this.currentTabId = await this.callbacks.openTab(r.profileUrl);
          const u = await new Promise((p) => {
            chrome.storage.local.get("extractionSettings", (f) => {
              var m;
              p(((m = f == null ? void 0 : f.extractionSettings) == null ? void 0 : m.geminiApiKey) || "");
            });
          });
          let d = "";
          if (u) {
            const p = this.settings.aiLanguage || "English", f = `I am a web developer sending a cold DM to a founder on LinkedIn who does NOT have a website. The recipient's name is '${r.name}' and their bio is '${r.headline || "Not available"}'.
Write a personalized, highly human-sounding, and conversational message in simple ${p}.
Use this exact structure: "Hi {Greeting Name}, I noticed you don't have a website yet. I know that for a {Bio/Category} business, the biggest challenge is {identify a very specific problem they face getting customers, e.g. relying only on referrals}. A professional website solves this by {how a website fixes it, e.g. allowing direct bookings/calls}. We recently built one for a competitor in your area and they've seen great growth. Can I send you a free demo mockup I made for *your business*?"
CRITICAL RULES:
1. If ${p} is not English, translate the structure gracefully but keep the meaning identical.
2. You MUST include the sentence about the competitor seeing great growth. Do NOT remove it.
3. You MUST end the message with the free demo hook.
4. Do NOT sound robotic. Do not use placeholders, fill them in with the actual business details. 
5. Format any business names in bold (like *Business Name*).`;
            try {
              console.log(`[LinkedInCampaignOrchestrator] Requesting Gemini message for ${r.name}...`), this.progress.statusText = `Generating AI message for ${r.name}...`, this.broadcastProgress();
              let m = 3;
              for (; m > 0 && !d; )
                try {
                  this.progress.statusText = `Generating AI message for ${r.name} (Attempt ${4 - m}/3)...`, this.broadcastProgress();
                  const b = new AbortController(), _ = setTimeout(() => b.abort(), 15e3), T = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${u}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: b.signal,
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: f }] }],
                      generationConfig: { temperature: 0.7 }
                    })
                  });
                  clearTimeout(_);
                  const I = await T.json();
                  if (I.candidates && ((n = (i = (s = (e = I.candidates[0]) == null ? void 0 : e.content) == null ? void 0 : s.parts) == null ? void 0 : i[0]) != null && n.text))
                    d = I.candidates[0].content.parts[0].text.trim(), console.log(`[LinkedInCampaignOrchestrator] Generated AI message for ${r.name}.`), this.progress.statusText = `AI Message ready: ${d.slice(0, 60)}...`, this.broadcastProgress(), await new Promise((S) => setTimeout(S, 2e3));
                  else
                    throw new Error(((a = I.error) == null ? void 0 : a.message) || "No candidates returned.");
                } catch (b) {
                  console.error(`[LinkedInCampaignOrchestrator] Gemini API Error (Retries left: ${m - 1}):`, b), m--, m > 0 && await new Promise((_) => setTimeout(_, 3e3));
                }
            } catch (m) {
              console.error("[LinkedInCampaignOrchestrator] Failed during AI wrapper:", m);
            }
          }
          if (!d) {
            this.progress.statusText = "Gemini AI generation failed (Possible 503 error). Skipping.", this.broadcastProgress(), this.broadcastLog({
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              profileName: r.name,
              url: r.profileUrl,
              status: "failed",
              errorMessage: "Gemini AI generation failed. Skipping."
            }), this.progress.failedCount++;
            continue;
          }
          console.debug("Templates temporarily unused:", Pi, Ni, St);
          const h = await this.waitForPageLoadAndMessage(this.currentTabId, {
            type: "LINKEDIN_SEND_DM",
            queueId: r.profileId,
            message: d
          });
          if (!this.isLoopRunning) break;
          h != null && h.success ? (console.log(`[LinkedInCampaignOrchestrator] Message sent to ${r.name}.`), r.campaignMessageSent = !0, r.campaignMessageDate = (/* @__PURE__ */ new Date()).toISOString(), delete r.error, await Ke(r), this.progress.sentCount++, this.progress.consecutiveErrors = 0, this.broadcastLog({
            timestamp: r.campaignMessageDate,
            profileName: r.name,
            url: r.profileUrl,
            status: "sent",
            messageSnippet: d.slice(0, 60) + "..."
          }), this.callbacks.broadcastToUI({ type: "LINKEDIN_PROFILE_SAVED", profile: r })) : (console.warn(`[LinkedInCampaignOrchestrator] Failed to message ${r.name}. Reason: ${h == null ? void 0 : h.reason}`), this.progress.failedCount++, this.progress.consecutiveErrors++, this.broadcastLog({
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            profileName: r.name,
            url: r.profileUrl,
            status: "failed",
            errorMessage: (h == null ? void 0 : h.reason) || "unknown_error"
          }));
        } catch (u) {
          console.error(`[LinkedInCampaignOrchestrator] Error processing ${r.name}:`, u), this.progress.failedCount++, this.progress.consecutiveErrors++, this.broadcastLog({
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            profileName: r.name,
            url: r.profileUrl,
            status: "failed",
            errorMessage: String(u)
          });
        }
        if (this.broadcastProgress(), this.currentTabId && (await this.callbacks.closeTab(this.currentTabId), this.currentTabId = null), !this.isLoopRunning) break;
        const c = St(5e3, 1e4);
        console.log(`[LinkedInCampaignOrchestrator] Waiting ${c}ms before next profile...`), await Oe(c);
      }
      this.isLoopRunning && (this.progress.status = "completed", this.broadcastProgress());
    } catch (l) {
      console.error("[LinkedInCampaignOrchestrator] Fatal error:", l), this.progress.status = "stopped", this.broadcastProgress();
    } finally {
      this.isLoopRunning = !1, this.currentTabId && (await this.callbacks.closeTab(this.currentTabId).catch(() => {
      }), this.currentTabId = null);
    }
  }
}
let g = null, x = null, J = null, E = null, j = null, we = null, V = null, Z = null, w = null, H = null, oe = null, Q = null;
async function Nt() {
  if (Z)
    try {
      const s = await chrome.tabs.get(Z);
      if (s && s.url && s.url.includes("web.whatsapp.com"))
        return Z;
    } catch {
      Z = null;
    }
  const t = await chrome.tabs.query({ url: "*://web.whatsapp.com/*" });
  if (t.length > 0 && t[0].id)
    return Z = t[0].id, Z;
  if (Z = (await chrome.tabs.create({
    url: "https://web.whatsapp.com",
    pinned: !0,
    active: !1
  })).id || null, !Z)
    throw new Error("Failed to create WhatsApp Web tab");
  return await new Promise((s) => setTimeout(s, 3500)), Z;
}
async function Li(t) {
  const e = await Nt();
  await chrome.tabs.update(e, { url: t });
}
async function Ri(t) {
  try {
    await chrome.tabs.sendMessage(t, { type: "CHECK_WHATSAPP_STATE" }).catch(() => null) || (await chrome.scripting.executeScript({
      target: { tabId: t },
      files: ["content-scripts/whatsapp-web/index.js"]
    }), await new Promise((s) => setTimeout(s, 300)));
  } catch (e) {
    console.debug("[Service Worker] Could not inject WhatsApp content script:", e);
  }
}
async function ye(t) {
  try {
    const e = await chrome.tabs.sendMessage(t, { type: "PING" }).catch(() => null);
    e != null && e.pong || (await chrome.scripting.executeScript({
      target: { tabId: t },
      files: ["content-scripts/linkedin/index.js"]
    }), await new Promise((s) => setTimeout(s, 400)));
  } catch (e) {
    console.debug("[Service Worker] Could not inject LinkedIn content script:", e);
  }
}
async function Pt(t, e = 18e3) {
  var s;
  if (!H) {
    const i = await chrome.tabs.query({ url: "*://www.linkedin.com/*" });
    (s = i[0]) != null && s.id && (H = i[0].id);
  }
  if (!H)
    throw new Error("No active LinkedIn tab found. Please open LinkedIn in your browser.");
  return await ye(H), new Promise((i) => {
    const n = setTimeout(() => {
      i({ success: !1, reason: `LinkedIn script timed out after ${e}ms` });
    }, e);
    chrome.tabs.sendMessage(H, t, (a) => {
      if (clearTimeout(n), chrome.runtime.lastError) {
        i({ success: !1, reason: chrome.runtime.lastError.message });
        return;
      }
      i(a);
    });
  });
}
function Ie() {
  if (!w)
    throw new Error("No active LinkedIn session");
  return (!oe || oe.getSession().sessionId !== w.sessionId) && (oe = new Ti(w, {
    sendToLinkedIn: Pt,
    broadcastToUI: R
  })), oe;
}
async function Mi(t, e = 6e7) {
  const s = await Nt();
  return await Ri(s), new Promise((i) => {
    const n = setTimeout(() => {
      i({ success: !1, reason: `WhatsApp script timed out after ${e}ms` });
    }, e);
    chrome.tabs.sendMessage(s, t, (a) => {
      if (clearTimeout(n), chrome.runtime.lastError) {
        i({ success: !1, reason: chrome.runtime.lastError.message });
        return;
      }
      i(a);
    });
  });
}
function R(t) {
  try {
    chrome.runtime.sendMessage(t).catch(() => {
    });
  } catch {
  }
}
async function Ye(t, e = 28e3) {
  var s, i;
  if (!x)
    try {
      const n = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if ((s = n[0]) != null && s.id && n[0].url && (n[0].url.includes("google.com/maps") || n[0].url.includes("maps.google.com")))
        x = n[0].id;
      else {
        const a = await chrome.tabs.query({ url: "*://*.google.com/maps/*" });
        (i = a[0]) != null && i.id && (x = a[0].id);
      }
    } catch {
    }
  if (!x)
    throw new Error("No active Google Maps tab connected");
  return await ee(x), new Promise((n, a) => {
    const l = setTimeout(() => {
      a(new Error(`Content script message timed out after ${e}ms: ${t == null ? void 0 : t.type}`));
    }, e);
    chrome.tabs.sendMessage(x, t, (o) => {
      if (clearTimeout(l), chrome.runtime.lastError) {
        console.debug("[Service Worker] sendToContent error:", chrome.runtime.lastError.message), n(void 0);
        return;
      }
      n(o);
    });
  });
}
async function Oi(t) {
  const e = await Ye({
    type: "OPEN_BUSINESS",
    queueId: t.queueId,
    cardRef: t.cardRef,
    name: t.name,
    discoveryIndex: t.discoveryIndex
  });
  if (e != null && e.raw && e.raw.name)
    return e.raw;
  if (e != null && e.error) {
    if (e.error === "verification_required")
      throw new Error("verification_required");
    if (t.name && (t.phone || t.address || t.category || t.website))
      return console.log(`[Service Worker] Recovering lead "${t.name}" from queueItem data after detail error:`, e.error), {
        name: t.name,
        primaryCategory: t.category || "Local Business",
        rating: t.rating ?? null,
        reviewCount: t.reviewCount ?? null,
        address: t.address || null,
        phone: t.phone || null,
        websiteUrl: t.website || null,
        mapsUrl: t.cardRef || null,
        placeIdentifier: K(t.cardRef)
      };
    throw new Error(`Target detail panel error: ${e.error}`);
  }
  if (t.name && (t.phone || t.address || t.category || t.website))
    return {
      name: t.name,
      primaryCategory: t.category || "Local Business",
      rating: t.rating ?? null,
      reviewCount: t.reviewCount ?? null,
      address: t.address || null,
      phone: t.phone || null,
      websiteUrl: t.website || null,
      mapsUrl: t.cardRef || null,
      placeIdentifier: K(t.cardRef)
    };
  throw new Error("Empty raw extraction received from target detail panel");
}
function fe() {
  if (!g)
    throw new Error("No active session initialized");
  return (!J || J.getSession().sessionId !== g.sessionId) && (J = new Qs(g, {
    sendToContent: Ye,
    broadcastToUI: R,
    requestRawExtraction: Oi
  })), J;
}
async function ee(t) {
  try {
    const e = await chrome.tabs.sendMessage(t, { type: "PING" }).catch(() => null);
    e != null && e.pong || (console.log("[Service Worker] Content script not responding in tab", t, "- injecting..."), await chrome.scripting.executeScript({
      target: { tabId: t },
      files: ["content-scripts/google-maps/index.js"]
    }));
  } catch (e) {
    console.debug("[Service Worker] Could not inject content script:", e);
  }
}
async function Ui() {
  try {
    const t = await chrome.storage.local.get(["activeSessionId", "extractionSettings"]);
    if (t.activeSessionId) {
      const s = await Ae(t.activeSessionId);
      s && s.status !== "stopped" && s.status !== "completed" && (g = s, g.status === "running" && (g.status = "paused", g.pauseReason = "user", await W(g)));
    }
    const e = await chrome.storage.local.get("activeMediaReviewJobId");
    if (e.activeMediaReviewJobId) {
      const s = await Tt(e.activeMediaReviewJobId);
      s && s.status !== "stopped" && s.status !== "completed" && (E = s, E.status === "running" && (E.status = "paused", await G(E)));
    }
  } catch (t) {
    console.debug("[Service Worker] Initialization error:", t);
  }
}
Ui();
const ji = /* @__PURE__ */ new Set([
  "GET_CURRENT_STATE",
  "GET_SETTINGS",
  "UPDATE_SETTINGS",
  "ENSURE_CONTENT_SCRIPT",
  "START_EXTRACTION",
  "PAUSE_EXTRACTION",
  "RESUME_EXTRACTION",
  "STOP_EXTRACTION",
  "RETRY_FAILED",
  "CLEAR_SESSION",
  "GET_ALL_SESSIONS",
  "LOAD_SESSION",
  "DELETE_SESSION",
  "BULK_DELETE_SESSIONS",
  "RENAME_SESSION",
  "SET_ACTIVE_SESSION",
  "SEARCH_PAGE_DETECTED",
  "BUSINESS_CARDS_DISCOVERED",
  "CARDS_DISCOVERED",
  "VERIFICATION_DETECTED",
  "PAGE_SCAN_COMPLETED",
  "CLOSE_ACTIVE_SESSION",
  "CLEAR_ALL_DATA",
  "EXPORT",
  "BUSINESS_PAGE_DETECTED",
  "MEDIA_ITEMS_DISCOVERED",
  "REVIEWS_DISCOVERED",
  "MEDIA_DISCOVERY_EXHAUSTED",
  "REVIEWS_DISCOVERY_EXHAUSTED",
  "START_MEDIA_REVIEW_JOB",
  "PAUSE_MEDIA_REVIEW_JOB",
  "RESUME_MEDIA_REVIEW_JOB",
  "STOP_MEDIA_REVIEW_JOB",
  "GET_MEDIA_REVIEW_JOB",
  "GET_MEDIA_RECORDS",
  "GET_REVIEW_RECORDS",
  "EXPORT_MEDIA_REVIEWS",
  "START_WHATSAPP_CAMPAIGN",
  "PAUSE_WHATSAPP_CAMPAIGN",
  "RESUME_WHATSAPP_CAMPAIGN",
  "STOP_WHATSAPP_CAMPAIGN",
  "GET_WHATSAPP_CAMPAIGN_STATE",
  "GET_WHATSAPP_OUTREACH_HISTORY",
  "GET_WHATSAPP_TEMPLATES",
  "SAVE_WHATSAPP_TEMPLATE",
  "DELETE_WHATSAPP_TEMPLATE",
  "LINKEDIN_PAGE_DETECTED",
  "LINKEDIN_PROFILE_CARDS_DISCOVERED",
  "START_LINKEDIN_SESSION",
  "PAUSE_LINKEDIN_SESSION",
  "RESUME_LINKEDIN_SESSION",
  "STOP_LINKEDIN_SESSION",
  "GET_LINKEDIN_SESSION_STATE",
  "GET_ALL_LINKEDIN_SESSIONS",
  "GET_LINKEDIN_PROFILES",
  "DELETE_LINKEDIN_SESSION",
  "EXPORT_LINKEDIN_PROFILES",
  "START_LINKEDIN_CAMPAIGN"
]);
chrome.runtime.onMessage.addListener((t, e, s) => {
  var i;
  return e.id !== chrome.runtime.id || !t || !t.type || !ji.has(t.type) ? !1 : ((i = e.tab) != null && i.id && (x = e.tab.id), (async () => {
    var n, a, l, o, r, c, u;
    try {
      switch (t.type) {
        case "GET_CURRENT_STATE": {
          const d = await chrome.storage.local.get(["activeSessionId", "extractionSettings"]), h = d.extractionSettings || ge;
          g || d.activeSessionId && (g = await Ae(d.activeSessionId) || null);
          try {
            const m = (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0];
            m != null && m.id && m.url && (m.url.includes("google.com/maps") || m.url.includes("maps.google.com")) && (x = m.id, await ee(m.id), chrome.tabs.sendMessage(m.id, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
            }));
          } catch (f) {
            console.debug("[Service Worker] Tab check on GET_CURRENT_STATE error:", f);
          }
          let p = [];
          g && (p = await Me(g.sessionId)), s({
            session: g,
            records: p,
            settings: h,
            mediaReviewJob: E,
            detectedTarget: we
          });
          break;
        }
        case "GET_SETTINGS": {
          const h = (await chrome.storage.local.get("extractionSettings")).extractionSettings || ge;
          s({ success: !0, settings: h });
          break;
        }
        case "UPDATE_SETTINGS": {
          const d = is(t.settings || {});
          await chrome.storage.local.set({ extractionSettings: d }), g && (g.settingsSnapshot = {
            ...g.settingsSnapshot,
            ...d
          }, await W(g), J && J.setSession(g), R({ type: "SESSION_UPDATED", session: g })), R({ type: "SETTINGS_UPDATED", settings: d }), s({ success: !0, settings: d });
          break;
        }
        case "ENSURE_CONTENT_SCRIPT": {
          let d = t.tabId || x;
          if (!d) {
            const h = await chrome.tabs.query({ active: !0, currentWindow: !0 });
            (n = h[0]) != null && n.id && (d = h[0].id);
          }
          d && (x = d, await ee(d), chrome.tabs.sendMessage(d, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
          })), s({ success: !0 });
          break;
        }
        case "GET_ALL_SESSIONS": {
          const d = await $s();
          s({ sessions: d });
          break;
        }
        case "LOAD_SESSION": {
          const d = await Ae(t.sessionId);
          d && (g = d, await chrome.storage.local.set({ activeSessionId: d.sessionId }), J = null, R({ type: "SESSION_UPDATED", session: g }));
          let h = [];
          g && (h = await Me(g.sessionId)), s({ session: g, records: h });
          break;
        }
        case "SET_ACTIVE_SESSION": {
          const d = await Ae(t.sessionId);
          d && (g = d, await chrome.storage.local.set({ activeSessionId: d.sessionId }), J = null, R({ type: "SESSION_UPDATED", session: g })), s({ session: g });
          break;
        }
        case "RENAME_SESSION": {
          await Gs(t.sessionId, t.newName), g && g.sessionId === t.sessionId && (g.customName = t.newName, R({ type: "SESSION_UPDATED", session: g })), s({ success: !0 });
          break;
        }
        case "DELETE_SESSION": {
          await He(t.sessionId), g && g.sessionId === t.sessionId && (await chrome.storage.local.remove("activeSessionId"), g = null, J = null, R({ type: "SESSION_UPDATED", session: null })), s({ success: !0 });
          break;
        }
        case "BULK_DELETE_SESSIONS": {
          await Hs(t.sessionIds), g && t.sessionIds.includes(g.sessionId) && (await chrome.storage.local.remove("activeSessionId"), g = null, J = null, R({ type: "SESSION_UPDATED", session: null })), s({ success: !0 });
          break;
        }
        case "SEARCH_PAGE_DETECTED": {
          const d = ((a = t.searchContext.query) == null ? void 0 : a.toLowerCase().trim()) || "", h = ((l = g == null ? void 0 : g.searchContext.query) == null ? void 0 : l.toLowerCase().trim()) || "", p = !!(h && d && h === d), f = g == null ? void 0 : g.status;
          if (!g || f === "completed" || f === "stopped" || f === "failed" || !p && f !== "running") {
            const _ = (await chrome.storage.local.get("extractionSettings")).extractionSettings || ge;
            g = gt(
              t.sourceUrl,
              t.searchContext,
              "google_maps",
              _
            ), await W(g), await chrome.storage.local.set({ activeSessionId: g.sessionId }), J = null;
          } else g && f === "idle" && p && (g.sourceUrl = t.sourceUrl, g.searchContext = t.searchContext, await W(g));
          R({ type: "SESSION_UPDATED", session: g }), s({ session: g });
          break;
        }
        case "BUSINESS_CARDS_DISCOVERED": {
          if (g && g.status !== "stopped" && g.status !== "completed") {
            const { addedCount: d } = Ge(g, t.cards);
            d > 0 && (await W(g), R({ type: "SESSION_UPDATED", session: g }));
          }
          s({ success: !0 });
          break;
        }
        case "VERIFICATION_DETECTED": {
          g && g.status === "running" && await fe().pause("verification_required"), s({ success: !0 });
          break;
        }
        case "START_EXTRACTION": {
          if (!x) {
            const f = await chrome.tabs.query({ active: !0, currentWindow: !0 });
            (o = f[0]) != null && o.id && (x = f[0].id);
          }
          if (x && await ee(x), !g && x)
            try {
              await chrome.tabs.sendMessage(x, { type: "TRIGGER_PAGE_SCAN" });
            } catch (f) {
              console.debug("[Service Worker] Rescan during START_EXTRACTION error:", f);
            }
          const h = (await chrome.storage.local.get("extractionSettings")).extractionSettings || ge;
          if (g && (g.status === "completed" || g.status === "stopped") && (g = gt(
            g.sourceUrl,
            g.searchContext,
            "google_maps",
            h
          ), await W(g), await chrome.storage.local.set({ activeSessionId: g.sessionId }), J = null, x))
            try {
              await chrome.tabs.sendMessage(x, { type: "TRIGGER_PAGE_SCAN" });
            } catch {
            }
          if (!g) {
            s({ error: "No active search session found. Please ensure Google Maps search results are open." });
            return;
          }
          g.settingsSnapshot = {
            ...h,
            ...g.settingsSnapshot,
            ...t.settings || {}
          }, await W(g);
          const p = fe();
          p.setSession(g), await p.start(), s({ success: !0, session: g });
          break;
        }
        case "PAUSE_EXTRACTION": {
          g && await fe().pause("user"), s({ success: !0, session: g });
          break;
        }
        case "RESUME_EXTRACTION": {
          g && await fe().resume(), s({ success: !0, session: g });
          break;
        }
        case "STOP_EXTRACTION": {
          g && await fe().stop(), s({ success: !0, session: g });
          break;
        }
        case "RETRY_FAILED": {
          g && await fe().retryFailed(), s({ success: !0, session: g });
          break;
        }
        case "CLOSE_ACTIVE_SESSION":
        case "CLEAR_SESSION": {
          if (g && (await He(g.sessionId), await chrome.storage.local.remove("activeSessionId"), g = null, J = null), R({ type: "SESSION_UPDATED", session: null }), x)
            try {
              await ee(x), chrome.tabs.sendMessage(x, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
              });
            } catch {
            }
          s({ success: !0 });
          break;
        }
        case "CLEAR_ALL_DATA": {
          if (await Yt(), await chrome.storage.local.remove(["activeSessionId", "activeMediaReviewJobId"]), g = null, J = null, E = null, j = null, we = null, R({ type: "SESSION_UPDATED", session: null }), R({ type: "MEDIA_REVIEW_JOB_UPDATED", job: null }), x)
            try {
              await ee(x), chrome.tabs.sendMessage(x, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
              });
            } catch {
            }
          s({ success: !0 });
          break;
        }
        case "EXPORT": {
          if (!g) {
            s({ error: "No session to export" });
            return;
          }
          const d = await Me(g.sessionId), h = (g.searchContext.query || "leads").replace(/[^a-z0-9]/gi, "_").toLowerCase(), p = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 15), f = t.exportSettings || g.settingsSnapshot;
          if (t.format === "csv" || t.format === "both") {
            const m = ni(d, {
              missingPlaceholder: f.csvMissingPlaceholder,
              includeDuplicates: f.includeDuplicateRecords,
              includeInternalIdentifiers: f.includeInternalIdentifiers
            }), b = `business-leads_${h}_${p}.csv`, _ = btoa(unescape(encodeURIComponent(m)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${_}`,
              filename: b,
              saveAs: !1
            });
          }
          if (t.format === "json" || t.format === "both") {
            const m = ai(g, d, {
              includeDuplicates: f.includeDuplicateRecords
            }), b = `business-leads_${h}_${p}.json`, _ = btoa(unescape(encodeURIComponent(m)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${_}`,
              filename: b,
              saveAs: !1
            });
          }
          if (t.format === "vcf" || t.format === "both") {
            const m = ri(d), b = `business-contacts_${h}_${p}.vcf`, _ = btoa(unescape(encodeURIComponent(m)));
            await chrome.downloads.download({
              url: `data:text/vcard;charset=utf-8;base64,${_}`,
              filename: b,
              saveAs: !1
            });
          }
          s({ success: !0 });
          break;
        }
        case "BUSINESS_PAGE_DETECTED": {
          we = t.target, R({ type: "BUSINESS_TARGET_DETECTED", target: t.target }), s({ success: !0 });
          break;
        }
        case "MEDIA_ITEMS_DISCOVERED": {
          E && j && await j.handleMediaDiscovered(t.items), s({ success: !0 });
          break;
        }
        case "REVIEWS_DISCOVERED": {
          E && j && await j.handleReviewsDiscovered(
            t.reviews,
            t.reportedCount
          ), s({ success: !0 });
          break;
        }
        case "MEDIA_DISCOVERY_EXHAUSTED": {
          E && j && await j.handleMediaExhausted(), s({ success: !0 });
          break;
        }
        case "REVIEWS_DISCOVERY_EXHAUSTED": {
          E && j && await j.handleReviewsExhausted(), s({ success: !0 });
          break;
        }
        case "START_MEDIA_REVIEW_JOB": {
          if (!x) {
            const f = await chrome.tabs.query({ active: !0, currentWindow: !0 });
            (r = f[0]) != null && r.id && (x = f[0].id);
          }
          x && await ee(x);
          const d = t.target, p = K(d.maps_url) || `biz_${Date.now()}`;
          E = rt.createJob(
            d,
            p,
            t.settings
          ), await G(E), await chrome.storage.local.set({ activeMediaReviewJobId: E.jobId }), j = new rt(E, {
            sendToContent: Ye,
            broadcastToUI: R
          }), await j.start(), s({ success: !0, job: E });
          break;
        }
        case "PAUSE_MEDIA_REVIEW_JOB": {
          j && await j.pause(t.track || "all"), s({ success: !0, job: E });
          break;
        }
        case "RESUME_MEDIA_REVIEW_JOB": {
          j && await j.resume(t.track || "all"), s({ success: !0, job: E });
          break;
        }
        case "STOP_MEDIA_REVIEW_JOB": {
          j && await j.stop(), s({ success: !0, job: E });
          break;
        }
        case "GET_MEDIA_REVIEW_JOB": {
          if (t.jobId) {
            const d = await Tt(t.jobId);
            s({ job: d || E, target: we });
          } else
            s({ job: E, target: we });
          break;
        }
        case "GET_MEDIA_RECORDS": {
          const d = t.businessId || (E == null ? void 0 : E.businessId) || "", h = await nt(d);
          s({ media: h });
          break;
        }
        case "GET_REVIEW_RECORDS": {
          const d = t.businessId || (E == null ? void 0 : E.businessId) || "", h = await at(d);
          s({ reviews: h });
          break;
        }
        case "EXPORT_MEDIA_REVIEWS": {
          const d = t.businessId || (E == null ? void 0 : E.businessId) || "", h = await nt(d), p = await at(d);
          let f = null;
          d && (f = await zs(d) || null);
          const m = ((f == null ? void 0 : f.business_name) || (E == null ? void 0 : E.businessName) || "business").replace(/[^a-z0-9]/gi, "_").toLowerCase(), b = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 15), _ = (f == null ? void 0 : f.business_name) || (E == null ? void 0 : E.businessName) || "";
          if (t.format === "media_csv" || t.format === "all") {
            const T = oi(h, {}, _), I = `business-media_${m}_${b}.csv`, S = btoa(unescape(encodeURIComponent(T)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${S}`,
              filename: I,
              saveAs: !1
            });
          }
          if (t.format === "reviews_csv" || t.format === "all") {
            const T = li(p, {}, _), I = `business-reviews_${m}_${b}.csv`, S = btoa(unescape(encodeURIComponent(T)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${S}`,
              filename: I,
              saveAs: !1
            });
          }
          if (t.format === "combined_json" || t.format === "all") {
            const T = ci(f, h, p), I = `business-complete_${m}_${b}.json`, S = btoa(unescape(encodeURIComponent(T)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${S}`,
              filename: I,
              saveAs: !1
            });
          }
          s({ success: !0 });
          break;
        }
        case "START_WHATSAPP_CAMPAIGN": {
          V && V.getStatus() === "running" && V.stop();
          const d = t.leads || [], h = t.template || "", p = Array.isArray(t.templatePool) ? t.templatePool : void 0, f = t.sessionId || (g == null ? void 0 : g.sessionId) || "manual", m = t.settings || Vt;
          V = new wi(
            d,
            h,
            f,
            m,
            {
              sendToWhatsAppTab: Mi,
              navigateWhatsAppTab: Li,
              broadcastToUI: R
            },
            {
              templatePool: p
            }
          ), V.start().catch((b) => {
            console.error("[Service Worker] WhatsApp campaign error:", b);
          }), s({ success: !0 });
          break;
        }
        case "PAUSE_WHATSAPP_CAMPAIGN": {
          V && V.pause(), s({ success: !0 });
          break;
        }
        case "RESUME_WHATSAPP_CAMPAIGN": {
          V && V.resume(), s({ success: !0 });
          break;
        }
        case "STOP_WHATSAPP_CAMPAIGN": {
          V && (V.stop(), V = null), R({
            type: "WHATSAPP_CAMPAIGN_PROGRESS",
            progress: {
              status: "stopped",
              totalEligible: 0,
              processedCount: 0,
              sentCount: 0,
              skippedDuplicateCount: 0,
              invalidNumberCount: 0,
              failedCount: 0,
              consecutiveErrors: 0,
              currentBusinessName: void 0,
              nextDelaySeconds: void 0
            }
          }), s({ success: !0 });
          break;
        }
        case "GET_WHATSAPP_CAMPAIGN_STATE": {
          s({
            progress: V ? V.getProgress() : null
          });
          break;
        }
        case "GET_WHATSAPP_OUTREACH_HISTORY": {
          const d = await mi();
          s({ records: d });
          break;
        }
        case "GET_WHATSAPP_TEMPLATES": {
          const d = await gi();
          s({ templates: d });
          break;
        }
        case "SAVE_WHATSAPP_TEMPLATE": {
          await bi(t.template), s({ success: !0 });
          break;
        }
        case "DELETE_WHATSAPP_TEMPLATE": {
          await _i(t.templateId), s({ success: !0 });
          break;
        }
        // ----------------------------------------------------------------
        // LinkedIn handlers
        // ----------------------------------------------------------------
        case "LINKEDIN_PAGE_DETECTED": {
          (c = e.tab) != null && c.id && (H = e.tab.id);
          const d = t.sourceUrl, h = t.searchQuery;
          !w || w.status === "completed" || w.status === "stopped" || w.status === "failed" ? (w = yt(d, h), await F(w), await chrome.storage.local.set({ activeLinkedInSessionId: w.sessionId }), oe = null) : w && w.status === "idle" && (w.sourceUrl = d, w.searchQuery = h, await F(w)), R({ type: "LINKEDIN_SESSION_UPDATED", session: w }), s({ session: w });
          break;
        }
        case "LINKEDIN_PROFILE_CARDS_DISCOVERED": {
          if (w && w.status !== "stopped" && w.status !== "completed") {
            const { addedCount: d } = Ve(
              w,
              t.cards
            );
            d > 0 && (await F(w), R({ type: "LINKEDIN_SESSION_UPDATED", session: w }));
          }
          s({ success: !0 });
          break;
        }
        case "START_LINKEDIN_SESSION": {
          if (!H) {
            const h = await chrome.tabs.query({ url: "*://www.linkedin.com/*" }), p = h.find(
              (f) => {
                var m, b;
                return ((m = f.url) == null ? void 0 : m.includes("/search/results/people")) || ((b = f.url) == null ? void 0 : b.includes("/search/results/all"));
              }
            ) || h[0];
            p != null && p.id && (H = p.id);
          }
          if (!w && H) {
            const h = await chrome.tabs.get(H);
            if (h != null && h.url) {
              let p = null;
              try {
                p = new URL(h.url).searchParams.get("keywords");
              } catch {
              }
              w = yt(h.url, p), await F(w), await chrome.storage.local.set({ activeLinkedInSessionId: w.sessionId }), oe = null;
            }
          }
          if (!w) {
            s({ error: "No active LinkedIn session. Open a LinkedIn People search page first." });
            return;
          }
          if (H) {
            await ye(H);
            try {
              const h = await Pt({ type: "LINKEDIN_SCAN_RESULT_CARDS" }, 12e3);
              (u = h == null ? void 0 : h.cards) != null && u.length && (Ve(w, h.cards), await F(w));
            } catch (h) {
              console.debug("[Service Worker] LinkedIn initial scan error:", h);
            }
          }
          await Ie().start(), s({ success: !0, session: w });
          break;
        }
        case "PAUSE_LINKEDIN_SESSION": {
          w && await Ie().pause("user"), s({ success: !0, session: w });
          break;
        }
        case "RESUME_LINKEDIN_SESSION": {
          w && await Ie().resume(), s({ success: !0, session: w });
          break;
        }
        case "STOP_LINKEDIN_SESSION": {
          w && await Ie().stop(), s({ success: !0, session: w });
          break;
        }
        case "GET_LINKEDIN_SESSION_STATE": {
          const d = await chrome.storage.local.get("activeLinkedInSessionId");
          !w && d.activeLinkedInSessionId && (w = await wt(d.activeLinkedInSessionId) || null);
          try {
            const p = (await chrome.tabs.query({ url: "*://www.linkedin.com/*" })).find(
              (f) => {
                var m, b;
                return ((m = f.url) == null ? void 0 : m.includes("/search/results/people")) || ((b = f.url) == null ? void 0 : b.includes("/search/results/all"));
              }
            );
            p != null && p.id && (H = p.id, await ye(p.id), chrome.tabs.sendMessage(p.id, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => {
            }));
          } catch (h) {
            console.debug("[Service Worker] LinkedIn tab discovery error:", h);
          }
          s({ session: w });
          break;
        }
        case "GET_ALL_LINKEDIN_SESSIONS": {
          const d = await yi();
          s({ sessions: d });
          break;
        }
        case "GET_LINKEDIN_PROFILES": {
          const d = await ze(t.sessionId);
          s({ profiles: d });
          break;
        }
        case "DELETE_LINKEDIN_SESSION": {
          await Si(t.sessionId), w && w.sessionId === t.sessionId && (await chrome.storage.local.remove("activeLinkedInSessionId"), w = null, oe = null, R({ type: "LINKEDIN_SESSION_UPDATED", session: null })), s({ success: !0 });
          break;
        }
        case "EXPORT_LINKEDIN_PROFILES": {
          const d = t.sessionId || (w == null ? void 0 : w.sessionId);
          if (!d) {
            s({ error: "No LinkedIn session to export" });
            return;
          }
          const h = await wt(d), p = await ze(d), f = ((h == null ? void 0 : h.searchQuery) || "linkedin-leads").replace(/[^a-z0-9]/gi, "_").toLowerCase(), m = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 15);
          if (t.format === "csv" || t.format === "both") {
            const b = xi(p), _ = `linkedin-connect_${f}_${m}.csv`, T = btoa(unescape(encodeURIComponent(b)));
            await chrome.downloads.download({
              url: `data:text/csv;charset=utf-8;base64,${T}`,
              filename: _,
              saveAs: !1
            });
          }
          if (t.format === "json" || t.format === "both") {
            const b = Di(h, p), _ = `linkedin-connect_${f}_${m}.json`, T = btoa(unescape(encodeURIComponent(b)));
            await chrome.downloads.download({
              url: `data:application/json;charset=utf-8;base64,${T}`,
              filename: _,
              saveAs: !1
            });
          }
          s({ success: !0 });
          break;
        }
        case "START_LINKEDIN_CAMPAIGN": {
          const d = t.sessionId;
          if (!d) {
            s({ error: "Missing session ID" });
            return;
          }
          Q && await Q.stop(), Q = new ki(d, {
            broadcastToUI: (h) => {
              chrome.runtime.sendMessage(h).catch(() => {
              });
            },
            openTab: async (h) => (await chrome.tabs.create({ url: h, active: !1 })).id,
            closeTab: async (h) => {
              await chrome.tabs.remove(h).catch(() => {
              });
            },
            sendMessageToTab: async (h, p) => await chrome.tabs.sendMessage(h, p).catch(() => null)
          }), await Q.start(), s({ success: !0 });
          break;
        }
        case "PAUSE_LINKEDIN_CAMPAIGN": {
          Q && Q.pause(), s({ success: !0 });
          break;
        }
        case "STOP_LINKEDIN_CAMPAIGN": {
          Q && (await Q.stop(), Q = null), s({ success: !0 });
          break;
        }
        case "GET_LINKEDIN_CAMPAIGN_STATE": {
          s(Q ? { progress: Q.getProgress() } : { progress: null });
          break;
        }
        default: {
          s({ unhandled: !0 });
          break;
        }
      }
    } catch (d) {
      const h = d instanceof Error ? d.message : String(d);
      s({ error: h });
    }
  })(), !0);
});
chrome.tabs.onActivated.addListener(async (t) => {
  try {
    const e = await chrome.tabs.get(t.tabId);
    if (e.url && (e.url.includes("google.com/maps") || e.url.includes("maps.google.com")) && (x = e.id || null, e.id)) {
      await ee(e.id);
      const s = e.id;
      setTimeout(() => {
        chrome.tabs.sendMessage(s, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
        });
      }, 150);
    }
    if (e.url && e.url.includes("linkedin.com/search/results/people") && (H = e.id || null, e.id)) {
      await ye(e.id);
      const s = e.id;
      setTimeout(() => {
        chrome.tabs.sendMessage(s, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => {
        });
      }, 200);
    }
  } catch {
  }
});
chrome.tabs.onUpdated.addListener(async (t, e, s) => {
  e.status === "complete" && s.url && (s.url.includes("google.com/maps") || s.url.includes("maps.google.com")) && (x = t, await ee(t), setTimeout(() => {
    chrome.tabs.sendMessage(t, { type: "TRIGGER_PAGE_SCAN" }).catch(() => {
    });
  }, 200)), e.status === "complete" && s.url && s.url.includes("linkedin.com/search/results/people") && (H = t, await ye(t), setTimeout(() => {
    chrome.tabs.sendMessage(t, { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }).catch(() => {
    });
  }, 300));
});
(async () => {
  try {
    const t = await N(), e = await t.getAll("linkedin_profiles");
    let s = 0;
    for (const i of e)
      i.error && i.campaignMessageSent && (i.campaignMessageSent = !1, await t.put("linkedin_profiles", i), s++);
    s > 0 && console.log(`[DB FIX] Reset ${s} failed LinkedIn profiles for retry.`);
  } catch (t) {
    console.error("[DB FIX] Failed to fix corrupted DB state:", t);
  }
})();
