import { doc, onSnapshot } from "firebase/firestore";
import { CLIENT_VERSION } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { isClientVersionOutdated } from "../domain/models/appConfig.js";
import { appConfigConverter } from "../infra/converters/index.js";
import { db } from "../infra/firebase.js";
import { runtimeConfigDocPath } from "../infra/firestorePaths.js";

let clientVersionBlocked = false;
const unsavedGuards = new Set();

export function isClientVersionBlocked() {
  return clientVersionBlocked;
}

export function setClientVersionBlocked(blocked) {
  clientVersionBlocked = Boolean(blocked);
}

export function assertClientUpToDate() {
  if (clientVersionBlocked) {
    throw new AppError(
      ERROR_CODES.CLIENT_OUTDATED,
      "Nova versão disponível. Recarregue a página para continuar."
    );
  }
}

export function registerUnsavedGuard(guard) {
  if (!guard || typeof guard !== "object") {
    return () => {};
  }
  unsavedGuards.add(guard);
  return () => {
    unsavedGuards.delete(guard);
  };
}

export function hasUnsavedChanges() {
  for (const guard of unsavedGuards) {
    try {
      if (typeof guard.hasUnsavedChanges === "function" && guard.hasUnsavedChanges()) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export async function flushUnsavedChanges() {
  const flushes = [];
  for (const guard of unsavedGuards) {
    if (typeof guard.flush === "function") {
      flushes.push(Promise.resolve(guard.flush()));
    }
  }
  await Promise.all(flushes);
}

export async function performProtectedReload({
  confirmDiscard = null,
  reload = () => {
    if (typeof window !== "undefined" && window.location) {
      window.location.reload();
    }
  }
} = {}) {
  if (hasUnsavedChanges()) {
    if (typeof confirmDiscard !== "function") {
      return false;
    }
    const confirmed = await confirmDiscard();
    if (!confirmed) {
      return false;
    }
  } else {
    await flushUnsavedChanges();
  }
  reload();
  return true;
}

export function subscribeRuntimeConfig({
  firestoreDb = db,
  clientVersion = CLIENT_VERSION,
  onChange,
  onError,
  warn = console.warn
} = {}) {
  const ref = doc(firestoreDb, runtimeConfigDocPath()).withConverter(appConfigConverter);
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        warn(
          "Documento appConfig/runtime ausente; seguindo sem restrição de versão."
        );
        setClientVersionBlocked(false);
        onChange?.({
          exists: false,
          config: null,
          updateRequired: false,
          clientVersion
        });
        return;
      }
      const config = snapshot.data();
      const updateRequired = isClientVersionOutdated(
        clientVersion,
        config?.minClientVersion
      );
      setClientVersionBlocked(updateRequired);
      onChange?.({
        exists: true,
        config,
        updateRequired,
        clientVersion
      });
    },
    (err) => {
      onError?.(err);
    }
  );

  return () => {
    setClientVersionBlocked(false);
    unsubscribe();
  };
}
