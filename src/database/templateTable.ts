import { db } from "@/database/db";
import type { Template } from "@/models/template";
import { createEncryptedRecord, decryptRecord, type EncryptedRecord } from "@/crypto/recordEncryption";

interface TemplateRecord extends EncryptedRecord {
  id: string;
}

export const templateTable = {
  /**
   * Get all templates, decrypting if cryptoKey is provided
   */
  async getAll(cryptoKey?: CryptoKey): Promise<Template[]> {
    const records = await db.templates.toArray();

    if (cryptoKey && records.length > 0) {
      try {
        const templates = await Promise.all(
          records.map((record) => decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey)),
        );
        return templates.sort((a, b) => a.sortOrder - b.sortOrder);
      } catch (error) {
        console.error("Failed to decrypt template records:", error);
        return [];
      }
    }

    // Fallback: return plaintext templates when no cryptoKey (for plaintext files)
    if (records.length > 0) {
      try {
        return records
          .map((record) => {
            try {
              const decoded = new TextDecoder().decode(record.encryptedData);
              return JSON.parse(decoded) as Template;
            } catch {
              // If parsing fails, return a minimal template
              return { id: record.id, name: "", description: "", icon: "", sortOrder: 0, fields: [], createdAt: record.createdAt, updatedAt: record.updatedAt };
            }
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
      } catch (error) {
        console.error("Failed to parse plaintext template records:", error);
        return [];
      }
    }

    return [];
  },

  /**
   * Get template by ID
   */
  async getById(id: string, cryptoKey?: CryptoKey): Promise<Template | undefined> {
    const record = await db.templates.get(id);

    if (!record) return undefined;

    if (cryptoKey) {
      try {
        return await decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey);
      } catch (error) {
        console.error("Failed to decrypt template record:", error);
        return undefined;
      }
    }

    // Fallback: return plaintext template when no cryptoKey
    try {
      const decoded = new TextDecoder().decode(record.encryptedData);
      return JSON.parse(decoded) as Template;
    } catch (error) {
      console.error("Failed to parse plaintext template record:", error);
      return undefined;
    }
  },

  /**
   * Create a new template (encrypts if cryptoKey provided)
   */
  async create(template: Omit<Template, "id" | "createdAt" | "updatedAt">, cryptoKey?: CryptoKey): Promise<Template> {
    const now = Date.now();
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    if (cryptoKey) {
      const encryptedRecord = await createEncryptedRecord(newTemplate, cryptoKey);
      const record: TemplateRecord = {
        id: newTemplate.id,
        ...encryptedRecord,
      };
      await db.templates.add(record);
    } else {
      // Fallback for non-encrypted (should not happen in production)
      const plaintextData = new TextEncoder().encode(JSON.stringify(newTemplate));
      await db.templates.add({
        id: newTemplate.id,
        version: 1,
        algorithm: "AES-GCM",
        encryptedData: plaintextData,
        iv: new Uint8Array(12),
        createdAt: now,
        updatedAt: now,
      });
    }

    return newTemplate;
  },

  /**
   * Update a template (encrypts if cryptoKey provided)
   */
  async update(template: Template, cryptoKey?: CryptoKey): Promise<void> {
    const updatedTemplate = { ...template, updatedAt: Date.now() };

    if (cryptoKey) {
      const existingRecord = await db.templates.get(template.id);
      if (existingRecord) {
        const { encryptedData, iv, updatedAt } = await createEncryptedRecord(updatedTemplate, cryptoKey);
        // Preserve createdAt from existing record
        const record: TemplateRecord = {
          id: template.id,
          version: 1,
          algorithm: "AES-GCM",
          encryptedData,
          iv,
          createdAt: existingRecord.createdAt,
          updatedAt,
        };
        await db.templates.put(record);
      }
    } else {
      await db.templates.put({
        id: updatedTemplate.id,
        version: 1,
        algorithm: "AES-GCM",
        encryptedData: new TextEncoder().encode(JSON.stringify(updatedTemplate)),
        iv: new Uint8Array(12),
        createdAt: updatedTemplate.createdAt,
        updatedAt: updatedTemplate.updatedAt,
      });
    }
  },

  /**
   * Delete a template
   */
  async delete(id: string): Promise<void> {
    await db.templates.delete(id);
  },

  /**
   * Clear all templates (used for logout/switch file)
   */
  async clear(): Promise<void> {
    await db.templates.clear();
  },

  /**
   * Reorder templates by updating sortOrder
   * Falls back to plaintext parsing when no cryptoKey (for unencrypted files)
   */
  async reorder(ids: string[], cryptoKey?: CryptoKey): Promise<void> {
    await db.transaction("rw", db.templates, async () => {
      for (let i = 0; i < ids.length; i++) {
        const record = await db.templates.get(ids[i]);
        if (record && cryptoKey) {
          const template = await decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey);
          template.sortOrder = i;
          template.updatedAt = Date.now();
          const encryptedRecord = await createEncryptedRecord(template, cryptoKey);
          await db.templates.put({
            id: template.id,
            ...encryptedRecord,
            createdAt: record.createdAt,
          });
        } else if (record && !cryptoKey) {
          // Fallback: plaintext reorder
          try {
            const decoded = new TextDecoder().decode(record.encryptedData);
            const template = JSON.parse(decoded) as Template;
            template.sortOrder = i;
            template.updatedAt = Date.now();
            const plaintextData = new TextEncoder().encode(JSON.stringify(template));
            await db.templates.put({
              id: template.id,
              version: 1,
              algorithm: "AES-GCM",
              encryptedData: plaintextData,
              iv: new Uint8Array(12),
              createdAt: record.createdAt,
              updatedAt: template.updatedAt,
            });
          } catch (error) {
            console.error("Failed to reorder plaintext template record:", error);
          }
        }
      }

      // Handle remaining templates not in ids array
      const allRecords = await db.templates.toArray();
      const remainingRecords = allRecords.filter((r) => !ids.includes(r.id));
      // We can't easily sort without decrypting, so just put them at the end in current order

      for (let i = 0; i < remainingRecords.length; i++) {
        const record = remainingRecords[i];
        if (cryptoKey) {
          const template = await decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey);
          template.sortOrder = ids.length + i;
          template.updatedAt = Date.now();
          const encryptedRecord = await createEncryptedRecord(template, cryptoKey);
          await db.templates.put({
            id: template.id,
            ...encryptedRecord,
            createdAt: record.createdAt,
          });
        } else {
          // Fallback: plaintext reorder for remaining
          try {
            const decoded = new TextDecoder().decode(record.encryptedData);
            const template = JSON.parse(decoded) as Template;
            template.sortOrder = ids.length + i;
            template.updatedAt = Date.now();
            const plaintextData = new TextEncoder().encode(JSON.stringify(template));
            await db.templates.put({
              id: template.id,
              version: 1,
              algorithm: "AES-GCM",
              encryptedData: plaintextData,
              iv: new Uint8Array(12),
              createdAt: record.createdAt,
              updatedAt: template.updatedAt,
            });
          } catch (error) {
            console.error("Failed to reorder plaintext template record:", error);
          }
        }
      }
    });
  },

  /**
   * Restore a template with specific ID (for backup/restore operations)
   * Uses the provided template ID instead of auto-generating
   */
  async restore(
    template: Template,
    cryptoKey?: CryptoKey,
  ): Promise<Template> {
    const templateToStore: Template = {
      ...template,
      updatedAt: Date.now(),
    };

    if (cryptoKey) {
      const encryptedRecord = await createEncryptedRecord(templateToStore, cryptoKey);
      const record: TemplateRecord = {
        id: template.id,
        ...encryptedRecord,
        createdAt: template.createdAt,
        updatedAt: templateToStore.updatedAt,
      };
      await db.templates.put(record);
    } else {
      await db.templates.put({
        id: template.id,
        version: 1,
        algorithm: "AES-GCM" as const,
        encryptedData: new TextEncoder().encode(JSON.stringify(templateToStore)),
        iv: new Uint8Array(12),
        createdAt: template.createdAt,
        updatedAt: templateToStore.updatedAt,
      });
    }

    return templateToStore;
  },

  /**
   * Restore multiple templates with specific IDs (for backup/restore operations)
   * Uses the provided template IDs instead of auto-generating
   */
  async bulkRestore(
    templates: Template[],
    cryptoKey?: CryptoKey,
  ): Promise<void> {
    const now = Date.now();
    
    if (cryptoKey) {
      // Encrypt all templates first, then bulkPut
      const records = await Promise.all(
        templates.map(async (template) => {
          const templateToStore = { ...template, updatedAt: now };
          const encryptedRecord = await createEncryptedRecord(templateToStore, cryptoKey);
          return {
            id: template.id,
            ...encryptedRecord,
            createdAt: template.createdAt,
            updatedAt: now,
          };
        })
      );
      await db.templates.bulkPut(records as TemplateRecord[]);
    } else {
      // Fallback for non-encrypted
      const records = templates.map((template) => {
        const templateToStore = { ...template, updatedAt: now };
        return {
          id: template.id,
          version: 1 as const,
          algorithm: "AES-GCM" as const,
          encryptedData: new TextEncoder().encode(JSON.stringify(templateToStore)),
          iv: new Uint8Array(12),
          createdAt: template.createdAt,
          updatedAt: now,
        };
      });
      await db.templates.bulkPut(records as TemplateRecord[]);
    }
  },

  /**
   * Initialize dev seed data
   */
  async initializeDevData(devTemplates: Template[]): Promise<void> {
    const count = await db.templates.count();
    if (count > 0) return;

    await db.transaction("rw", db.templates, async () => {
      await db.templates.bulkPut(
        devTemplates.map((t) => ({
          id: t.id,
          version: 1,
          algorithm: "AES-GCM" as const,
          encryptedData: new TextEncoder().encode(JSON.stringify(t)),
          iv: new Uint8Array(12),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      );
    });

    console.log("개발용 template seed 데이터가 추가되었습니다.");
  },
};