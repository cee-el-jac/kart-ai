import React, { useEffect, useMemo, useState } from "react";
import ToastHost from "./components/ToastHost";
import OCRScan from "./components/OCRScan";
import AddDealForm from "./components/AddDealForm"; // ← external form component
import MediaUploader from "./components/MediaUploader"; // (used by DealCard image preview if needed)
import { toPerKg, toPerLb, toPerL, toPerGal, money } from "./utils/conversions";
import { db } from "./firebaseClient";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";

/* ----------------------------- helpers ----------------------------- */
function toJsDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (typeof ts === "number" || typeof ts === "string") return new Date(ts);
  return null;
}
function fmtDate(ts) {
  const d = toJsDate(ts);
  return d ? d.toLocaleString() : "";
}

/* ------------------------------ styles ----------------------------- */
const S = {
  page: {
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    color: "#111",
    background: "#fff",
    minHeight: "100vh",
  },
  container: { maxWidth: 960, margin: "0 auto", padding: "0 16px" },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backdropFilter: "blur(6px)",
    background: "rgba(255,255,255,0.85)",
    borderBottom: "1px solid #e5e7eb",
    padding: "16px 12px",
    display: "flex",
    alignItems: "center",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
  },
  headLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 80, height: 80, borderRadius: 12, objectFit: "cover" },
  subtitle: { margin: 0, fontSize: 12, color: "#6b7280" },
  form: { display: "grid", gap: 8, gridTemplateColumns: "repeat(12, 1fr)" },
  input: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    outline: "none",
  },
  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0 16px",
  },
  left: { display: "flex", gap: 8, alignItems: "center" },
  right: { display: "flex", gap: 8, alignItems: "center" },
  list: { display: "grid", gap: 10, marginBottom: 40 },
  card: { border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    border: "1px solid #e5e7eb",
    padding: "2px 6px",
    borderRadius: 999,
  },
  h3: { margin: "6px 0 2px", fontSize: 16, fontWeight: 600 },
  muted: { fontSize: 12, color: "#6b7280" },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 4 },
};

const BRAND = {
  green: "#00674F",
  grayBorder: "#e5e7eb",
  text: "#111",
  white: "#fff",
  danger: "#b91c1c",
};
const BTN = {
  base: {
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    border: `1px solid ${BRAND.grayBorder}`,
    background: BRAND.white,
    color: BRAND.text,
  },
  primary: { background: BRAND.green, color: BRAND.white, border: `1px solid ${BRAND.green}` },
  secondary: { background: BRAND.white, color: BRAND.text, border: `1px solid ${BRAND.grayBorder}` },
  neutral: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
  danger: { background: BRAND.white, color: BRAND.danger, border: `1px solid ${BRAND.danger}` },
};

/* ------------------------------ header ----------------------------- */
function Header() {
  return (
    <header style={S.header}>
      <div style={S.container}>
        <div style={S.headerRow}>
          <div style={S.headLeft}>
            <img src="/kart-logo.png" alt="KART AI logo" style={S.logo} />
            <div>
              <p style={S.subtitle}>Real Prices. Real Savings. Real Time.</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ card ------------------------------- */
function DealCard({
  deal,
  onStartEdit,
  onDelete,
}) {
  const perKg =
    deal.type === "grocery" ? deal.normalizedPerKg ?? toPerKg(deal.price, deal.unit) : null;
  const perLb = deal.type === "grocery" && perKg != null ? toPerLb(perKg, "/kg") : null;
  const perL = deal.type === "gas" ? deal.normalizedPerL ?? toPerL(deal.price, deal.unit) : null;
  const perGal = deal.type === "gas" && perL != null ? toPerGal(perL, "/L") : null;

  const qty = Number(deal.originalMultiBuy?.qty);
  const total = Number(deal.originalMultiBuy?.total);
  const hasMulti =
    Number.isFinite(qty) && qty >= 2 && Number.isFinite(total) && total > 0;

  return (
    <div style={S.card}>
      <div style={S.row}>
        <div style={{ display: "grid", gap: 8 }}>
          {deal.imageURL && (
            <img
              src={deal.imageURL}
              alt=""
              style={{
                maxWidth: 280,
                maxHeight: 160,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                objectFit: "cover",
              }}
            />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={S.badge}>
                {deal.type === "grocery" ? "Grocery" : "Gas"}
              </span>
              {deal.station ? <span style={S.muted}>{deal.station}</span> : null}
            </div>
            <h3 style={S.h3}>{deal.item}</h3>
            <p style={S.muted}>
              {(deal.store || deal.station) ? `${deal.store || deal.station} · ` : ""}
              {deal.location}
            </p>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {hasMulti ? (
              <>
                {qty} for {money(total)}{" "}
                <span style={{ ...S.muted, fontWeight: 400 }}>
                  (≈ {money(total / Math.max(qty, 1))} each)
                </span>
              </>
            ) : (
              <>
                {money(deal.price)}{" "}
                <span style={{ ...S.muted, fontWeight: 400 }}>{deal.unit}</span>
              </>
            )}
          </div>
          {deal.type === "grocery" && perKg != null && (
            <div style={S.muted}>≈ {money(perKg)} /kg · ≈ {money(perLb)} /lb</div>
          )}
          {deal.type === "gas" && perL != null && (
            <div style={S.muted}>≈ {money(perL)} /L · ≈ {money(perGal)} /gal</div>
          )}
          <div style={{ color: "#667", fontSize: 12 }}>
            {fmtDate(deal.updatedAt || deal.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ list ------------------------------- */
function DealsList(props) {
  const { deals } = props;
  if (!deals.length) {
    return (
      <div style={{ ...S.container, padding: "0 16px 24px" }}>
        <div style={{ ...S.card, textAlign: "center", color: "#6b7280" }}>
          No deals yet. Add your first one above!
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...S.container, padding: "0 16px 24px" }}>
      <div style={S.list}>
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} {...props} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- App ------------------------------- */
export default function App() {
  // local cache
  const [deals, setDeals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kart-deals") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("kart-deals", JSON.stringify(deals));
    } catch {}
  }, [deals]);

  const [liveError, setLiveError] = useState("");

  const dealsCol = collection(db, "deals");

  // create/update/delete helpers
  async function createDeal(deal) {
    try {
      const ref = await addDoc(dealsCol, {
        ...deal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await getDoc(ref); // force server timestamp to resolve
      console.log("Added deal id:", ref.id);
      return ref.id;
    } catch (e) {
      console.error("createDeal error:", e);
      throw e;
    }
  }
  async function updateDealFS(id, updates) {
    await updateDoc(doc(dealsCol, id), { ...updates, updatedAt: serverTimestamp() });
  }
  async function removeDeal(id) {
    await deleteDoc(doc(dealsCol, id));
  }

  // live subscription (keeps your original sort: newest)
  useEffect(() => {
    console.log("Firestore projectId:", db?.app?.options?.projectId);
    const qy = query(dealsCol, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type ?? "grocery",
            item: data.item ?? "",
            store: data.store ?? "",
            station: data.station ?? "",
            location: data.location ?? "",
            unit: data.unit ?? "/ea",
            price: data.price ?? 0,
            normalizedPerKg: data.normalizedPerKg ?? null,
            normalizedPerL: data.normalizedPerL ?? null,
            originalMultiBuy: data.originalMultiBuy ?? null,
            caption: data.caption ?? "",
            imageURL: data.imageURL || "",
            imagePath: data.imagePath || "",
            imageWidth: data.imageWidth || null,
            imageHeight: data.imageHeight || null,
            createdAt: toJsDate(data.createdAt) ?? null,
            updatedAt: toJsDate(data.updatedAt) ?? null,
          };
        });
        setDeals(list);
        setLiveError("");
      },
      async (err) => {
        console.error("onSnapshot error:", err);
        setLiveError(err?.message || "Live updates failed");
        // Fallback one-shot read so UI still shows something
        try {
          const ss = await getDocs(qy);
          const list = ss.docs.map((d) => ({ id: d.id, ...d.data() }));
          setDeals(list);
        } catch (e) {
          console.error("getDocs fallback failed:", e);
        }
      }
    );
    return () => unsub();
  }, []);

  // search/sort/filter (unchanged)
  const [queryText, setQueryText] = useState(() => localStorage.getItem("kart-query") || "");
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("kart-sortby") || "newest");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("kart-typeFilter") || "all");
  useEffect(() => { try { localStorage.setItem("kart-query", queryText); } catch {} }, [queryText]);
  useEffect(() => { try { localStorage.setItem("kart-sortby", sortBy); } catch {} }, [sortBy]);
  useEffect(() => { try { localStorage.setItem("kart-typeFilter", typeFilter); } catch {} }, [typeFilter]);

  // inline edit (unchanged)
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState("");
  const [editStore, setEditStore] = useState("");
  const [editStation, setEditStation] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUnit, setEditUnit] = useState("/ea");
  const [editCaption, setEditCaption] = useState("");

  // OCR stub
  const [ocrDraft, setOcrDraft] = useState(null);

  async function handleAdd(newDeal) {
    await createDeal(newDeal); // AddDealForm handles its own "saving" state
  }
  async function handleDelete(id) {
    await removeDeal(id);
    if (id === editingId) handleCancelEdit();
  }
  function handleStartEdit(deal) {
    setEditingId(deal.id);
    setEditItem(deal.item || "");
    setEditStore(deal.store || "");
    setEditStation(deal.station || "");
    setEditLocation(deal.location || "");
    setEditPrice(String(deal.price));
    setEditUnit(deal.unit);
    setEditCaption(deal.caption || "");
  }
  function handleCancelEdit() {
    setEditingId(null);
    setEditItem("");
    setEditStore("");
    setEditStation("");
    setEditLocation("");
    setEditPrice("");
    setEditUnit("/ea");
    setEditCaption("");
  }
  async function handleSave() {
    if (!editingId) return;
    const newItem = editItem.trim();
    const newStore = editStore.trim();
    const newStation = editStation.trim();
    const newLocation = editLocation.trim();
    const newCaption = editCaption.trim();
    const newPrice = Number(editPrice);
    const newUnit = editUnit.trim();
    if (!newItem) return;
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;

    const current = deals.find((d) => d.id === editingId);
    let normalizedPerKg = null,
      normalizedPerL = null;
    if (current?.type === "grocery") normalizedPerKg = toPerKg(newPrice, newUnit);
    if (current?.type === "gas") normalizedPerL = toPerL(newPrice, newUnit);

    await updateDealFS(editingId, {
      item: newItem,
      store: newStore,
      station: newStation,
      location: newLocation,
      price: newPrice,
      unit: newUnit,
      normalizedPerKg,
      normalizedPerL,
      caption: newCaption,
    });
    handleCancelEdit();
  }

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    let out = [...deals];

    if (typeFilter !== "all") out = out.filter((d) => d.type === typeFilter);

    if (q) {
      out = out.filter((d) =>
        [d.item, d.store, d.station, d.location, d.caption].some((v) =>
          (v || "").toLowerCase().includes(q)
        )
      );
    }

    switch (sortBy) {
      case "price-asc":
        out.sort((a, b) => {
          const aN =
            a.type === "grocery"
              ? a.normalizedPerKg ?? toPerKg(a.price, a.unit) ?? a.price
              : a.normalizedPerL ?? toPerL(a.price, a.unit) ?? a.price;
          const bN =
            b.type === "grocery"
              ? b.normalizedPerKg ?? toPerKg(b.price, b.unit) ?? b.price
              : b.normalizedPerL ?? toPerL(b.price, b.unit) ?? b.price;
          return (aN ?? Infinity) - (bN ?? Infinity);
        });
        break;
      case "price-desc":
        out.sort((a, b) => {
          const aN =
            a.type === "grocery"
              ? a.normalizedPerKg ?? toPerKg(a.price, a.unit) ?? a.price
              : a.normalizedPerL ?? toPerL(a.price, a.unit) ?? a.price;
          const bN =
            b.type === "grocery"
              ? b.normalizedPerKg ?? toPerKg(b.price, b.unit) ?? b.price
              : b.normalizedPerL ?? toPerL(b.price, b.unit) ?? b.price;
          return (bN ?? -Infinity) - (aN ?? -Infinity);
        });
        break;
      case "alpha":
        out.sort((a, b) => (a.item || "").localeCompare(b.item || ""));
        break;
      case "newest":
      default:
        out.sort(
          (a, b) =>
            ((b.updatedAt || b.createdAt || 0)?.valueOf?.() ?? 0) -
            ((a.updatedAt || a.createdAt || 0)?.valueOf?.() ?? 0)
        );
        break;
    }

    return out;
  }, [deals, queryText, sortBy, typeFilter]);

  const forcedType =
    typeFilter === "grocery" || typeFilter === "gas" ? typeFilter : null;

  function handleResetAll() {
    setQueryText("");
    setSortBy("newest");
    setTypeFilter("all");
    handleCancelEdit();
  }

  return (
    <div style={S.page}>
      <Header />

      <div style={{ ...S.container, padding: "0 16px" }}>
        <div style={S.toolbar}>
          <div style={S.left}>
            <input
              style={{ ...S.input, width: 360 }}
              placeholder="Search items, stores, stations, locations…"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            <button
              onClick={() => setTypeFilter("grocery")}
              style={{
                ...BTN.base,
                ...(typeFilter === "grocery" ? BTN.primary : BTN.secondary),
                width: 40,
                height: 40,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `${
                  typeFilter === "grocery" ? 2 : 1
                }px solid ${typeFilter === "grocery" ? BRAND.green : BRAND.grayBorder}`,
                background: BRAND.white,
              }}
              title="Show grocery deals"
            >
              <img src="/icons/cart_icon.png" alt="" style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => setTypeFilter("gas")}
              style={{
                ...BTN.base,
                ...BTN.secondary,
                width: 40,
                height: 40,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `${
                  typeFilter === "gas" ? 2 : 1
                }px solid ${typeFilter === "gas" ? BRAND.green : BRAND.grayBorder}`,
                background: BRAND.white,
              }}
              title="Show gas deals"
            >
              <img src="/icons/gas_icon.png" alt="" style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => setTypeFilter("all")}
              style={{ ...BTN.base, ...(typeFilter === "all" ? BTN.primary : BTN.secondary) }}
              title="Show all deals"
            >
              All
            </button>
          </div>

          <div style={S.right}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={S.input}
              title="Sort"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price (Low → High)</option>
              <option value="price-desc">Price (High → Low)</option>
              <option value="alpha">A → Z</option>
            </select>

            <button
              onClick={handleResetAll}
              style={{ ...BTN.base, ...BTN.neutral }}
              title="Clear search, filters, sort"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Restored external AddDealForm */}
      <AddDealForm onAdd={handleAdd} forcedType={forcedType} prefill={null} />

      <DealsList
        deals={filtered}
        onDelete={handleDelete}
        /* edit plumbing */
        editingId={editingId}
        editItem={editItem}
        editStore={editStore}
        editStation={editStation}
        editLocation={editLocation}
        editPrice={editPrice}
        editUnit={editUnit}
        editCaption={editCaption}
        setEditItem={setEditItem}
        setEditStore={setEditStore}
        setEditStation={setEditStation}
        setEditLocation={setEditLocation}
        setEditPrice={setEditPrice}
        setEditUnit={setEditUnit}
        setEditCaption={setEditCaption}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSave={handleSave}
      />

      {/* OCR Scan Section */}
      <div style={{ ...S.container, padding: "16px 0" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Smart Assist – OCR</h2>
        <OCRScan onSuggest={setOcrDraft} />
      </div>
      {/* Debug / Database Health Check */}
      <div style={{ marginTop: "20px" }}>
     
      </div>
      <ToastHost/>
    </div>
  );
} 