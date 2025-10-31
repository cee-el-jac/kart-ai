// src/services/firestoreDeals.js
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";

// Deterministic ID for "same deal" upserts (optional but handy)
export function dealKey({ type, item, store, station, location }) {
  const clean = (s) =>
    (s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]/g, "");
  return [
    clean(type || "grocery"),
    clean(item),
    clean(store),
    clean(station),
    clean(location),
  ]
    .filter(Boolean)
    .join("__");
}

// Upsert (create or update the same doc id)
export async function upsertDeal(deal) {
  const col = collection(db, "deals");
  const id = dealKey(deal);
  const ref = doc(col, id);
  await setDoc(
    ref,
    {
      ...deal,
      updatedAt: serverTimestamp(),
      createdAt: deal.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
  return id;
} 
