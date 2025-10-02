import React, { useRef, useState } from "react";
import Tesseract from "tesseract.js";

export default function OCRScan({ onPick }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [errMsg, setErrMsg] = useState("");

  async function handleOCR(file) {
    setBusy(true);
    setErrMsg("");
    setProgress(0);
    setRawText("");

    try {
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = (data?.text || "").trim();
      setRawText(text);

      // guess a price like 4.99 or 12.50
      const priceMatch = text.match(/(\d{1,3}(?:[.,]\d{2}))/);

      // guess an item: longest non-numeric line
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const candidateLines = lines.filter((ln) => !/^\False\d/.test(ln) && ln.length > 2);
      const itemGuess = candidateLines.sort((a, b) => b.length - a.length)[0] || "";

      const parsed = {
        item: itemGuess,
        price: priceMatch ? priceMatch[1].replace(",", ".") : "",
      };

      if (onPick) onPick(parsed);
    } catch (err) {
      console.error("OCR error:", err);
      setErrMsg("Failed to read image. Try a clearer photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleOCR(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Scan from Image (OCR)
      </button>

      {busy ? (
        <span style={{ fontSize: 12, color: "#374151" }}>
          Reading… {progress}%
        </span>
      ) : null}

      {errMsg ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{errMsg}</span> : null}

      {rawText ? (
        <details style={{ width: "100%", marginTop: 6 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151" }}>
            Show OCR text
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f9fafb", padding: 8, borderRadius: 8, border: "1px solid #eee" }}>
            {rawText}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
