/**
 * Multi-Entry Build Script for Manifest V3 Extension
 */

import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cpSync, writeFileSync, mkdirSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

async function runBuild() {
  console.log("Starting Manifest V3 multi-entry build...");

  // 1. Build UI Pages (Popup, Dashboard, Options)
  console.log("1/4: Building UI Pages (Popup, Dashboard, Options)...");
  await build({
    root,
    base: "./",
    build: {
      outDir: dist,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(root, "src/ui/popup/popup.html"),
          dashboard: resolve(root, "src/ui/dashboard/dashboard.html"),
          options: resolve(root, "src/ui/options/options.html"),
        },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
  });

  // 2. Build Background Service Worker (ESM format)
  console.log("2/4: Building Background Service Worker (ESM)...");
  await build({
    root,
    build: {
      outDir: resolve(dist, "background"),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/background/service-worker.ts"),
        formats: ["es"],
        fileName: () => "service-worker.js",
      },
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
  });

  // 3. Build Content Scripts (IIFE format, isolated, no external chunk imports)
  console.log("3/5: Building Google Maps Content Script (IIFE)...");
  await build({
    root,
    build: {
      outDir: resolve(dist, "content-scripts/google-maps"),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/content-scripts/google-maps/index.ts"),
        name: "GoogleMapsContentScript",
        formats: ["iife"],
        fileName: () => "index.js",
      },
    },
  });

  console.log("4/6: Building WhatsApp Web Content Script (IIFE)...");
  await build({
    root,
    build: {
      outDir: resolve(dist, "content-scripts/whatsapp-web"),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/content-scripts/whatsapp-web/index.ts"),
        name: "WhatsAppWebContentScript",
        formats: ["iife"],
        fileName: () => "index.js",
      },
    },
  });

  console.log("5/6: Building LinkedIn Content Script (IIFE)...");
  await build({
    root,
    build: {
      outDir: resolve(dist, "content-scripts/linkedin"),
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/content-scripts/linkedin/index.ts"),
        name: "LinkedInContentScript",
        formats: ["iife"],
        fileName: () => "index.js",
      },
    },
  });

  // 6. Copy Static Assets: Locales, Icons, and Manifest
  console.log("6/6: Packaging Manifest, Locales, and Icons...");
  mkdirSync(resolve(dist, "_locales"), { recursive: true });
  mkdirSync(resolve(dist, "icons"), { recursive: true });

  if (existsSync(resolve(root, "_locales"))) {
    cpSync(resolve(root, "_locales"), resolve(dist, "_locales"), { recursive: true });
  }

  if (existsSync(resolve(root, "public/icons"))) {
    cpSync(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });
  }

  // Generate production manifest.json in dist/
  const manifest = {
    manifest_version: 3,
    name: "__MSG_extensionName__",
    version: "1.0.0",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    action: {
      default_popup: "src/ui/popup/popup.html",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png",
      },
    },
    background: {
      service_worker: "background/service-worker.js",
      type: "module",
    },
    content_scripts: [
      {
        matches: ["https://www.google.com/maps/*", "https://maps.google.com/*"],
        js: ["content-scripts/google-maps/index.js"],
        run_at: "document_idle",
      },
      {
        matches: ["https://web.whatsapp.com/*"],
        js: ["content-scripts/whatsapp-web/index.js"],
        run_at: "document_idle",
      },
      {
        matches: ["https://www.linkedin.com/*"],
        js: ["content-scripts/linkedin/index.js"],
        run_at: "document_idle",
      },
    ],
    permissions: ["storage", "downloads", "unlimitedStorage", "activeTab", "scripting", "tabs"],
    host_permissions: [
      "https://www.google.com/maps/*",
      "https://maps.google.com/*",
      "https://web.whatsapp.com/*",
      "https://www.linkedin.com/*",
    ],
    options_page: "src/ui/options/options.html",
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  };

  writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("Build complete! Output directory ready to load into Chrome: dist/");
}

runBuild().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
