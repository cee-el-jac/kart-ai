import React, { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";

/* ────────────────────────────────────────────────────────────────────────────
   Utilities (kept ABOVE the component so they’re initialized before use)
──────────────────────────────────────────────────────────────────────────── */
function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}
function clampByte(n) {
  return clamp(0, Number.isFinite(n) ? Math.round(n) : 0, 255);
}
function toInt(v) {
  return Number.isFinite(v) ? Math.round(v) : null;
}
function cleanSpaces(s) {
  return (s || "").replace(/\u00A0/g, " ").trim();
}
function countDigits(s) {
  return (s.match(/\d/g) || []).length;
}

/** Simple Otsu threshold on a canvas region (expects grayscale 0..255) */
function otsuThresholdFromCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);

  // Build grayscale histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    // image is already grayscale in our pipeline; any channel is fine
    const g = data[i] | 0;
    hist[g]++;
  }

  const N = w * h;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let varMax = -1;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = N - wB;
    if (wF === 0) break;

    sumB += t * hist[t];

    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;

    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */
export default function OCRScan({ onSuggest }) {
  // ── UI State ──────────────────────────────────────────────────────────────
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [text, setText] = useState("");

  // confidences/digit quality
  const [confUpper, setConfUpper] = useState(null);
  const [confLower, setConfLower] = useState(null);
  const [digitRatio, setDigitRatio] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(null);

  // knobs
  const [scale, setScale] = useState(3.4);
  const [threshA, setThreshA] = useState(150); // ROI A (upper)
  const [threshB, setThreshB] = useState(150); // ROI B (lower)
  const [invert, setInvert] = useState(false);
  const [autoOtsu, setAutoOtsu] = useState(true);
  const [yOffset, setYOffset] = useState(0.0); // -0.08 .. +0.08

  // previews
  const [previewA, setPreviewA] = useState("");
  const [previewB, setPreviewB] = useState("");

  // fused “final price” (when digits are clean)
  const [finalPrice, setFinalPrice] = useState(null);

  // refs
  const fileRef = useRef(null);
  const workCanvasRef = useRef(null);
  const debounceRef = useRef(null);

  // ── ROI definition (fractions of full image) ──────────────────────────────
  const rois = useMemo(() => {
    // Base bands tuned on Costco-style pylons
    const baseA = { x: 0.12, y: 0.31, w: 0.76, h: 0.22 }; // upper digits band
    const baseB = { x: 0.12, y: 0.58, w: 0.76, h: 0.22 }; // lower digits band

    const shift = clamp(-0.08, yOffset, 0.08);
    return {
      A: { ...baseA, y: clamp(0, baseA.y + shift, 1 - baseA.h) },
      B: { ...baseB, y: clamp(0, baseB.y + shift, 1 - baseB.h) },
    };
  }, [yOffset]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handlePick = () => fileRef.current?.click();
  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    resetOutputs();
  }

  function resetOutputs() {
    setStatus("");
    setText("");
    setPreviewA("");
    setPreviewB("");
    setConfUpper(null);
    setConfLower(null);
    setDigitRatio(null);
    setFinalPrice(null);
    setElapsedMs(null);
  }

  // ── Auto-rescan when knobs move (if image loaded) ─────────────────────────
  useEffect(() => {
    if (!imageUrl) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runOCR(imageUrl), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, threshA, threshB, invert, autoOtsu, yOffset]);

  // ── Core OCR ──────────────────────────────────────────────────────────────
  async function runOCR(url) {
    try {
      setStatus("Preparing image…");
      const src = await loadImage(url);

      const t0 = performance.now();

      // preprocess both ROIs (separate canvases so we can preview each)
      const aCanvas = preprocessROI(src, rois.A, { scale, invert, threshold: threshA, autoOtsu });
      const bCanvas = preprocessROI(src, rois.B, { scale, invert, threshold: threshB, autoOtsu });

      setPreviewA(aCanvas.toDataURL("image/png"));
      setPreviewB(bCanvas.toDataURL("image/png"));

      // OCR pass (single line works best for the number strip)
      setStatus("Running OCR (upper row)...");
      const resA = await Tesseract.recognize(aCanvas, "eng+fra", {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
      });

      setStatus("Running OCR (lower row)...");
      const resB = await Tesseract.recognize(bCanvas, "eng+fra", {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
      });

      const t1 = performance.now();
      setElapsedMs(Math.round(t1 - t0));

      const textA = cleanSpaces(resA?.data?.text || "");
      const textB = cleanSpaces(resB?.data?.text || "");
      setText(`${textA}\n${textB}`);

      const cA = toInt(resA?.data?.confidence ?? 0);
      const cB = toInt(resB?.data?.confidence ?? 0);
      setConfUpper(cA);
      setConfLower(cB);

      const fused = `${textA} ${textB}`.trim();
      const ratio = Math.round((countDigits(fused) / (fused.replace(/\s/g, "").length || 1)) * 100);
      setDigitRatio(ratio);

      // naive fused price guess: pick the two best numeric blobs in each line
      const digitsA = (textA.match(/\d[\d.,]*/g) || []).map(s => s.replace(",", "."));
      const digitsB = (textB.match(/\d[\d.,]*/g) || []).map(s => s.replace(",", "."));
      const pickA = digitsA.find(Boolean);
      const pickB = digitsB.find(Boolean);
      const maybeA = pickA ? Number(pickA) : NaN;
      const maybeB = pickB ? Number(pickB) : NaN;

      if (Number.isFinite(maybeA) || Number.isFinite(maybeB)) {
        // for UI we’ll show the upper if present, otherwise the lower
        setFinalPrice(Number.isFinite(maybeA) ? maybeA : maybeB);
      } else {
        setFinalPrice(null);
      }

      setStatus("OCR complete.");
    } catch (err) {
      console.error(err);
      setStatus("OCR failed. Try a clearer image.");
      setPreviewA("");
      setPreviewB("");
      setConfUpper(null);
      setConfLower(null);
      setDigitRatio(null);
      setFinalPrice(null);
      setElapsedMs(null);
    }
  }

  // ── Preprocess a single ROI into a canvas (grayscale → optional threshold) ─
  function preprocessROI(img, roi, opts) {
    const { scale = 3, threshold = 150, invert = false, autoOtsu = true } = opts || {};
    const sx = Math.round(img.naturalWidth * roi.x);
    const sy = Math.round(img.naturalHeight * roi.y);
    const sw = Math.max(1, Math.round(img.naturalWidth * roi.w));
    const sh = Math.max(1, Math.round(img.naturalHeight * roi.h));

    const outW = Math.max(1, Math.round(sw * Math.max(1, scale)));
    const outH = Math.max(1, Math.round(sh * Math.max(1, scale)));

    const canvas = (workCanvasRef.current ||= document.createElement("canvas"));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = outW;
    canvas.height = outH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    // grayscale
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      let g = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      if (invert) g = 255 - g;
      px[i] = px[i + 1] = px[i + 2] = clampByte(g);
    }
    ctx.putImageData(imgData, 0, 0);

    // threshold
    let thr = threshold;
    if (autoOtsu) {
      thr = otsuThresholdFromCanvas(canvas);
    }
    const imgData2 = ctx.getImageData(0, 0, outW, outH);
    const px2 = imgData2.data;
    for (let i = 0; i < px2.length; i += 4) {
      const v = px2[i] >= thr ? 255 : 0;
      px2[i] = px2[i + 1] = px2[i + 2] = v;
    }
    ctx.putImageData(imgData2, 0, 0);

    return canvas;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      {/* controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={handlePick}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}
        >
          Scan from image
        </button>

        <label style={{ fontSize: 12 }}>
          Scale&nbsp;
          <input
            type="number"
            step="0.1"
            min="1"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value || 1))}
            style={{ width: 64, padding: "4px 6px" }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Thresh A&nbsp;
          <input
            type="number"
            min="0"
            max="255"
            value={threshA}
            onChange={(e) => setThreshA(Number(e.target.value))}
            style={{ width: 64, padding: "4px 6px" }}
            disabled={autoOtsu}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Thresh B&nbsp;
          <input
            type="number"
            min="0"
            max="255"
            value={threshB}
            onChange={(e) => setThreshB(Number(e.target.value))}
            style={{ width: 64, padding: "4px 6px" }}
            disabled={autoOtsu}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Y-offset&nbsp;
          <input
            type="range"
            min={-8}
            max={8}
            step={1}
            value={Math.round(yOffset * 100)}
            onChange={(e) => setYOffset(Number(e.target.value) / 100)}
            style={{ width: 140, verticalAlign: "middle" }}
          />
        </label>

        <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
          Invert
        </label>

        <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={autoOtsu} onChange={(e) => setAutoOtsu(e.target.checked)} />
          Auto-Otsu
        </label>

        <button
          onClick={() => imageUrl && runOCR(imageUrl)}
          style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}
        >
          Rescan
        </button>

        {onSuggest ? (
          <button
            onClick={() => onSuggest?.({ type: "gas", price: finalPrice || 0, unit: "/L", note: text })}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", cursor: "pointer" }}
          >
            Use in Add Deal
          </button>
        ) : null}
      </div>

      {/* hidden input */}
      <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} style={{ display: "none" }} />

      {/* status row */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#374151", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div><strong>Status:</strong> {status || "—"}</div>
        <div><strong>Upper conf:</strong> {confUpper ?? "—"}%</div>
        <div><strong>Lower conf:</strong> {confLower ?? "—"}%</div>
        <div><strong>Digit ratio:</strong> {digitRatio != null ? `${digitRatio}%` : "—"}</div>
        <div><strong>Elapsed:</strong> {elapsedMs != null ? `${elapsedMs} ms` : "—"}</div>
        <div><strong>Final price:</strong> {finalPrice != null ? finalPrice : "—"}</div>
      </div>

      {/* previews + text */}
      {imageUrl ? (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginTop: 10 }}>
          <img
            src={imageUrl}
            alt="Selected"
            style={{ width: 220, height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
            onLoad={() => runOCR(imageUrl)}
          />
          <div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              {previewA ? (
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Processed ROI A (upper)</div>
                  <img src={previewA} alt="roi-a" style={{ maxWidth: 320, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                </div>
              ) : null}
              {previewB ? (
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Processed ROI B (lower)</div>
                  <img src={previewB} alt="roi-b" style={{ maxWidth: 320, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                </div>
              ) : null}
            </div>
            <textarea
              value={text}
              readOnly
              placeholder="OCR text will appear here…"
              style={{
                width: "100%",
                minHeight: 180,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
} 
