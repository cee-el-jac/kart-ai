import React, { useEffect, useState } from "react";

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function onToast(e) {
      const id = Math.random().toString(36).slice(2);
      const { message, type = "success", ttl = 2200 } = e.detail || {};
      const t = { id, message, type };
      setToasts((arr) => [...arr, t]);
      // auto-remove
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), ttl);
    }
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);

  const wrap = {
    position: "fixed",
    right: 16,
    bottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 9999,
  };

  return (
    <div style={wrap} aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            minWidth: 220,
            maxWidth: 360,
            padding: "10px 12px",
            borderRadius: 12,
            color: "#fff",
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            background:
              t.type === "error"
                ? "#B91C1C"
                : t.type === "warn"
                ? "#D97706"
                : "#00674F", // success default
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/** Convenience helper (optional) */
export function toast(message, opts = {}) {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, ...opts } }));
} 