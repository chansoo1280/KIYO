import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Account, Metadata, Setting, Template } from "../models/account";

const ACTIVE_FILE_KEY = "kiyo.activeDataFile";

export interface KiyoDataFile {
  version: 1;
  fileName: string;
  updatedAt: number;
  accounts: Account[];
  templates: Template[];
  settings: Setting[];
  metadata: Metadata[];
}

export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();

export const normalizeDataFileName = (fileName: string) => {
  const trimmedName = fileName.trim() || "kiyo-data";
  return trimmedName.endsWith(".json") ? trimmedName : `${trimmedName}.json`;
};

export const getActiveDataFileName = () =>
  localStorage.getItem(ACTIVE_FILE_KEY);

export const setActiveDataFileName = (fileName: string) => {
  localStorage.setItem(ACTIVE_FILE_KEY, normalizeDataFileName(fileName));
};

export const clearActiveDataFileName = () =>
  localStorage.removeItem(ACTIVE_FILE_KEY);

export const isKiyoDataFile = (value: unknown): value is KiyoDataFile => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<KiyoDataFile>;
  return (
    data.version === 1 &&
    (data.fileName === undefined || typeof data.fileName === "string") &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.templates) &&
    Array.isArray(data.settings) &&
    Array.isArray(data.metadata)
  );
};
export const fileExists = async (fileName: string) => {
  try {
    await Filesystem.stat({
      path: fileName,
      directory: Directory.Documents,
    });

    return true;
  } catch {
    return false;
  }
};

export const readDataFile = async (
  fileName = getActiveDataFileName(),
): Promise<KiyoDataFile | null> => {
  if (!fileName) return null;
  if (!isNativeFileStorageAvailable()) return null;

  try {
    const { data } = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    const parsed = JSON.parse(data as string) as unknown;
    return isKiyoDataFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeDataFile = async (
  data: KiyoDataFile,
  fileName = getActiveDataFileName(),
): Promise<void> => {
  if (!fileName) return;
  if (!isNativeFileStorageAvailable()) return;

  await Filesystem.writeFile({
    path: fileName,
    data: JSON.stringify(data, null, 2),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

export const writeBackupFile = async (
  data: KiyoDataFile,
  fileName: string,
): Promise<void> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  if (!isNativeFileStorageAvailable()) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizedFileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Filesystem.writeFile({
    path: normalizedFileName,
    data: JSON.stringify(data, null, 2),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};
