import { useCallback, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";

/**
* Smart Assist – OCR
* - Modes: auto | flyer | gas
* - Two-pass OCR:
*    1) Full image (text) -> show text + confidence
*    2) ROI (preprocessed) -> digits -> show digits + confidence
* - Fuses a final price guess from digits and/or text
* - Debug: shows confidence, ROI preview, mode used
*/

export default function OCRScan({ onSuggest }) {
  // UI state
  const [mode, setMode] = useState("gas"); // default to gas per your workflow
  const [debug, setDebug] = useState(true);

  // Image state
  const [imageURL, setImageURL] = useState(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  // OCR outputs
  const [status, setStatus] = useState("");
  const [textOut, setTextOut] = useState("");
  const [digitsOut, setDigitsOut] = useState("");
  const [textConf, setTextConf] = useState(null);
  const [digitsConf, setDigitsConf] = useState(null);
  const [finalPrice, setFinalPrice] = useState(null);

  // ROI preview
  const [roiPreview, setRoiPreview] = useState(null); // dataURL
  const [roiBox, setRoiBox] = useState(null); // {x,y,w,h}
  const fileInputRef = useRef(null);

  // ---- Helpers -------------------------------------------------------------

  const loadImage = useCallback(
    (src) =>
      new Promise((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = src;
      }),
    []
  );

  // conservative ROI for gas signs (right-side numerals block);
  // for flyers, crop right 38% mid band where big price usually sits.
  const computeROI = useCallback((W, H, m) => {
    const modeToUse = m === "auto" ? "gas" : m; // simple defaulting
    if (modeToUse === "gas") {
      // Focus lower-right quadrant where the large numerals live
      return {
        x: Math.round(W * 0.40),
        y: Math.round(H * 0.12),
        w: Math.round(W * 0.52),
        h: Math.round(H * 0.80),
      };
    }
    // flyer / shelf tag
    return {
      x: Math.round(W * 0.54),
      y: Math.round(H * 0.28),
      w: Math.round(W * 0.42),
      h: Math.round(H * 0.44),
    };
  }, []);

  // Simple grayscale + mean-threshold + slight dilation for segmented digits
  const preprocessForDigits = useCallback(async (img, roi) => {
    const maxEdge = 1100; // upscale cap for crisp OCR without overkill
    const scale = Math.min(
      2.2,
      Math.max(1.2, maxEdge / Math.max(roi.w, roi.h))
    );
    const cw = Math.round(roi.w * scale);
    const ch = Math.round(roi.h * scale);

    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, roi.x, roi.y, roi.w, roi.h, 0, 0, cw, ch);

    const imgData = g.getImageData(0, 0, cw, ch);
    const d = imgData.data;

    // grayscale
    const gray = new Uint8ClampedArray((cw * ch) | 0);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      gray[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    }
    // mean threshold
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    const mean = sum / gray.length;
    const thresh = Math.max(96, Math.min(170, Math.round(mean))); // clamp

    // binarize (invert black digits on light background)
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = gray[j] < thresh ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }

    // 1-pass dilation to close small gaps in stroke edges
    // (cheap 4-neighbour max)
    const copy = new Uint8ClampedArray(d);
    const row = cw * 4;
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const p = (y * cw + x) * 4;
        if (copy[p] === 0) {
          // if any neighbour is black, keep black
          const up = p - row,
            dn = p + row,
            lf = p - 4,
            rt = p + 4;
          if (copy[up] === 0 || copy[dn] === 0 || copy[lf] === 0 || copy[rt] === 0) {
            d[p] = d[p + 1] = d[p + 2] = 0;
          }
        }
      }
    }

    g.putImageData(imgData, 0, 0);
    return { dataURL: c.toDataURL("image/png"), scaled: { w: cw, h: ch } };
  }, []);

  // Try to pull prices from text block (handles "119.9", "119 9", "7 99", "7.99")
  const parsePriceFromText = useCallback((txt) => {
    if (!txt) return null;

    // Normalize weird separators
    const t = txt
      .replace(/[O]/g, "0")
      .replace(/[,]/g, ".")
      .replace(/\s+\/\s+/g, "/")
      .replace(/[^\d.\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Gas-style 3 digits + .9
    const gasMatch = t.match(/\b(\d{2,3})\s*[.\s]?\s*(9)\b/);
    if (gasMatch) {
      const base = parseInt(gasMatch[1], 10);
      return +(base + 0.9 / 10).toFixed(1); // e.g. 119.9
    }

    // Flyer money like "7.99" or "7 99"
    const flyerMatch = t.match(/\b(\d{1,3})[.\s](\d{2})\b/);
    if (flyerMatch) {
      return parseFloat(`${flyerMatch[1]}.${flyerMatch[2]}`);
    }

    // As fallback, any decimal-looking chunk
    const generic = t.match(/\b\d{1,3}\.\d{1,2}\b/);
    return generic ? parseFloat(generic[0]) : null;
  }, []);

  const parseDigitsOnly = useCallback((txt) => {
    if (!txt) return null;
    const matches = txt.match(/\d{1,3}(?:\.\d{1,2})?/g);
    if (!matches) return null;
    return matches.map((m) => parseFloat(m));
  }, []);

  // ---- OCR runner ----------------------------------------------------------

  const runOCR = useCallback(
    async (url) => {
      try {
        setStatus("Reading image…");
        const img = await loadImage(url);
        setImgNatural({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });

        // 1) full image pass for text
        setStatus("OCR: full text pass…");
        const pass1 = await Tesseract.recognize(url, "eng+fra", {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        const rawText = (pass1?.data?.text || "").trim();
        setTextOut(rawText);
        setTextConf(Math.round(pass1?.data?.confidence ?? 0));

        // 2) ROI preprocessed pass for digits
        const roi = computeROI(img.width, img.height, mode);
        setRoiBox(roi);

        const pre = await preprocessForDigits(img, roi);
        setRoiPreview(pre.dataURL);

        setStatus("OCR: digits ROI pass…");
        const pass2 = await Tesseract.recognize(pre.dataURL, "eng+fra", {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        const rawDigitsText = (pass2?.data?.text || "").trim();
        const digitsArr = parseDigitsOnly(rawDigitsText);
        setDigitsOut(digitsArr ? digitsArr.join("  ") : "(no glyphs)");
        setDigitsConf(Math.round(pass2?.data?.confidence ?? 0));

        // 3) Fuse a final price guess
        let fused = null;
        // Gas: prefer gas-style parse from full text; otherwise ROI digits guess
        const fromText = parsePriceFromText(rawText);
        if (fromText != null) fused = fromText;
        else if (digitsArr && digitsArr.length) {
          // If looks like 119 and 9 in same OCR, combine; else largest with .9
          const sorted = [...digitsArr].sort((a, b) => b - a);
          const best = sorted[0];
          // if best is 3 digits, force .9 (gas convention)
          fused = best >= 100 ? +(best + 0.9 / 10).toFixed(1) : best;
        }

        setFinalPrice(fused);

        // Callback up to suggestions (you wire into form fields)
        if (onSuggest) {
          onSuggest({
            modeUsed: mode,
            text: rawText,
            textConf: Math.round(pass1?.data?.confidence ?? 0),
            digits: digitsArr || [],
            digitsConf: Math.round(pass2?.data?.confidence ?? 0),
            finalPrice: fused,
          });
        }

        setStatus("Done.");
      } catch (err) {
        console.error(err);
        setStatus("OCR failed. Try a clearer image.");
      }
    },
    [
      mode,
      loadImage,
      computeROI,
      preprocessForDigits,
      parseDigitsOnly,
      parsePriceFromText,
      onSuggest,
    ]
  );

  // ---- UI handlers ---------------------------------------------------------

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImageURL(url);

    // Reset outputs
    setStatus("Queued…");
    setTextOut("");
    setDigitsOut("");
    setTextConf(null);
    setDigitsConf(null);
    setFinalPrice(null);
    setRoiPreview(null);
    setRoiBox(null);

    // Kick OCR
    runOCR(url);
  }

  // nice label
  const confLabel = useMemo(() => {
    const t = textConf != null ? `${textConf}%` : "—";
    const d = digitsConf != null ? `${digitsConf}%` : "—";
    return `Text conf: ${t} | Digits conf: ${d}`;
  }, [textConf, digitsConf]);

  // ---- Render --------------------------------------------------------------

  return (
    <div className="p-3 border rounded-xl bg-white shadow-sm mt-3 w-full">
      <h2 className="text-lg font-semibold mb-2 text-gray-800">Smart Assist — OCR</h2>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="border p-1 rounded text-sm"
        />

        <div className="inline-flex items-center gap-2">
          <label className="text-sm text-gray-700">Mode:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="border rounded p-1 text-sm"
          >
            <option value="auto">Auto (detect)</option>
            <option value="gas">Gas sign</option>
            <option value="flyer">Flyer / Shelf tag</option>
          </select>
        </div>

        <label className="text-sm text-gray-600 flex items-center">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
            className="mr-1"
          />
          Debug (shows confidences & ROI)
        </label>

        <span className="text-sm text-gray-600">{status}</span>
      </div>

      {imageURL && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          {/* Left: original image */}
          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">
              Original ({imgNatural.w}×{imgNatural.h})
            </div>
            <img
              src={imageURL}
              alt="Preview"
              className="rounded-md border max-h-[320px] object-contain w-full bg-gray-50"
            />
          </div>

          {/* Middle: text + digits */}
          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">
              Mode: <span className="font-medium">{mode}</span> • {confLabel}
            </div>

            <div className="text-xs text-gray-400 mb-1">— Text pass (full) —</div>
            <textarea
              className="w-full border rounded p-1 mb-2 text-xs bg-gray-50 min-h-[140px]"
              readOnly
              value={textOut}
            />

            <div className="text-xs text-gray-400 mb-1">— Digits pass (ROI) —</div>
            <textarea
              className="w-full border rounded p-1 text-xs bg-gray-100 min-h-[70px]"
              readOnly
              value={digitsOut}
            />

            <div className="mt-2 text-sm">
              <span className="text-gray-600">Final price (auto-fused): </span>
              <span className="font-semibold">
                {finalPrice != null ? finalPrice : "—"}
              </span>
            </div>
          </div>

          {/* Right: ROI preview */}
          <div className="md:col-span-1">
            {debug && (
              <>
                <div className="text-xs text-gray-500 mb-1">
                  ROI preview {roiBox ? `(${roiBox.w}×${roiBox.h} @ ${roiBox.x},${roiBox.y})` : ""}
                </div>
                {roiPreview ? (
                  <img
                    src={roiPreview}
                    alt="ROI"
                    className="rounded-md border w-full max-h-[320px] object-contain bg-white"
                  />
                ) : (
                  <div className="border rounded-md h-[320px] bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    (load an image to see ROI)
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 