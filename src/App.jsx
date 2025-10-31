import React, { useEffect, useMemo, useState } from "react";
import ToastHost from "./components/ToastHost"; 
import OCRScan from "./components/OCRScan";
import MediaUploader from "./components/MediaUploader";
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
} from "firebase/firestore";
// NOTE: if you prefer deterministic IDs, you can import upsertDeal and use it in createDeal()
// import { upsertDeal } from "./services/firestoreDeals";

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
  editingId,
  editItem,
  editStore,
  editStation,
  editLocation,
  editPrice,
  editUnit,
  editCaption,
  setEditItem,
  setEditStore,
  setEditStation,
  setEditLocation,
  setEditPrice,
  setEditUnit,
  setEditCaption,
  onStartEdit,
  onCancelEdit,
  onSave,
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

  const isEditing = editingId === deal.id;

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

      {!isEditing && deal.caption ? (
        <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{deal.caption}</p>
      ) : null}

      {isEditing ? (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...S.input, flex: 1 }}
              value={editItem}
              onChange={(e) => setEditItem(e.target.value)}
              placeholder="Item"
            />
            {deal.type === "grocery" ? (
              <input
                style={{ ...S.input, width: 200 }}
                value={editStore}
                onChange={(e) => setEditStore(e.target.value)}
                placeholder="Store"
              />
            ) : (
              <input
                style={{ ...S.input, width: 200 }}
                value={editStation}
                onChange={(e) => setEditStation(e.target.value)}
                placeholder="Station"
              />
            )}
            <input
              style={{ ...S.input, width: 220 }}
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Location"
            />
          </div>

          <textarea
            style={{ ...S.input, minHeight: 72 }}
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            placeholder="Caption / notes"
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <input
              type="text"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="Price"
              style={{ ...S.input, width: 110 }}
            />
            <select
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              style={{ ...S.input, width: 110 }}
            >
              {["/ea", "/dozen", "/lb", "/kg", "/100g", "/L", "/gal"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <button onClick={onSave} style={{ ...BTN.base, ...BTN.primary }}>
              Save
            </button>
            <button
              onClick={onCancelEdit}
              style={{ ...BTN.base, ...BTN.secondary }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}
        >
          <button
            onClick={() => onStartEdit(deal)}
            style={{ ...BTN.base, ...BTN.primary }}
            title="Edit"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(deal.id)}
            style={{ ...BTN.base, ...BTN.danger }}
            title="Delete"
          >
            Delete
          </button>
        </div>
      )}
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

/* --------------------------- add deal form -------------------------- */
function AddDealForm({ onAdd, forcedType, prefill }) {
  const [form, setForm] = useState({
    type: "grocery",
    item: "",
    store: "",
    station: "",
    location: "",
    price: "",
    unit: "/ea",
    multiEnabled: false,
    multiQty: "",
    multiTotal: "",
    caption: "",
  });
  const [media, setMedia] = useState(null); // {url, path, width, height, mime, size}
  const [error, setError] = useState("");

  useEffect(() => {
    if (forcedType === "grocery" || forcedType === "gas") {
      setForm((f) => ({
        ...f,
        type: forcedType,
        unit: forcedType === "grocery" ? "/ea" : "/L",
      }));
    }
  }, [forcedType]);

  useEffect(() => {
    if (!prefill) return;
    setForm((f) => ({
      ...f,
      type: prefill.type ?? f.type,
      item: f.item || prefill.item || "",
      store: f.store || prefill.store || "",
      station: f.station || prefill.station || "",
      location: f.location || prefill.location || "",
      unit: prefill.unit || f.unit,
      price: prefill.price != null ? String(prefill.price) : f.price,
      multiEnabled: prefill.originalMultiBuy ? true : f.multiEnabled,
      multiQty:
        prefill.originalMultiBuy?.qty != null
          ? String(prefill.originalMultiBuy.qty)
          : f.multiQty,
      multiTotal:
        prefill.originalMultiBuy?.total != null
          ? String(prefill.originalMultiBuy.total)
          : f.multiTotal,
    }));
  }, [prefill]);

  const unitOptions =
    form.type === "grocery"
      ? ["/ea", "/dozen", "/lb", "/kg", "/100g"]
      : ["/L", "/gal"];

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.item?.trim()) return setError("Item name is required.");
    if (form.type === "grocery" && !form.store?.trim())
      return setError("Store is required.");
    if (form.type === "gas" && !form.station?.trim())
      return setError("Station is required.");

    const isMulti = !!form.multiEnabled;
    const qtyNum = Number(form.multiQty);
    const totalNum = Number(form.multiTotal);

    if (isMulti) {
      if (!Number.isFinite(qtyNum) || qtyNum <= 0)
        return setError("Enter a valid multi-buy quantity (e.g., 2).");
      if (!Number.isFinite(totalNum) || totalNum <= 0)
        return setError("Enter a valid multi-buy total (e.g., 5.00).");
    }

    let priceNum;
    let originalMultiBuy = null;

    if (isMulti) {
      const perUnit = totalNum / qtyNum;
      if (!isFinite(perUnit) || perUnit <= 0)
        return setError("Multi-buy values are invalid.");
      priceNum = Number(perUnit.toFixed(4));
      originalMultiBuy = { qty: qtyNum, total: totalNum, perUnit: priceNum };
    } else {
      const p = Number(form.price);
      if (!isFinite(p) || p <= 0) return setError("Enter a valid price.");
      priceNum = p;
    }

    const toSave = {
      type: form.type,
      item: form.item.trim(),
      store: form.store.trim(),
      station: form.station.trim(),
      location: form.location.trim(),
      unit: form.unit,
      price: priceNum,
      normalizedPerKg: form.normalizedPerKg ?? null,
      normalizedPerL: form.normalizedPerL ?? null,
      originalMultiBuy,
      caption: (form.caption || "").trim(),
      imageURL: media?.url || "",
      imagePath: media?.path || "",
      imageWidth: media?.width || null,
      imageHeight: media?.height || null,
    };

    await onAdd(toSave);

    setForm({
      type:
        forcedType === "grocery" || forcedType === "gas"
          ? forcedType
          : "grocery",
      item: "",
      store: "",
      station: "",
      location: "",
      price: "",
      unit: forcedType === "gas" ? "/L" : "/ea",
      multiEnabled: false,
      multiQty: "",
      multiTotal: "",
      caption: "",
    });
    setMedia(null);
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...S.container, padding: "0 16px 12px" }}>
      <div style={S.form}>
        <input
          name="item"
          value={form.item}
          onChange={handleChange}
          placeholder={
            form.type === "gas"
              ? "Fuel (e.g., Regular Unleaded)"
              : "Item (e.g., Chicken Thighs)"
          }
          style={{ ...S.input, gridColumn: "span 3" }}
        />

        {form.type === "grocery" ? (
          <input
            name="store"
            value={form.store}
            onChange={handleChange}
            placeholder="Store (e.g., Costco)"
            style={{ ...S.input, gridColumn: "span 2" }}
          />
        ) : (
          <input
            name="station"
            value={form.station}
            onChange={handleChange}
            placeholder="Station (e.g., Shell)"
            style={{ ...S.input, gridColumn: "span 2" }}
          />
        )}

        <input
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="Location (City, State/Province)"
          style={{ ...S.input, gridColumn: "span 3" }}
        />

        <select
          name="unit"
          value={form.unit}
          onChange={handleChange}
          style={{ ...S.input, gridColumn: "span 1" }}
        >
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            gridColumn: "span 3",
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            name="multiEnabled"
            checked={form.multiEnabled}
            onChange={handleChange}
          />
          Multi-buy deal? (e.g., 2 for $5)
        </label>

        {form.multiEnabled ? (
          <>
            <input
              name="multiQty"
              value={form.multiQty}
              onChange={handleChange}
              placeholder="Qty (e.g., 2)"
              style={{ ...S.input, gridColumn: "span 1" }}
            />
            <input
              name="multiTotal"
              value={form.multiTotal}
              onChange={handleChange}
              placeholder="Bundle total (e.g., 5.00)"
              style={{ ...S.input, gridColumn: "span 2" }}
            />
            {Number(form.multiQty) > 0 && Number(form.multiTotal) > 0 ? (
              <div
                style={{
                  alignSelf: "center",
                  fontSize: 12,
                  color: "#6b7280",
                  gridColumn: "span 2",
                }}
              >
                ≈ {(Number(form.multiTotal) / Number(form.multiQty)).toFixed(2)} per
                unit
              </div>
            ) : (
              <div style={{ gridColumn: "span 2" }} />
            )}
          </>
        ) : (
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Price (e.g., 4.99)"
            style={{ ...S.input, gridColumn: "span 1" }}
          />
        )}

        {/* Caption */}
        <textarea
          name="caption"
          value={form.caption}
          onChange={handleChange}
          placeholder="Add a caption or notes (optional)…"
          style={{ ...S.input, gridColumn: "1 / -1", minHeight: 72, resize: "vertical" }}
        />

        {/* Photo uploader */}
        <div style={{ gridColumn: "1 / -1" }}>
          <MediaUploader onUploaded={setMedia} defaultPreview={media?.url || ""} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            setForm({
              type:
                forcedType === "grocery" || forcedType === "gas"
                  ? forcedType
                  : "grocery",
              item: "",
              store: "",
              station: "",
              location: "",
              price: "",
              unit: forcedType === "gas" ? "/L" : "/ea",
              multiEnabled: false,
              multiQty: "",
              multiTotal: "",
              caption: "",
            });
            setMedia(null);
          }}
          style={{ ...BTN.base, ...BTN.neutral }}
        >
          Reset
        </button>

        <button type="submit" style={{ ...BTN.base, ...BTN.primary }}>Add</button>
      </div>
    </form>
  );
}

/* -------------------------------- App ------------------------------- */
export default function App() {
  // persist deals to localStorage (cheap cache)
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

  const dealsCol = collection(db, "deals");

  // If you want deterministic IDs instead, replace with: return upsertDeal(deal);
  async function createDeal(deal) {
    const ref = await addDoc(dealsCol, {
      ...deal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await getDoc(ref);
    return ref.id;
  }
  async function updateDealFS(id, updates) {
    await updateDoc(doc(dealsCol, id), { ...updates, updatedAt: serverTimestamp() });
  }
  async function removeDeal(id) {
    await deleteDoc(doc(dealsCol, id));
  }

  // live subscription
  useEffect(() => {
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
      },
      (err) => console.error("onSnapshot error:", err)
    );
    return () => unsub();
  }, []);

  // search/sort/filter
  const [queryText, setQueryText] = useState(() => localStorage.getItem("kart-query") || "");
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("kart-sortby") || "newest");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("kart-typeFilter") || "all");
  useEffect(() => { try { localStorage.setItem("kart-query", queryText); } catch {} }, [queryText]);
  useEffect(() => { try { localStorage.setItem("kart-sortby", sortBy); } catch {} }, [sortBy]);
  useEffect(() => { try { localStorage.setItem("kart-typeFilter", typeFilter); } catch {} }, [typeFilter]);

  // inline edit
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState("");
  const [editStore, setEditStore] = useState("");
  const [editStation, setEditStation] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUnit, setEditUnit] = useState("/ea");
  const [editCaption, setEditCaption] = useState("");

  // ocr prefill stub (wire later)
  const [ocrDraft, setOcrDraft] = useState(null);

  async function handleAdd(newDeal) {
    await createDeal(newDeal);
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

      <AddDealForm onAdd={handleAdd} forcedType={forcedType} prefill={null /* wire OCR later */} />

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
      <ToastHost/>
    </div>
  );
} 



