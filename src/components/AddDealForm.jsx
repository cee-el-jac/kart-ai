// src/components/AddDealForm.jsx
import React, { useState } from "react";
import { addDeal } from "../services/firestoreDeals";

// tiny helper so we never get stuck in "Adding…"
const withTimeout = (p, ms = 8000) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("Timed out")), ms)),
  ]);

export default function AddDealForm({ onAdd }) {
  const [item, setItem] = useState("");
  const [store, setStore] = useState("");
  const [location, setLocation] = useState("");
  const [unit, setUnit] = useState("/ea");
  const [price, setPrice] = useState("");
  const [caption, setCaption] = useState("");
  const [multiEnabled, setMultiEnabled] = useState(false);
  const [multiTotal, setMultiTotal] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave =
    item.trim() &&
    store.trim() &&
    location.trim() &&
    price !== "" &&
    !Number.isNaN(Number(price));

  async function handleUseMyLocation() {
    try {
      if (!navigator.geolocation) return alert("Geolocation not supported.");
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      const { latitude, longitude } = pos.coords;
      setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch (e) {
      console.error("Location error:", e);
      alert("Could not get your location.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);
    try {
      const payload = {
        type: "grocery",
        item: item.trim(),
        store: store.trim(),
        location: location.trim(),
        unit: unit || "/ea",
        price: Number(price),
        caption: caption.trim() || "",
        multiEnabled: !!multiEnabled,
        multiTotal: multiEnabled ? Number(multiTotal || 0) : 0,
      };

      const id = await withTimeout(addDeal(payload)); // 🔒 never hang
      console.log("✅ Wrote /deals/", id);
      onAdd && onAdd(id, payload);

      // reset
      setItem("");
      setStore("");
      setLocation("");
      setUnit("/ea");
      setPrice("");
      setCaption("");
      setMultiEnabled(false);
      setMultiTotal("");
    } catch (err) {
      console.error("Add deal failed:", err);
      alert("Failed to add deal: " + (err?.message || err));
    } finally {
      setSaving(false); // ✅ always clears "Adding…"
    }
  }

  function handleReset() {
    setItem("");
    setStore("");
    setLocation("");
    setUnit("/ea");
    setPrice("");
    setCaption("");
    setMultiEnabled(false);
    setMultiTotal("");
  }

  return (
    <form onSubmit={handleSubmit} style={styles.card}>
      {/* 2-column responsive grid so the form doesn’t stretch */}
      <div style={styles.grid}>
        <input
          placeholder="Item (e.g., Chicken Thighs)"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          style={styles.input}
        />
        <input
          placeholder="Store (e.g., Frescho)"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          style={styles.input}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Location (City, Province/State)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ ...styles.input, flex: 1 }}
          />
          <button
            type="button"
            aria-label="Use my location"
            title="Use my location"
            onClick={handleUseMyLocation}
            style={styles.pill}
          >
            <span style={{ marginRight: 4 }}>📍</span> Use my location
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ ...styles.input, maxWidth: 110 }}
          >
            <option value="/ea">/ea</option>
            <option value="/lb">/lb</option>
            <option value="/kg">/kg</option>
            <option value="/L">/L</option>
          </select>

          <label style={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={multiEnabled}
              onChange={(e) => setMultiEnabled(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Multi-buy? (e.g., 2 for $5)
          </label>

          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Price (e.g., 4.99)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...styles.input, maxWidth: 160 }}
          />
        </div>

        {multiEnabled && (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Multi total price (e.g., 5.00)"
            value={multiTotal}
            onChange={(e) => setMultiTotal(e.target.value)}
            style={{ ...styles.input, maxWidth: 220 }}
          />
        )}

        <input
          placeholder="Add a caption or notes (optional)…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{ ...styles.input, gridColumn: "1 / -1" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button type="button" onClick={handleReset} style={styles.btnGhost}>
          Reset
        </button>
        <button
          type="submit"
          disabled={!canSave || saving}
          style={{
            ...styles.btnPrimary,
            opacity: !canSave || saving ? 0.65 : 1,
            cursor: !canSave || saving ? "not-allowed" : "pointer",
          }}
          title={canSave ? "Add deal" : "Fill required fields first"}
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

const styles = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#fff",
    marginTop: 8,
    maxWidth: 1000,      // ✅ keeps form from spanning the whole page
    marginInline: "auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  input: {
    height: 40,
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
    width: "100%",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 40,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  checkboxWrap: { display: "flex", alignItems: "center", gap: 6 },
  btnPrimary: {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #0ea5e9",
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: 600,
  },
  btnGhost: {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
  },
}