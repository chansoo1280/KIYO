// src/test/fixtures/databaseFixtures.ts

import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";
import type { FileRecord } from "@/database/db";
import type { FileMetadata } from "@/models/account";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";

/**
 * 기본 FileMetadata 테스트 데이터
 */
export const createTestMetadata = (): FileMetadata => ({
  id: 1,
  version: "1.0.0",
  createdAt: Date.now(),
});

/**
 * 평문 KiyoVaultData 생성
 */
export const createTestKiyoDataFile = (
  overrides: Partial<KiyoVaultData> = {},
): KiyoVaultData => ({
  version: 1,
  fileName: "test.json",
  updatedAt: Date.now(),
  accounts: createTestAccounts(),
  templates: createTestTemplates(),
  metadata: [createTestMetadata()],
  ...overrides,
});

/**
 * 암호화 파일 구조 생성
 */
export const createTestEncryptedFile = (
  overrides: Partial<EncryptedKiyoVaultData> = {},
): EncryptedKiyoVaultData => ({
  version: 1,
  encrypted: true,
  salt: "bW9ja1NhbHQxMjM0NTY3OA==", // 16 bytes base64 encoded (mockSalt12345678)
  iv: "bW9ja1ZlY3RvcjEyMzQ=", // 12 bytes base64 encoded (mockVector1234)
  ciphertext: "bW9ja0NpcGhlcnRleHQxMjM0NTY3ODkwYWJjZGVm", // base64 encoded
  ...overrides,
});

/**
 * DB files 테이블용 평문 파일 데이터
 */
export const createTestFileData = (
  overrides: Partial<FileRecord> = {},
): FileRecord => ({
  id: "active",
  fileName: "test.json",
  fileData: JSON.stringify(createTestKiyoDataFile()),
  encrypted: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

/**
 * DB files 테이블용 암호화 파일 데이터
 */
export const createTestEncryptedFileData = (
  overrides: Partial<FileRecord> = {},
): FileRecord => ({
  id: "active",
  fileName: "test-encrypted.json",
  fileData: JSON.stringify(createTestEncryptedFile()),
  encrypted: true,
  salt: "c2FsdA==",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});
