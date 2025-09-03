// src/components/DealCard.jsx
import React from "react";
import { money, toPerKg, toPerLb, toPerGal, toPerL } from "../utils/conversions";

const S = {
  card: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  row: { display: "flex", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" },
  muted: { color: "#6b7280", fontSize: 12 },
  price: { fontSize: 18, fontWeight: 700, textAlign: "right" },
  footer: { marginTop: "auto", paddingTop: 8, textAlign: "right" },
  button: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    padding: "6px 10px",
    borderRadius: 10,
    cursor: "pointer",
  },
};

export default function DealCard({ deal, onDelete, onEdit }) {
  // derived prices for display
  const perKg = deal.type === "grocery" && deal.normalizedPerKg != null
    ? deal.normalizedPerKg
    : null;
  const perLb = perKg != null ? toPerLb(perKg, "/kg") : null;

  const perL = deal.type === "gas" && deal.normalizedPerL != null
    ? deal.normalizedPerL
    : null;
  const perGal = perL != null ? toPerGal(perL, "/L") : null;

  return (
    <div style={S.card}>
      <div style={S.row}>
        <span className="badge" style={S.muted}>
          {deal.type === "grocery" ? "GROCERY" : "GAS"}
        </span>
      </div>

      <h3 style={S.title}>{deal.item}</h3>
      <div style={S.muted}>
        {deal.store || deal.station} · {deal.location}
      </div>

      <div style={{ ...S.price, marginTop: 6 }}>
        {money(deal.price)} <span style={{ ...S.muted, fontWeight: 400 }}>/{deal.unit}</span>
      </div>

      {perKg != null && (
        <div style={S.muted}>≈ {money(perKg)} /kg · {money(perLb)} /lb</div>
      )}
      {perL != null && (
        <div style={S.muted}>≈ {money(perL)} /L · {money(perGal)} /gal</div>
      )}

      <div style={S.muted}>{new Date(deal.addedAt).toLocaleString()}</div>

      {/* Footer pinned to bottom */}
      <div style={S.footer}>
        <button
          onClick={() => onDelete?.(deal.id)}
          style={S.button}
          aria-label="Delete deal"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
