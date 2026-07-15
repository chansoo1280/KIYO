// ============================================
// Test Data Helpers
// ============================================

import type { Setting, Metadata } from "../../models/account";

export const getDefaultSettings = (): Setting[] => [
  { theme: "dark", autoLockTime: 300, lockEnabled: true },
];

export const getDefaultMetadata = (): Metadata[] => [
  { id: 1, version: "1.0.0", createdAt: Date.now() },
];

export const getEncryptedSettings = (): Setting[] => [
  { theme: "dark", autoLockTime: 300, lockEnabled: true },
];

export const getEncryptedMetadata = (): Metadata[] => [
  { id: 1, version: "1.0.0", createdAt: Date.now() },
];
