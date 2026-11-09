import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { FileMetadata } from "@/models/vault";

export interface MetadataState {
  metadata: FileMetadata[];
  init: (metadata: FileMetadata[]) => void;
  getAll: () => FileMetadata[];
  clearMetadata: () => void;
}

export const useMetadataStore = create<MetadataState>()(
  devtools(
    (set, get) => ({
      metadata: [],

      init: (metadata: FileMetadata[]) => {
        set({ metadata });
      },

      getAll: () => get().metadata,

      clearMetadata: () => {
        set({ metadata: [] });
      },
    }),
    { name: "MetadataStore" }
  )
);