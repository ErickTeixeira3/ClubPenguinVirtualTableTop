import { useCallback, useSyncExternalStore } from "react";
import {
  clearNotifications,
  dismissNotification,
  getNotifications,
  notify,
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
  subscribeNotifications
} from "../services/notificationService.js";

export function useNotifications() {
  const notifications = useSyncExternalStore(
    subscribeNotifications,
    getNotifications,
    getNotifications
  );

  const dismiss = useCallback((id) => dismissNotification(id), []);
  const clear = useCallback(() => clearNotifications(), []);

  return {
    notifications,
    notify,
    notifyError,
    notifySuccess,
    notifyWarning,
    notifyInfo,
    dismissNotification: dismiss,
    clearNotifications: clear
  };
}
