import { WebPlugin } from "@capacitor/core";
import type {
  KiyoFilePlugin,
  SaveFileResult,
  OpenFileResult,
  WriteToUriResult,
  ReadFromUriResult,
  PickBackupFolderResult,
} from "@/plugins/kiyofile";

export class KiyoFileWeb extends WebPlugin implements KiyoFilePlugin {
  async saveFile(options: {
    fileName: string;
    mimeType: string;
    data: string;
  }): Promise<SaveFileResult> {
    console.warn("KiyoFile: saveFile using web fallback (download)");
    const { fileName, mimeType, data } = options;

    try {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);

      return {
        success: true,
        uri: `blob:${fileName}`,
        cancelled: false,
      };
    } catch (error) {
      console.error("KiyoFile web fallback saveFile error:", error);
      return {
        success: false,
        uri: "",
        cancelled: false,
      };
    }
  }

  async openFile(): Promise<OpenFileResult> {
    console.warn("KiyoFile: openFile not available on web (requires file picker)");
    return {
      success: false,
      uri: "",
      data: "",
      cancelled: false,
    };
  }

  async writeToUri(): Promise<WriteToUriResult> {
    console.warn("KiyoFile: writeToUri not available on web");
    return {
      success: false,
    };
  }

  async readFromUri(): Promise<ReadFromUriResult> {
    console.warn("KiyoFile: readFromUri not available on web");
    return {
      success: false,
      data: "",
    };
  }

  async pickBackupFolder(): Promise<PickBackupFolderResult> {
    console.warn("KiyoFile: pickBackupFolder not available on web");
    return {
      success: false,
      cancelled: false,
    };
  }
}