// src/test/fixtures/databaseFixtures.ts

import type { KiyoDataFile } from "../../database/fileStorage";
import type { EncryptedKiyoFile } from "../../crypto/encryption";
import type { FileData } from "../../database/db";
import type { Metadata, Setting } from "../../models/account";
import { createTestAccounts } from "./accountFixtures.ts";
import { createTestTemplates } from "./templateFixtures.ts";

/**
 * 기본 Setting 테스트 데이터
 */
export const createTestSetting = (): Setting => ({
  theme: "dark",
  lockEnabled: true,
  autoLockTime: 30,
});

/**
 * 기본 Metadata 테스트 데이터
 */
export const createTestMetadata = (): Metadata => ({
  id: 1,
  version: "1.0.0",
  createdAt: Date.now(),
});

/**
 * 평문 KiyoDataFile 생성
 */
export const createTestKiyoDataFile = (
  overrides: Partial<KiyoDataFile> = {},
): KiyoDataFile => ({
  version: 1,
  fileName: "test.json",
  updatedAt: Date.now(),
  accounts: createTestAccounts(),
  templates: createTestTemplates(),
  settings: [createTestSetting()],
  metadata: [createTestMetadata()],
  ...overrides,
});

/**
 * 암호화 파일 구조 생성
 */
export const createTestEncryptedFile = (
  overrides: Partial<EncryptedKiyoFile> = {},
): EncryptedKiyoFile => ({
  version: 1,
  encrypted: true,
  salt: "c2FsdA==",
  iv: "aXY=",
  ciphertext: "Y2lwaGVydGV4dA==",
  ...overrides,
});

/**
 * DB files 테이블용 평문 파일 데이터
 */
export const createTestFileData = (
  overrides: Partial<FileData> = {},
): FileData => ({
  id: Date.now(),
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
  overrides: Partial<FileData> = {},
): FileData => ({
  id: Date.now() + 1,
  fileName: "test-encrypted.json",
  fileData: JSON.stringify(createTestEncryptedFile()),
  encrypted: true,
  salt: "c2FsdA==",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});
