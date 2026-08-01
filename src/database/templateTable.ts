import { db } from "@/database/db";
import type { Template } from "@/models/template";
import {
  createEncryptedRecord,
  createPlaintextRecord,
  decryptRecord,
  type EncryptedRecord,
} from "@/crypto/recordEncryption";

export interface TemplateRecord extends EncryptedRecord {
  id: string;
}

export const templateTable = {
  /**
   * Get all templates, decrypting encrypted records if cryptoKey provided
   */
  async getAll(cryptoKey?: CryptoKey): Promise<Template[]> {
    const records = await db.templates.toArray();

    if (records.length === 0) return [];

    const templates = await Promise.all(
      records.map(async (record) => {
        if (record.encrypted) {
          if (!cryptoKey) {
            // Encrypted record but no key - return minimal
            return { id: record.id, name: "", description: "", icon: "", sortOrder: 0, fields: [], createdAt: record.createdAt, updatedAt: record.updatedAt } as Template;
          }
          try {
            return await decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey);
          } catch (error) {
            console.error("Failed to decrypt template record:", error);
            return { id: record.id, name: "", description: "", icon: "", sortOrder: 0, fields: [], createdAt: record.createdAt, updatedAt: record.updatedAt } as Template;
          }
        }
        // Plaintext record
        try {
          const decoded = new TextDecoder().decode(record.encryptedData);
          return JSON.parse(decoded) as Template;
        } catch {
          return { id: record.id, name: "", description: "", icon: "", sortOrder: 0, fields: [], createdAt: record.createdAt, updatedAt: record.updatedAt } as Template;
        }
      })
    );

    return templates.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Get template by ID
   */
  async getById(id: string, cryptoKey?: CryptoKey): Promise<Template | undefined> {
    const record = await db.templates.get(id);

    if (!record) return undefined;

    if (record.encrypted) {
      if (!cryptoKey) return undefined;
      try {
        return await decryptRecord<Template>(record.encryptedData, record.iv, cryptoKey);
      } catch (error) {
        console.error("Failed to decrypt template record:", error);
        return undefined;
      }
    }

    // Plaintext record
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
      // Plaintext record
      const plaintextRecord = await createPlaintextRecord(newTemplate);
      await db.templates.add({
        id: newTemplate.id,
        ...plaintextRecord,
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
          encrypted: true,
        };
        await db.templates.put(record);
      }
    } else {
      const plaintextRecord = await createPlaintextRecord(updatedTemplate);
      const record: TemplateRecord = {
        id: updatedTemplate.id,
        ...plaintextRecord,
        createdAt: updatedTemplate.createdAt,
        updatedAt: updatedTemplate.updatedAt,
      };
      await db.templates.put(record);
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
      // Plaintext record
      const plaintextRecord = await createPlaintextRecord(templateToStore);
      await db.templates.put({
        id: template.id,
        ...plaintextRecord,
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
      // Plaintext records
      const records = await Promise.all(
        templates.map(async (template) => {
          const templateToStore = { ...template, updatedAt: now };
          const plaintextRecord = await createPlaintextRecord(templateToStore);
          return {
            id: template.id,
            ...plaintextRecord,
            createdAt: template.createdAt,
            updatedAt: now,
          };
        })
      );
      await db.templates.bulkPut(records as TemplateRecord[]);
    }
  },
};