// src/hooks/useRemoteOCRTestData.js
import { useEffect, useMemo, useState } from "react";

/**
* Lightweight remote-config loader for OCR test data & presets.
* - Fetches JSON config from `configUrl` (default: /ocr-testdata.json)
* - Provides images[], presets[], and a quick lookup map
* - Safe to omit; component will degrade gracefully if missing
*
* Example JSON shape:
* {
*   "images": [
*     {"id":"costco-01","label":"Costco sign","url":"/testdata/costco_board_01.jpg"},
*     {"id":"esso-01","label":"Esso sign","url":"https://.../esso_sign_01.jpg"}
*   ],
*   "presets": [
*     {"id":"gas-default","label":"Gas - default","mode":"gas","scale":3.4,"threshA":150,"threshB":150,"invert":false,"yOffset":0.06,"autoOtsu":true},
*     {"id":"gas-bright","label":"Gas - bright sign","mode":"gas","scale":3.6,"threshA":151,"threshB":153,"invert":false,"yOffset":0.08,"autoOtsu":false}
*   ]
* }
*/
export function useRemoteOCRTestData(configUrl = "/ocr-testdata.json") {
  const [state, setState] = useState({
    loading: false,
    error: null,
    images: [],
    presets: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(configUrl, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!active) return;
        setState({
          loading: false,
          error: null,
          images: Array.isArray(json.images) ? json.images : [],
          presets: Array.isArray(json.presets) ? json.presets : [],
        });
      } catch (err) {
        if (!active) return;
        setState({
          loading: false,
          error: err?.message || "Failed to load config",
          images: [],
          presets: [],
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [configUrl]);

  // Quick lookup by ID (for presets/images)
  const byId = useMemo(() => {
    const map = new Map();
    for (const p of state.presets) map.set(p.id, p);
    for (const i of state.images) map.set(i.id, i);
    return map;
  }, [state.presets, state.images]);

  return {
    loading: state.loading,
    error: state.error,
    images: state.images,
    presets: state.presets,
    byId,
  };
} 