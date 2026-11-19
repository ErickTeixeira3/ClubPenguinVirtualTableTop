import { ID_PREFIXES } from "../domain/constants.js";
import { systemClock } from "../infra/clock.js";
import { createId } from "../infra/ids.js";

export const NOTIFICATION_TYPES = Object.freeze({
  ERROR: "error",
  SUCCESS: "success",
  WARNING: "warning",
  INFO: "info"
});

const DEFAULT_DURATION_MS = 4500;
const MAX_NOTIFICATIONS = 5;

export function createNotificationStore({
  clock = systemClock,
  random = Math.random
} = {}) {
  let items = [];
  const listeners = new Set();
  const timers = new Map();

  const emit = () => {
    const snapshot = items;
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const dismiss = (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    const next = items.filter((item) => item.id !== id);
    if (next.length !== items.length) {
      items = next;
      emit();
    }
  };

  const clear = () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    if (items.length > 0) {
      items = [];
      emit();
    }
  };

  const notify = ({
    type = NOTIFICATION_TYPES.INFO,
    message = "",
    code = null,
    durationMs = DEFAULT_DURATION_MS
  } = {}) => {
    const cleanMessage =
      typeof message === "string"
        ? message.trim()
        : String(message ?? "").trim();
    if (!cleanMessage) {
      return null;
    }

    const id = createId(ID_PREFIXES.OPERATION, {
      now: () => clock.now(),
      random
    });
    const entry = Object.freeze({
      id,
      type,
      message: cleanMessage,
      code: code || null,
      createdAt: clock.now()
    });

    const trimmed =
      items.length >= MAX_NOTIFICATIONS
        ? items.slice(items.length - MAX_NOTIFICATIONS + 1)
        : items;

    for (const removed of items.slice(0, items.length - trimmed.length)) {
      const oldTimer = timers.get(removed.id);
      if (oldTimer) {
        clearTimeout(oldTimer);
        timers.delete(removed.id);
      }
    }

    items = [...trimmed, entry];
    emit();

    if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
      const timer = setTimeout(() => {
        timers.delete(id);
        dismiss(id);
      }, durationMs);
      timers.set(id, timer);
    }

    return id;
  };

  const notifyError = (errorOrMessage, options = {}) => {
    const isErrorObj =
      errorOrMessage !== null && typeof errorOrMessage === "object";
    const message = isErrorObj
      ? errorOrMessage.message || "Ocorreu um erro inesperado."
      : errorOrMessage;
    const code = isErrorObj
      ? options.code ?? errorOrMessage.code ?? null
      : options.code ?? null;
    return notify({
      ...options,
      type: NOTIFICATION_TYPES.ERROR,
      message,
      code
    });
  };

  const notifySuccess = (message, options = {}) =>
    notify({
      ...options,
      type: NOTIFICATION_TYPES.SUCCESS,
      message
    });

  const notifyWarning = (message, options = {}) =>
    notify({
      ...options,
      type: NOTIFICATION_TYPES.WARNING,
      message
    });

  const notifyInfo = (message, options = {}) =>
    notify({
      ...options,
      type: NOTIFICATION_TYPES.INFO,
      message
    });

  const getAll = () => items;

  const subscribe = (listener) => {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return Object.freeze({
    notify,
    notifyError,
    notifySuccess,
    notifyWarning,
    notifyInfo,
    dismiss,
    clear,
    getAll,
    subscribe
  });
}

const defaultStore = createNotificationStore();

export function notify(payload) {
  return defaultStore.notify(payload);
}

export function notifyError(errorOrMessage, options = {}) {
  return defaultStore.notifyError(errorOrMessage, options);
}

export function notifySuccess(message, options = {}) {
  return defaultStore.notifySuccess(message, options);
}

export function notifyWarning(message, options = {}) {
  return defaultStore.notifyWarning(message, options);
}

export function notifyInfo(message, options = {}) {
  return defaultStore.notifyInfo(message, options);
}

export function dismissNotification(id) {
  return defaultStore.dismiss(id);
}

export function clearNotifications() {
  return defaultStore.clear();
}

export function getNotifications() {
  return defaultStore.getAll();
}

export function subscribeNotifications(listener) {
  return defaultStore.subscribe(listener);
}
