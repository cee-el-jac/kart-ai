// src/services/firestoreDeals.js
import app, { db } from "../firebaseClient";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

// ensure db is the right instance
const _db = db || getFirestore(app);
export const dealCol = collection(_db, "deals");

export async function addDeal(payload) {
  const now = serverTimestamp();
  const docRef = await addDoc(dealCol, {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id; // ✅ important for callers
}

export async function fetchLatestDeals(n = 10) {
  const q = query(dealCol, orderBy("createdAt", "desc"), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
} 
