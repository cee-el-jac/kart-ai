// src/services/firestoreDeals.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseClient";

const dealsCol = collection(db, "deals");

/** Build a deterministic doc id so the same deal can’t duplicate */
export function makeDealKey({ type, item, store, station, location }) {
  const base = (v) => String(v ?? "").trim().toLowerCase();
  const safe = (v) =>
    base(v)
      .replace(/[\/\\#?[\]]+/g, "-") // strip path-ish chars
      .replace(/\s+/g, "-")          // spaces -> hyphens
      .replace(/^-+|-+$/g, "");
  const itemN = safe(item);
  const locN  = safe(location);
  const placeN = base(type) === "gas" ? safe(station) : safe(store);
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

/** Read all deals */
export async function getDeals() {
  const snap = await getDocs(dealsCol);
  // optional: normalize timestamps to JS Date for the UI
  const toDate = (v) =>
    v?.toDate?.() ??
    (typeof v?.seconds === "number" ? new Date(v.seconds * 1000) : v ?? null);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
}

/** Fast duplicate check by computed id */
export async function isDuplicateDeal(deal) {
  const id = makeDealKey(deal);
  const snap = await getDoc(doc(dealsCol, id));
  return snap.exists();
} 
