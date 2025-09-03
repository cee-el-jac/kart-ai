// src/components/DealList.jsx
import React from "react";
import DealCard from "./DealCard";

export default function DealList({ deals, onDelete }) {
  if (!deals.length) {
    return (
      <div style={{
        border: "1px dashed #e5e7eb", borderRadius: 12, padding: 20,
        textAlign: "center", color: "#6b7280", background: "#fafafa", marginBottom: 12
      }}>
        No deals yet. Add your first one above!
      </div>
    );
  }

  return (
    <div>
      {deals.map((d) => (
        <DealCard key={d.id} deal={d} onDelete={onDelete} />
      ))}
    </div>
  );
}
