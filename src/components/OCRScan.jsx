// src/components/OCRScan.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { useRemoteOCRTestData } from "../hooks/useRemoteOCRTestData";

/**
* OCRScan — Day 6 (final w/ remote test data)
* - Dual-ROI gas reading (upper/lower rows) with independent thresholds
* - Live previews, confidence, digit ratio, elapsed time
* - Y-offset slider to nudge ROIs up/down together
* - Optional "Auto-Otsu" local threshold mode
* - Remote test-data & preset loader (quick A/B)
* - Rescan without re-upload
* - Optional onSuggest(...) to push draft to "Add Deal"
*/

export default function OCRScan({ onSuggest, configUrl = "/ocr-testdata.json" }) {
  // ---------- UI state ----------
  const [status, setStatus] = useState("");
  const [textFull, setTextFull] = useState("");
  const [upperConf, setUpperConf] = useState(null);
  const [lowerConf, setLowerConf] = useState(null);
  const [digitRatio, setDigitRatio] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const [imageUrl, setImageUrl] = useState("");
  const [mode, setMode] = useState("gas"); // "gas" | "shelf" | "receipt"

  // tuning knobs
  const [scale, setScale] = useState(3.4);
  const [threshA, setThreshA] = useState(150);
  const [threshB, setThreshB] = useState(150);
  const [invert, setInvert] = useState(false);
  const [autoOtsu, setAutoOtsu] = useState(true);
  const [yOffset, setYOffset] = useState(0.06); // 0.00–0.12 good range for your gas boards

  // previews
  const [prevA, setPrevA] = useState("");
  const [prevB, setPrevB] = useState("");

  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const debounceRef = useRef(null);

  // remote test-data (non-blocking; safe if missing)
  const { loading: cfgLoading, error: cfgError, images, presets } = useRemoteOCRTestData(configUrl);

  // ---------- Controls ----------
  const handlePick = () => fileRef.current?.click();
  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    resetOutputs();
  }

  function resetOutputs() {
    setTextFull("");
    setUpperConf(null);
    setLowerConf(null);
    setDigitRatio(null);
    setElapsed(null);
    setPrevA("");
    setPrevB("");
    setStatus("Ready");
  }

  // Default ROIs by mode (fractions)
  const params = useMemo(() => {
    switch (mode) {
      case "gas": {
        // Base Y positions for the two price bands (nudged by yOffset)
        const baseUpper = 0.31 + yOffset;
        const baseLower = 0.58 + yOffset;
        return {
          roiA: { x: 0.12, y: clamp(baseUpper, 0, 0.88), w: 0.76, h: 0.22 },
          roiB: { x: 0.12, y: clamp(baseLower, 0, 0.88), w: 0.76, h: 0.22 },
          psm: Tesseract.PSM.SINGLE_LINE,
          lang: "eng+fra",
        };
      }
      case "shelf":
        return {
          roiA: { x: 0.08, y: 0.12, w: 0.84, h: 0.70 },
          psm: Tesseract.PSM.SINGLE_BLOCK,
          lang: "eng+fra",
        };
      case "receipt":
      default:
        return {
          roiA: { x: 0.06, y: 0.06, w: 0.88, h: 0.88 },
          psm: Tesseract.PSM.SINGLE_BLOCK,
          lang: "eng+fra",
        };
    }
  }, [mode, yOffset]);

  // Auto-rescan when knobs change (with debounce)
  useEffect(() => {
    if (!imageUrl) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runOCR(imageUrl), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scale, threshA, threshB, invert, autoOtsu, yOffset]);

  // ---------- OCR core ----------
  async function runOCR(url) {
    const start = performance.now();
    setStatus("Preparing image…");
    try {
      const src = await loadImage(url);

      // Build canvases for A/B (gas) or single A (other)
      const aCanvas = preprocess(src, params.roiA, {
        scale, threshold: threshA, invert, autoOtsu,
      });
      const aUrl = aCanvas.toDataURL("image/png");
      setPrevA(aUrl);

      let text = "";
      if (mode === "gas" && params.roiB) {
        const bCanvas = preprocess(src, params.roiB, {
          scale, threshold: threshB, invert, autoOtsu,
        });
        const bUrl = bCanvas.toDataURL("image/png");
        setPrevB(bUrl);

        setStatus("Running OCR (upper)...");
        const upper = await Tesseract.recognize(aCanvas, params.lang, {
          tessedit_pageseg_mode: params.psm,
        });

        setStatus("Running OCR (lower)...");
        const lower = await Tesseract.recognize(bCanvas, params.lang, {
          tessedit_pageseg_mode: params.psm,
        });

        text = [upper?.data?.text || "", lower?.data?.text || ""]
          .map((s) => s.replace(/\u00A0/g, " ").trim())
          .filter(Boolean)
          .join("\n");

        setUpperConf(snapPct(upper?.data?.confidence));
        setLowerConf(snapPct(lower?.data?.confidence));
      } else {
        setPrevB("");
        setStatus("Running OCR…");
        const single = await Tesseract.recognize(aCanvas, params.lang, {
          tessedit_pageseg_mode: params.psm,
        });
        text = (single?.data?.text || "").replace(/\u00A0/g, " ").trim();
        setUpperConf(snapPct(single?.data?.confidence));
        setLowerConf(null);
      }

      setTextFull(text);

      // digit ratio (quick sanity)
      const digits = (text.match(/\d/g) || []).length;
      const total = text.replace(/\s/g, "").length || 1;
      setDigitRatio(Math.round((digits / total) * 100));

      const ms = Math.max(0, Math.round(performance.now() - start));
      setElapsed(ms);
      setStatus("OCR complete.");
    } catch (err) {
      console.error("OCR error:", err);
      setStatus("OCR failed. Try a clearer image.");
      setPrevA("");
      setPrevB("");
      setUpperConf(null);
      setLowerConf(null);
      setDigitRatio(null);
      setElapsed(null);
    }
  }

  // ---------- Preprocess ----------
  function preprocess(img, roiFrac, opts) {
    const { scale = 2.8, threshold = 150, invert = false, autoOtsu = false } = opts || {};
    const { x, y, w, h } = roiFrac;

    const sx = Math.round(img.naturalWidth * x);
    const sy = Math.round(img.naturalHeight * y);
    const sw = Math.max(1, Math.round(img.naturalWidth * w));
    const sh = Math.max(1, Math.round(img.naturalHeight * h));

    const outW = Math.max(1, Math.round(sw * Math.max(1, scale)));
    const outH = Math.max(1, Math.round(sh * Math.max(1, scale)));

    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = outW;
    canvas.height = outH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const px = imgData.data;

    // grayscale
    for (let i = 0; i < px.length; i += 4) {
      let g = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      if (invert) g = 255 - g;
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    ctx.putImageData(imgData, 0, 0);

    // thresholding
    if (autoOtsu) {
      const { t } = localOtsu(ctx, outW, outH);
      toBinary(ctx, outW, outH, t);
    } else if (Number.isFinite(threshold)) {
      toBinary(ctx, outW, outH, clamp(threshold, 0, 255));
    }
    return canvas;
  }

  function toBinary(ctx, w, h, t) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i] >= t ? 255 : 0;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Tiny local Otsu (fast enough for small ROIs)
  function localOtsu(ctx, w, h) {
    const { data } = ctx.getImageData(0, 0, w, h);
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    const total = (w * h) | 0;

    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];

    let sumB = 0, wB = 0, maxVar = 0, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; threshold = t; }
    }
    return { t: threshold };
  }

  // ---------- Utils ----------
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
  function snapPct(v) {
    const n = Number(v ?? 0);
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // ---------- Suggestion parser (unchanged essence; trimmed) ----------
  function normalizeUnit(s) {
    if (!s) return "/ea";
    const u = s.toLowerCase();
    if (/\b(kg|kilogrammes?|kilograms?)\b/.test(u)) return "/kg";
    if (/\b(lb|pound|livres?)\b/.test(u)) return "/lb";
    if (/\b(100g|100 g)\b/.test(u)) return "/100g";
    if (/\b(l|litre|liter|litres|liters)\b/.test(u)) return "/L";
    if (/\b(gal|gallon)\b/.test(u)) return "/gal";
    if (/\b(dozen|douzaine)\b/.test(u)) return "/dozen";
    return "/ea";
  }
  function findPrices(txt) {
    const prices = [];
    const cleaned = txt.replace(/[O]/g, "0");
    const re = /(?:\$|C\$)?\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:\$|C\$)?/g;
    let m;
    while ((m = re.exec(cleaned))) {
      const v = m[1].replace(",", ".");
      const num = Number(v);
      if (Number.isFinite(num)) prices.push(num);
    }
    return prices;
  }
  function parseMultiBuy(txt) {
    const s = txt.replace(",", ".").replace(/[O]/g, "0");
    const ptns = [
      /(\d+)\s*(?:for|\/|pour)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i,
      /(\d+)\s*(?:for|\/|pour)\s*(\d+(?:\.\d{1,2})?)\s*\$?/i,
    ];
    for (const re of ptns) {
      const m = re.exec(s);
      if (m) {
        const qty = Number(m[1]);
        const total = Number(m[2]);
        if (qty > 0 && Number.isFinite(total)) {
          return { qty, total, perUnit: Number((total / qty).toFixed(4)) };
        }
      }
    }
    return null;
  }
  function guessItemAndStore(lines) {
    const cleaned = lines.map((l) => l.trim()).filter(Boolean).slice(0, 8);
    let item = "", store = "";
    for (const l of cleaned) {
      if (!store && /^[A-Z][A-Z\s&'-]{2,}$/.test(l)) { store = l.slice(0, 60); continue; }
      if (!item && /[A-Za-z]/.test(l) && l.length <= 60) item = l;
      if (item && store) break;
    }
    return { item, store };
  }
  function parseSuggestion(raw) {
    if (!raw) return null;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const isGas = /\b(gas|diesel|unleaded|sans plomb|carburant|octane|regular|premium|super)\b/i.test(raw);
    const type = isGas ? "gas" : "grocery";
    const multi = parseMultiBuy(raw);
    let unit = normalizeUnit(raw);
    let price = null;
    if (multi) price = multi.perUnit;
    else {
      const all = findPrices(raw);
      price = all.length ? all[0] : 0;
    }
    const { item, store } = guessItemAndStore(lines);
    const suggestion = {
      type,
      item: item || "",
      store: store || "",
      station: type === "gas" ? store || "" : "",
      location: "",
      unit,
      price,
      normalizedPerKg: null,
      normalizedPerL: null,
      originalMultiBuy: multi,
    };
    const hasSignal = suggestion.item || suggestion.store || suggestion.price > 0 || suggestion.originalMultiBuy;
    return hasSignal ? suggestion : null;
  }

  // ---------- UI ----------
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={handlePick}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}>
          Scan from image
        </button>

        <select value={mode} onChange={(e) => setMode(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}>
          <option value="gas">Gas sign</option>
          <option value="shelf">Shelf tag</option>
          <option value="receipt">Receipt</option>
        </select>

        <label style={{ fontSize: 12 }}>Scale&nbsp;
          <input type="number" step="0.1" min="1" value={scale}
            onChange={(e) => setScale(Number(e.target.value || 1))}
            style={{ width: 64, padding: "4px 6px" }} />
        </label>

        {mode === "gas" ? (
          <>
            <label style={{ fontSize: 12 }}>Thresh A&nbsp;
              <input type="number" min="0" max="255" value={threshA}
                onChange={(e) => setThreshA(Number(e.target.value))} style={{ width: 64, padding: "4px 6px" }} />
            </label>
            <label style={{ fontSize: 12 }}>Thresh B&nbsp;
              <input type="number" min="0" max="255" value={threshB}
                onChange={(e) => setThreshB(Number(e.target.value))} style={{ width: 64, padding: "4px 6px" }} />
            </label>
          </>
        ) : (
          <label style={{ fontSize: 12 }}>Threshold&nbsp;
            <input type="number" min="0" max="255" value={threshA}
              onChange={(e) => setThreshA(Number(e.target.value))} style={{ width: 72, padding: "4px 6px" }} />
          </label>
        )}

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Invert
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={autoOtsu} onChange={(e) => setAutoOtsu(e.target.checked)} /> Auto-Otsu
        </label>

        {mode === "gas" && (
          <label style={{ fontSize: 12 }}>Y-offset&nbsp;
            <input type="range" min="-0.10" max="0.12" step="0.01" value={yOffset}
              onChange={(e) => setYOffset(Number(e.target.value))}
              style={{ width: 120, verticalAlign: "middle" }} />
          </label>
        )}

        <button onClick={() => imageUrl && runOCR(imageUrl)}
          style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}>
          Rescan
        </button>

        {onSuggest && (
          <button
            onClick={() => { const s = parseSuggestion(textFull); if (s) onSuggest(s); }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}>
            Use in Add Deal
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} style={{ display: "none" }} />

      {/* Remote test data bar */}
      <div style={{ marginTop: 10, padding: 8, background: "#f9fafb", border: "1px solid #eef2f7", borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#374151" }}>
            Test data {cfgLoading ? "(loading…)" : cfgError ? `(error: ${cfgError})` : ""}
          </span>
          <select
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            onChange={(e) => {
              const p = presets.find((x) => x.id === e.target.value);
              if (!p) return;
              if (p.mode) setMode(p.mode);
              if (Number.isFinite(p.scale)) setScale(p.scale);
              if (Number.isFinite(p.threshA)) setThreshA(p.threshA);
              if (Number.isFinite(p.threshB)) setThreshB(p.threshB);
              if (typeof p.invert === "boolean") setInvert(p.invert);
              if (typeof p.autoOtsu === "boolean") setAutoOtsu(p.autoOtsu);
              if (Number.isFinite(p.yOffset)) setYOffset(p.yOffset);
            }}
            defaultValue=""
          >
            <option value="" disabled>Choose preset…</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <select
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            onChange={(e) => {
              const img = images.find((x) => x.id === e.target.value);
              if (!img) return;
              setImageUrl(img.url);
              resetOutputs();
            }}
            defaultValue=""
          >
            <option value="" disabled>Load sample image…</option>
            {images.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </div>
      </div>

      {/* Status row */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#374151", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div><strong>Status:</strong> {status || "—"}</div>
        <div><strong>Upper conf:</strong> {upperConf !== null ? `${upperConf}%` : "—"}</div>
        <div><strong>Lower conf:</strong> {lowerConf !== null ? `${lowerConf}%` : (mode === "gas" ? "—" : "n/a")}</div>
        <div><strong>Digit ratio:</strong> {digitRatio !== null ? `${digitRatio}%` : "—"}</div>
        <div><strong>Elapsed:</strong> {elapsed !== null ? `${elapsed} ms` : "—"}</div>
      </div>

      {/* Image + processed previews + text */}
      {imageUrl ? (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "flex-start", marginTop: 10 }}>
          <img
            src={imageUrl}
            alt="Selected"
            style={{ width: 220, height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
            onLoad={() => runOCR(imageUrl)}
          />
          <div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              {prevA && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Processed ROI A (upper)</div>
                  <img src={prevA} alt="processed A" style={{ maxWidth: 320, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                </div>
              )}
              {prevB && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Processed ROI B (lower)</div>
                  <img src={prevB} alt="processed B" style={{ maxWidth: 320, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                </div>
              )}
            </div>
            <textarea
              value={textFull}
              readOnly
              placeholder="OCR text will appear here…"
              style={{ width: "100%", minHeight: 180, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
} 