import { registerPlugin } from "@capacitor/core";

export interface SaveFileResult {
  success: boolean;
  uri: string;
  cancelled: boolean;
}

export interface OpenFileResult {
  success: boolean;
  uri: string;
  data: string;
  cancelled: boolean;
}

export interface WriteToUriResult {
  success: boolean;
}

export interface ReadFromUriResult {
  success: boolean;
  data: string;
}

export interface KiyoFilePlugin {
  saveFile(options: {
    fileName: string;
    mimeType: string;
    data: string;
  }): Promise<SaveFileResult>;

  openFile(options: {
    mimeType: string;
  }): Promise<OpenFileResult>;

  writeToUri(options: {
    uri: string;
    data: string;
  }): Promise<WriteToUriResult>;

  readFromUri(options: {
    uri: string;
  }): Promise<ReadFromUriResult>;
}

const KiyoFile = registerPlugin<KiyoFilePlugin>("KiyoFile", {
  web: () => import("./kiyofile.web").then((m) => new m.KiyoFileWeb()),
});

export { KiyoFile };