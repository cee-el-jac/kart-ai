// src/components/DealList.jsx
import React from "react";
import DealCard from "./DealCard";

export default function DealList({ deals, onDelete, onEdit }) {
  if (!deals.length) {
    return (
      <div style={{ maxWidth: 960, margin: "0 16px 24px" }}>
        <p style={{ color: "#6b7280", textAlign: "center" }}>
          No deals yet. Add your first one above!
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 16px 24px" }}>
      {deals.map((d) => (
        <div key={d.id} style={{ marginBottom: 12 }}>
          <DealCard deal={d} onDelete={onDelete} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );
}
