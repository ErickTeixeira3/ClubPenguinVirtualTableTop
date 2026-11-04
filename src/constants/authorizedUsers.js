import { doc, getDoc } from "firebase/firestore";
import { db, DEFAULT_CAMPAIGN_ID } from "../services/firebase";

export const DEFAULT_AUTHORIZED_USERS = [
  {
    email: "erickteixeiractt@gmail.com",
    defaultDisplayName: "audacioscard",
    role: "gm"
  },
  {
    email: "marikomarnicki@gmail.com",
    defaultDisplayName: "crodilo",
    role: "player"
  }
];

export async function checkIsEmailAuthorized(email) {
  if (!email) return false;
  const target = email.trim().toLowerCase();

  // 1. Sempre confere na lista de autorizados padrão
  if (DEFAULT_AUTHORIZED_USERS.some((u) => u.email.toLowerCase() === target)) {
    return true;
  }

  // 2. Consulta a lista dinâmica no documento da campanha no Firestore
  try {
    const snap = await getDoc(doc(db, "campaigns", DEFAULT_CAMPAIGN_ID));
    if (snap.exists()) {
      const data = snap.data();
      const list = Array.isArray(data.authorizedUsers)
        ? data.authorizedUsers
        : DEFAULT_AUTHORIZED_USERS;
      return list.some((u) => u.email.toLowerCase() === target);
    }
  } catch (err) {
    console.warn("Aviso ao checar autorização de e-mail:", err);
  }

  return false;
}
