import React, { useMemo, useState, useEffect } from "react";
import {
  toPerKg,
  toPerLb,
  toPerL,
  toPerGal,
  money
} from "./utils/conversions";




// ---------- constants & converters ----------

// ---------- simple styles (Tailwind-free) ----------
const S = {
  page: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#111", background: "#fff", minHeight: "100vh" },
  container: { maxWidth: 960, margin: "0 auto", padding: "0 16px" },
  header: {
    position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(6px)", background: "rgba(255,255,255,0.85)",
    borderBottom: "1px solid #e5e7eb", padding: "16px 12px", display: "flex", alignItems: "center",
  },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" },
  headLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 80, height: 80, borderRadius: 12, objectFit: "cover", display: "block", background: "#fff", /*border: "1px solid #e5e7eb"*/ },
  title: { margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.1 },
  subtitle: { margin: 0, fontSize: 12, color: "#6b7280" },
  version: { fontSize: 12, color: "#6b7280" },
  form: { display: "grid", gap: 8, gridTemplateColumns: "repeat(12, 1fr)", margin: "16px 0" },
  input: { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12, outline: "none" },
  button: { padding: "10px 14px", border: "1px solid #111", background: "#111", color: "#fff", borderRadius: 12, cursor: "pointer" },
  list: { display: "grid", gap: 10, marginBottom: 40 },
  card: { border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 },
  row: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  badge: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, border: "1px solid #e5e7eb", padding: "2px 6px", borderRadius: 999 },
  label: { fontSize: 12, color: "#6b7280" },
  h3: { margin: "6px 0 2px", fontSize: 16, fontWeight: 600 },
  muted: { fontSize: 12, color: "#6b7280" },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 4 }
};

// ---------- components ----------
function Header() {
  return (
    <header style={S.header}>
      <div style={{ ...S.container }}>
        <div style={S.headerRow}>
          <div style={S.headLeft}>
            <img src="/kart-logo.png" alt="KART AI logo" style={S.logo} />
            <div style={S.headLeft}>
              <p style={S.subtitle}>Real Prices. Real Savings. Real Time.</p>
            </div>
          </div>
          
        </div>
      </div>
    </header>
  );
}

function TypeToggle({ value, onChange }) {
  const base = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 8,
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  const active = {
    border: "1px solid #16a34a", // branded green border
    boxShadow: "0 0 0 3px rgba(22,163,74,0.15)",
  };
  const img = { width: 24, height: 24, objectFit: "contain" };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        aria-label="Grocery"
        onClick={() => onChange("grocery")}
        style={{ ...base, ...(value === "grocery" ? active : {}) }}
      >
        <img src="/icons/cart_icon.png" alt="" style={img} />
      </button>
      <button
        type="button"
        aria-label="Gas"
        onClick={() => onChange("gas")}
        style={{ ...base, ...(value === "gas" ? active : {}) }}
      >
        <img src="/icons/gas_icon.png" alt="" style={img} />
      </button>
    </div>
  );
}


function DealCard({ deal, onDelete, onEdit }) {
  const perKg = deal.type === "grocery" ? (deal.normalizedPerKg ?? toPerKg(deal.price, deal.unit)) : null;
  const perLb = deal.type === "grocery" && perKg != null ? toPerLb(perKg, "/kg") : null;
  const perL  = deal.type === "gas" ? (deal.normalizedPerL ?? toPerL(deal.price, deal.unit)) : null;
  const perGal = deal.type === "gas" && perL != null ? toPerGal(perL, "/L") : null;
  
 return (
    <div style={S.card}>
      <div style={S.row}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={S.badge}>{deal.type === "grocery" ? "Grocery" : "Gas"}</span>
            {deal.station ? <span style={S.muted}>{deal.station}</span> : null}
          </div>
          <h3 style={S.h3}>{deal.item}</h3>
          <p style={S.muted}>
            {deal.store || deal.station ? `${deal.store || deal.station} · ` : ""}
            {deal.location}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {money(deal.price)} <span style={{ ...S.muted, fontWeight: 400 }}>{deal.unit}</span>
          </div>

          {deal.type === "grocery" && perKg != null && (
            <div style={S.muted}>≈ {money(perKg)} /kg · ≈ {money(perLb)} /lb</div>
          )}
          {deal.type === "gas" && perL != null && (
            <div style={S.muted}>≈ {money(perL)} /L · ≈ {money(perGal)} /gal</div>
          )}

          <div style={S.muted}>{new Date(deal.addedAt).toLocaleString()}</div>
        </div>
      </div>
      {/* Buttons live inside the card */}
<div style={{ marginTop: 8, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
  <button onClick={() => onEdit(deal.id)} style={{ ...S.button }} title="Edit price/unit">
    Edit
  </button>
  <button
    onClick={() => onDelete(deal.id)}
    style={{ ...S.button, background: "#fff", color: "#111", borderColor: "#e5e7eb" }}
  >
    Delete
  </button>
</div>

    </div>
  );
}

function DealsList({ deals, onDelete, onEdit }) {
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
          <DealCard key={d.id} deal={d} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

function AddDealForm({ onAdd, activeType }) {
    const [form, setForm] = useState({
      type: activeType,
      item: "",
      store: "",
      station: "",
      location: "",
      price: "",
      unit: activeType === "gas" ? "/L" : "/ea",
});
    useEffect(() => {
      setForm(f => ({
        ...f,
        type: activeType,
        unit: activeType === "gas" ? "/L" : "/ea",
      }));
    }, [activeType]);

  const [error, setError] = useState("");

  const unitOptions = form.type === "grocery" ? ["/ea", "/dozen", "/lb", "/kg", "/100g"] : ["/L", "/gal"];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const priceNum = Number(form.price);
    if (!form.item.trim()) return setError("Item name is required.");
    if (!form.location.trim()) return setError("Location is required.");
    if (form.type === "grocery" && !form.store.trim()) return setError("Store is required for groceries.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Enter a valid price.");

    onAdd({
      id: crypto.randomUUID(),
      type: form.type,
      item: form.item.trim(),
      store: form.store.trim(),
      station: form.station.trim(),
      location: form.location.trim(),
      price: priceNum,
      unit: form.unit,
      normalizedPerKg: form.type === "grocery" ? toPerKg(priceNum, form.unit) : null,
      normalizedPerL: form.type === "gas" ? toPerL(priceNum, form.unit) : null,
      addedAt: Date.now(),
    });

    setForm({ type: "grocery", item: "", store: "", station: "", location: "", price: "", unit: "/ea" });
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...S.container, padding: "0 16px 12px" }}>
      <div style={S.form}>
        
        <input name="item" value={form.item} onChange={handleChange} placeholder={form.type === "gas" ? "Fuel (e.g., Regular Unleaded)" : "Item (e.g., Chicken Thighs)"} style={{ ...S.input, gridColumn: "span 3" }} />

        {form.type === "grocery" ? (
          <input name="store" value={form.store} onChange={handleChange} placeholder="Store (e.g., Costco)" style={{ ...S.input, gridColumn: "span 2" }} />
        ) : (
          <input name="station" value={form.station} onChange={handleChange} placeholder="Station (e.g., Shell Alta Vista)" style={{ ...S.input, gridColumn: "span 2" }} />
        )}

        <input name="location" value={form.location} onChange={handleChange} placeholder="Location (City, Region)" style={{ ...S.input, gridColumn: "span 3" }} />

        <input name="price" value={form.price} onChange={handleChange} placeholder="Price (e.g., 4.99)" style={{ ...S.input, gridColumn: "span 1" }} />

        <select name="unit" value={form.unit} onChange={handleChange} style={{ ...S.input, gridColumn: "span 1" }}>
          {unitOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {error && <p style={S.error}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button type="submit" style={S.button}>Add</button>
      </div>
    </form>
  );
}

export default function App() {
  const [deals, setDeals] = useState(() => {
    try {
      const raw = localStorage.getItem("kart-deals");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }); 
  
  useEffect(() => {
    try {
      localStorage.setItem("kart-deals", JSON.stringify(deals));
    } catch {}
  }, [deals]);
  // Persisted UI state
    const [query, setQuery] = useState(() => localStorage.getItem("kart-query") || "");
    const [sortBy, setSortBy] = useState(() => localStorage.getItem("kart-sortBy") || "newest");
    const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("kart-typeFilter") || "all");

    // Save to localStorage whenever they change
    useEffect(() => { localStorage.setItem("kart-query", query); }, [query]);
    useEffect(() => { localStorage.setItem("kart-sortBy", sortBy); }, [sortBy]);
    useEffect(() => { localStorage.setItem("kart-typeFilter", typeFilter); }, [typeFilter]);



  function handleAdd(newDeal) {
    setDeals((d) => [newDeal, ...d]);
  }
  function handleDelete(id) {
    setDeals((d) => d.filter((x) => x.id !== id));
  }
  function handleEdit(id) {
  const d = deals.find(x => x.id === id);
  if (!d) return;

  const priceStr = prompt(`Update price for "${d.item}" (${d.unit}). Current: ${d.price}`, String(d.price));
  if (priceStr == null) return; // user cancelled
  const newPrice = Number(priceStr);
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    alert("Please enter a valid positive number for price.");
    return;
  }

  const newUnit = (prompt('Unit (use one of: "ea", "/kg", "/lb", "/L", "/gal")', d.unit) || d.unit).trim();

  // Recompute normalized fields used for sorting/comparison
  let normalizedPerKg = d.normalizedPerKg ?? null;
  let normalizedPerL  = d.normalizedPerL ?? null;
  if (d.type === "grocery") {
    normalizedPerKg = toPerKg(newPrice, newUnit);
  } else if (d.type === "gas") {
    normalizedPerL = toPerL(newPrice, newUnit);
  }

  setDeals(prev =>
    prev.map(x =>
      x.id === id ? { ...x, price: newPrice, unit: newUnit, normalizedPerKg, normalizedPerL } : x
    )
  );
} 
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = [...deals];
    if (typeFilter !== "all") out = out.filter((d) => d.type === typeFilter);
    if (q) {
      out = out.filter((d) =>
        [d.item, d.store, d.station, d.location].some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case "price-asc":
        out.sort((a, b) => {
          const aNorm = a.type === "grocery" ? (a.normalizedPerKg ?? toPerKg(a.price, a.unit) ?? a.price)
                                             : (a.normalizedPerL ?? toPerL(a.price, a.unit) ?? a.price);
          const bNorm = b.type === "grocery" ? (b.normalizedPerKg ?? toPerKg(b.price, b.unit) ?? b.price)
                                             : (b.normalizedPerL ?? toPerL(b.price, b.unit) ?? b.price);
          return (aNorm ?? Infinity) - (bNorm ?? Infinity);
        });
        break;
      case "price-desc":
        out.sort((a, b) => {
          const aNorm = a.type === "grocery" ? (a.normalizedPerKg ?? toPerKg(a.price, a.unit) ?? a.price)
                                             : (a.normalizedPerL ?? toPerL(a.price, a.unit) ?? a.price);
          const bNorm = b.type === "grocery" ? (b.normalizedPerKg ?? toPerKg(b.price, b.unit) ?? b.price)
                                             : (b.normalizedPerL ?? toPerL(b.price, b.unit) ?? b.price);
          return (bNorm ?? -Infinity) - (aNorm ?? -Infinity);
        });
        break;
      case "alpha":
        out.sort((a, b) => (a.item || "").localeCompare(b.item || ""));
        break;
      default:
        out.sort((a, b) => b.addedAt - a.addedAt);
    }
    return out;
  }, [deals, query, sortBy, typeFilter]);

  return (
    <div style={S.page}>
      <Header />
      <main style={{ ...S.container, padding: "0 16px" }}>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 0" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, stores, stations, locations…"
            style={{ ...S.input, flex: "1 1 320px" }}
          />
         <div style={{ display: "flex", gap: 12 }}>
  {/* Grocery Button */}
  <button
    onClick={() => setTypeFilter("grocery")}
    style={{
      border: typeFilter === "grocery" ? "2px solid #00674F" : "1px solid #e5e7eb",
      background: typeFilter === "grocery" ? "#E7F3F0" : "#fff",
      borderRadius: 12,
      padding: 10,
      cursor: "pointer"
    }}
  >
    <img src="/icons/cart_icon.png" alt="Groceries" style={{ width: 28, height: 28 }} />
  </button>

  {/* Gas Button */}
  <button
    onClick={() => setTypeFilter("gas")}
    style={{
      border: typeFilter === "gas" ? "2px solid #00674F" : "1px solid #e5e7eb",
      background: typeFilter === "gas" ? "#E7F3F0" : "#fff",
      borderRadius: 12,
      padding: 10,
      cursor: "pointer"
    }}
  >
    <img src="/icons/gas_icon.png" alt="Gas" style={{ width: 28, height: 28 }} />
  </button>

  {/* Optional "All" Button */}
  <button
    onClick={() => setTypeFilter("all")}
    style={{
      border: typeFilter === "all" ? "2px solid #00674F" : "1px solid #e5e7eb",
      background: typeFilter === "all" ? "#E7F3F0" : "#fff",
      borderRadius: 12,
      padding: 10,
      cursor: "pointer"
    }}
  >
    All
  </button>
</div>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={S.input}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price (Low → High)</option>
            <option value="price-desc">Price (High → Low)</option>
            <option value="alpha">A → Z</option>
          </select>
        </div>

        <AddDealForm AddDealForm
          onAdd={handleAdd}
          activeType={typeFilter === "all" ? "grocery" : typeFilter} />
        <DealsList deals={filtered} onDelete={handleDelete} onEdit={handleEdit} />

      </main>
    </div>
  );
}
