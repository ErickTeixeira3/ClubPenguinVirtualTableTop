import { useCallback } from "react";
import { compressAvatarFile } from "../services/profileService.js";

export function useAvatarCompression() {
  return useCallback((file) => compressAvatarFile(file), []);
}
