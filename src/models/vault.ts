import type { Account } from "@/models/account";
import type { Template } from "@/models/template";
import type { FileMetadata } from "@/models/account";

export interface KiyoVaultData {
  version: 1;
  fileName: string;
  updatedAt: number;
  accounts: Account[];
  templates: Template[];
  metadata: FileMetadata[];
}

export interface EncryptedKiyoVaultData {
  version: 1;
  encrypted: true;
  salt: string;
  iv: string;
  ciphertext: string;
}