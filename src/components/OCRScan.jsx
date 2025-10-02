import React, { useRef, useState } from "react";
import Tesseract from "tesseract.js";

export default function OCRScan({ onPick }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [errMsg, setErrMsg] = useState("");

  function clickPick() {
    fileRef.current?.click();
  }

  async function handleOCR(file) {
    setBusy(true);
    setErrMsg("");
    setProgress(5);
    setRawText("");

    try {
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status?.includes("recognizing") && typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // --------------- Normalize text ---------------
      let text = (data.text || "").replace(/\r/g, "");
      // common OCR artifacts:
      text = text
        .replace(/[§$S]\s*AVE/gi, "SAVE") // e.g. "§AVE" -> "SAVE"
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s{2,}/g, " ")
        .replace(/[|]/g, "I"); // vertical bar to I

      setRawText(text);

      // --------------- Regex helpers ---------------
      const rx = {
        price: /\$?\s*\d+[.,]\d{2}/g, // $12.34 or 12.34
        perUnit: /\$?\s*\d+[.,]\d+\s*\/\s*(kg|lb)/i, // $10.79/kg  or  4.99 / lb
        anyPerUnitAll: /\$?\s*\d+[.,]\d+\s*\/\s*(kg|lb)/gi,
        weight: /\b\d+[.,]\d+\s*(kg|lb)\b/i, // 2.206 kg, 4.2 lb
        weightAll: /\b\d+[.,]\d+\s*(kg|lb)\b/gi,
        // “EQUAL TO $4.99/lb”, “= $4.99/lb”, “equal $4.99/lb”
        equalLine: /(equal\s*(to)?|=)\s*\$?\s*\d+[.,]\d+\s*\/\s*(kg|lb)/i,
      };

      // capture blocks that likely contain meat/produce labels
      const candidateLines = text.split("\n").map((s) => s.trim()).filter(Boolean);

      // --------------- Find values ---------------
      // prices (collect all, pick the largest as "total" if weight also present)
      const allPrices = (text.match(rx.price) || [])
        .map((s) => Number(s.replace(/[^0-9.,]/g, "").replace(",", ".")))
        .filter((n) => isFinite(n));

      // per-unit
      const perUnitMatches = text.match(rx.anyPerUnitAll) || [];
      const perUnit = perUnitMatches
        .map((s) => {
          const num = Number(s.replace(/[^0-9.,]/g, "").replace(",", "."));
          const unit = /kg/i.test(s) ? "/kg" : "/lb";
          return isFinite(num) ? { value: num, unit } : null;
        })
        .filter(Boolean)
        // prefer the one that appears in a line with meat keywords or “equal”
        .sort((a, b) => a.value - b.value)[0] || null;

      // explicit “equal to … /kg|lb”
      if (!perUnit) {
        const eq = text.match(rx.equalLine);
        if (eq) {
          const s = eq[0];
          const num = Number(s.replace(/[^0-9.,]/g, "").replace(",", "."));
          const unit = /kg/i.test(s) ? "/kg" : "/lb";
          if (isFinite(num)) {
            // eslint-disable-next-line no-param-reassign
            perUnitMatches.push(s);
          }
        }
      }

      // weight(s)
      const weights = (text.match(rx.weightAll) || []).map((s) => {
        const num = Number(s.replace(/[^0-9.,]/g, "").replace(",", "."));
        const unit = /kg/i.test(s) ? "kg" : "lb";
        return isFinite(num) ? { value: num, unit } : null;
      }).filter(Boolean);

      // choose most plausible weight: the largest with reasonable bounds
      const weight = weights
        .filter((w) => w.value > 0.1 && w.value < 50)
        .sort((a, b) => b.value - a.value)[0] || null;

      // choose total price: if we have weight & perUnit, total may be the largest price
      let total = null;
      if (allPrices.length) {
        const sorted = [...allPrices].sort((a, b) => b - a);
        total = sorted[0];
      }

      // --------------- Keyword / item guess ---------------
      const KEYWORDS = ["beef","ground","lean","lamb","pork","chicken","rib","steak","roast","short","cut","shoulder","loin","saus", "sausage"];
      const kwFound = [];
      for (const k of KEYWORDS) {
        if (new RegExp(`\\b${k}\\b`, "i").test(text)) kwFound.push(k);
      }

      // “item” guess: pick longest line that has at least one keyword and few digits
      const itemGuess =
        candidateLines
          .filter((line) => /\b(beef|lamb|pork|chicken|roast|steak|ground|loin|rib|shoulder|short)\b/i.test(line))
          .filter((line) => (line.replace(/\d/g, "").length / Math.max(1, line.length)) > 0.7)
          .sort((a, b) => b.length - a.length)[0] ||
        (kwFound.length ? kwFound.join(" ") : "");

      // --------------- Compose result ---------------
      const result = {
        item: (itemGuess || "").slice(0, 80).trim(),
        price: total != null ? Number(total.toFixed(2)) : null,
        perUnit: perUnit ? `/${perUnit.unit.replace("/", "")}` : null, // "/kg" | "/lb" (UI format expects like "/kg")
        perUnitPrice: perUnit ? Number(perUnit.value.toFixed(2)) : null,
        weight: weight ? Number(weight.value.toFixed(3)) : null,
        weightUnit: weight ? weight.unit : null,
        raw: text,
        keywords: kwFound,
      };

      if (onPick) onPick(result);
    } catch (err) {
      console.error("OCR error:", err);
      setErrMsg("Failed to read image. Try a clearer photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
        onClick={clickPick}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Scan from Image (OCR)
      </button>

      {busy ? (
        <span style={{ fontSize: 12, color: "#374151" }}>Reading… {progress}%</span>
      ) : null}

      {errMsg ? (
        <span style={{ fontSize: 12, color: "#B91C1C" }}>{errMsg}</span>
      ) : null}

      {rawText ? (
        <details style={{ width: "100%", marginTop: 6 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151" }}>
            Show OCR text { /* optionally list keywords */ }
          </summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 12,
              background: "#f9fafb",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #eee",
              overflow: "auto",
            }}
          >
            {rawText}
          </pre>
        </details>
      ) : null}
    </div>
  );
} 