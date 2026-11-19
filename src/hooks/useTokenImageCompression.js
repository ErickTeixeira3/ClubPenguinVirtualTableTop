import { useCallback, useState } from "react";
import { compressTokenImageFile } from "../services/tokenService.js";
import { notifyError } from "../services/notificationService.js";

/**
 * Encapsula a compressão única de imagem de token (uma única compressão reutilizada
 * na prévia e no upload) sem que o componente de UI importe `infra/`.
 */
export function useTokenImageCompression() {
  const [compressing, setCompressing] = useState(false);

  const compressFile = useCallback(async (file) => {
    if (!file) return null;
    setCompressing(true);
    try {
      return await compressTokenImageFile(file);
    } catch (err) {
      notifyError(err);
      return null;
    } finally {
      setCompressing(false);
    }
  }, []);

  return { compressing, compressFile };
}
