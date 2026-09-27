/**
 * Adapter Registry
 * Defined in PRD Section 40.4
 */

import { PlatformAdapter } from "./platform-adapter";

const registry = new Map<string, PlatformAdapter>();

export function registerAdapter(adapter: PlatformAdapter): void {
  registry.set(adapter.platformId, adapter);
}

export function getAdapter(platformId: string): PlatformAdapter | undefined {
  return registry.get(platformId);
}

export function detectActiveAdapter(doc: Document, url: string): PlatformAdapter | null {
  for (const adapter of registry.values()) {
    if (adapter.detectPlatform(doc, url)) {
      return adapter;
    }
  }
  return null;
}
