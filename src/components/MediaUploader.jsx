// src/components/MediaUploader.jsx
import React, { useEffect, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebaseClient";

const field = { marginTop: 6 };
const labelStyle = { fontSize: 13, color: "#374151", marginBottom: 6 };
const box = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
const btn = { padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" };
const hint = { fontSize: 12, color: "#6b7280" };

export default function MediaUploader({
  onUploaded,           // (meta) => void
  onBusyChange,         // (boolean) => void
  defaultPreview = "",
  objectPathPrefix = "deals",
  label = "Photo",              // 👈 NEW: visible field label
  buttonText = "Choose photo",  // 👈 clearer CTA
  emptyText = "No photo selected",
  helperText = "JPEG/PNG, up to 10 MB",
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(defaultPreview || "");
  const [task, setTask] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => task?.cancel(), [task]);

  function pick() { inputRef.current?.click(); }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const stamp = Date.now();
    const path = `${objectPathPrefix}/${stamp}_${Math.random().toString(36).slice(2)}.${ext}`;

    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      cacheControl: "public,max-age=31536000,immutable",
      contentType: file.type || "application/octet-stream",
    });

    setTask(uploadTask);
    setBusy(true);

    uploadTask.on(
      "state_changed",
      () => {}, // no progress UI
      (err) => {
        console.error("[upload] error:", err);
        if (localUrl?.startsWith("blob:")) URL.revokeObjectURL(localUrl);
        setPreview(defaultPreview || "");
        setBusy(false);
        setTask(null);
        onUploaded?.({ url: "", path: "", mime: file.type || "", size: file.size || 0, error: err?.message || String(err) });
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
          setPreview(url);
          setBusy(false);
          setTask(null);
          onUploaded?.({ url, path, mime: file.type || "", size: file.size || 0, width: null, height: null });
        } catch (e) {
          console.error("[upload] finalize error:", e);
          setBusy(false);
          setTask(null);
        }
      }
    );
  }

  function cancelUpload() {
    try { task?.cancel(); } catch {}
    setBusy(false);
    setTask(null);
  }

  return (
    <div style={field}>
      <div style={labelStyle}>{label}</div>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 160, height: 110,
              border: "1px solid #e5e7eb", borderRadius: 10,
              background: "#fafafa", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {preview ? (
              <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={hint}>{emptyText}</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={pick} style={btn} disabled={busy}>
              {buttonText}
            </button>
            {busy ? (
              <button type="button" onClick={cancelUpload} style={btn}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 6, ...hint }}>{helperText}</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />
    </div>
  );
} 