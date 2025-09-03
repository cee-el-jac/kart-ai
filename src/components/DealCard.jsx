// src/components/DealCard.jsx
import React from "react";
import { toPerKg, toPerLb, toPerL, toPerGal, money } from "../utils/conversions";

export default function DealCard({ deal, onDelete }) {
  const isGrocery = deal.type === "grocery";
  const isGas = deal.type === "gas";

  const perKg  = isGrocery ? toPerKg(deal.price, deal.unit) : null;
  const perLb  = isGrocery ? toPerLb(deal.price, deal.unit) : null;
  const perL   = isGas ? toPerL(deal.price, deal.unit) : null;
  const perGal = isGas ? toPerGal(deal.price, deal.unit) : null;

  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 12, padding: 16,
      display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center",
      marginBottom: 12, background: "#fff"
    }}>
      <div>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
          {isGrocery ? "GROCERY" : "GAS"} • {(deal.store || deal.station) || "—"} • {deal.location}
        </div>
        <div style={{ fontWeight: 600 }}>{deal.item}</div>

        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
          {isGrocery && (perKg != null || perLb != null) && (
            <>
              {perKg != null && <>≈ {money(perKg)} /kg</>}
              {perKg != null && perLb != null && " · "}
              {perLb != null && <>≈ {money(perLb)} /lb</>}
            </>
          )}
          {isGas && (perL != null || perGal != null) && (
            <>
              {perL != null && <>≈ {money(perL)} /L</>}
              {perL != null && perGal != null && " · "}
              {perGal != null && <>≈ {money(perGal)} /gal</>}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 700 }}>{money(deal.price)} {deal.unit}</div>
        <button
          onClick={() => onDelete(deal.id)}
          style={{
            padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 10,
            background: "#fff", cursor: "pointer"
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
