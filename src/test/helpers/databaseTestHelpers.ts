// ============================================
// Test Data Helpers
// ============================================

import type { FileMetadata } from "@/models/account";

export const getDefaultMetadata = (): FileMetadata[] => [
  { id: 1, version: "1.0.0", createdAt: Date.now() },
];
