// src/services/firestoreDeals.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseClient";

// Collection ref
const dealsCol = collection(db, "deals");

/** Build a deterministic doc id so the same deal can’t duplicate */
export function makeDealKey({ type, item, store, station, location }) {
  const safe = (v = "") =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\/\\[\]{}#?%:]/g, "") // strip path-ish chars
      .replace(/\s+/g, "-")            // spaces -> hyphens
      .replace(/^-+|-+$/g, "");        // trim hyphens

  const itemN = safe(item);
  const locN = safe(location);
  const placeN = type === "gas" ? safe(station) : safe(store);
  return `${itemN}__${placeN}__${locN}`;
}

/** Add or update (idempotent) — writes to a fixed ID */
export async function addDeal(deal) {
  const id = makeDealKey(deal);
  const ref = doc(dealsCol, id);

  await setDoc(
    ref,
    {
      ...deal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true } // update same doc instead of creating duplicates
  );

  return id;
}

/** Read all deals (newest first) and normalize timestamps to JS Date for the UI */
export async function getDeals() {
  const q = query(dealsCol, orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);

  const toJsDate = (v) => {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();         // Firestore Timestamp
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000); // {seconds,nanos}
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") return new Date(v);
    return null;
  };

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: toJsDate(data.createdAt),
      updatedAt: toJsDate(data.updatedAt),
      addedAt: toJsDate(data.addedAt), // in case older docs used this
    };
  });
}

/** Quick duplicate check by computed id */
export async function isDuplicateDeal(deal) {
  const id = makeDealKey(deal);
  const ref = doc(dealsCol, id);
  const existing = await getDoc(ref);
  return existing.exists();
} 