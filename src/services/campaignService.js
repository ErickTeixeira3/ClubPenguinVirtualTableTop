import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { fromCampaignDoc } from "../domain/models/campaign.js";
import { localStore } from "../infra/browserStorage.js";
import { db, DEFAULT_CAMPAIGN_ID } from "../infra/firebase.js";

export { DEFAULT_CAMPAIGN_ID };
import { campaignDocPath } from "../infra/firestorePaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

const ACTIVE_CAMPAIGN_STORAGE_KEY = "campaign:active_id";

export function resolveInitialCampaignId() {
  if (typeof window === "undefined") return DEFAULT_CAMPAIGN_ID;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("campaignId")?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    // Ignore invalid query string
  }
  const fromStorage = localStore.getRaw(ACTIVE_CAMPAIGN_STORAGE_KEY);
  return fromStorage && fromStorage.trim() ? fromStorage.trim() : DEFAULT_CAMPAIGN_ID;
}

export function saveActiveCampaignId(campaignId) {
  const clean = typeof campaignId === "string" ? campaignId.trim() : "";
  if (!clean) return;
  localStore.setRaw(ACTIVE_CAMPAIGN_STORAGE_KEY, clean);
}

export function subscribeCampaign({
  campaignId,
  firestoreDb = db,
  onData,
  onError
}) {
  const campaignRef = doc(firestoreDb, campaignDocPath(campaignId));
  return onSnapshot(
    campaignRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData?.(null);
        return;
      }
      const raw = snapshot.data() || {};
      const normalized = fromCampaignDoc(raw, snapshot.id);
      // TRANSITION(T-TURN-1): remover na Fase 11 quando combatState migrar para state/turn
      onData?.({
        ...normalized,
        ...(raw.combatState ? { combatState: raw.combatState } : {})
      });
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function updateCampaignName({
  campaignId,
  name,
  firestoreDb = db
}) {
  assertClientUpToDate();
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "O nome da campanha não pode ficar vazio."
    );
  }
  await updateDoc(doc(firestoreDb, campaignDocPath(campaignId)), {
    name: cleanName,
    updatedAt: serverTimestamp()
  });
}

export async function setActiveScene({
  campaignId,
  sceneId,
  firestoreDb = db
}) {
  assertClientUpToDate();
  await updateDoc(doc(firestoreDb, campaignDocPath(campaignId)), {
    activeSceneId: sceneId || null,
    updatedAt: serverTimestamp()
  });
}
