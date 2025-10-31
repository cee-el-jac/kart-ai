// src/hooks/useUploadImage.js
import { useEffect, useRef, useState } from "react";
import { storage } from "../firebaseClient";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from "firebase/storage";

/**
* Simple image uploader for Firebase Storage.
* - Creates path: deals/anon/<timestamp>_<filename>
* - Tracks progress, exposes cancel, and returns {url, path, meta}
*/
export default function useUploadImage() {
  const taskRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { url, path, width, height, mime, size }

  useEffect(() => () => {
    // cleanup: cancel in-flight on unmount
    try { taskRef.current?.cancel(); } catch {}
  }, []);

  async function readImageMeta(file) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: null, height: null });
        img.src = URL.createObjectURL(file);
      } catch {
        resolve({ width: null, height: null });
      }
    });
  }

  function upload(file, pathPrefix = "deals/anon") {
    setError(null);
    setResult(null);
    setProgress(0);
    if (!file) {
      setError(new Error("No file selected"));
      return;
    }
    const safeName = file.name?.replace(/[^\w.\-]+/g, "_") || "image.jpg";
    const stamp = Date.now();
    const path = `${pathPrefix}/${stamp}_${safeName}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || "image/jpeg" });
    taskRef.current = task;
    setUploading(true);

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / Math.max(1, snap.totalBytes)) * 100);
        setProgress(pct);
      },
      (err) => {
        setUploading(false);
        setError(err);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          const meta = await readImageMeta(file);
          setResult({
            url,
            path,
            width: meta.width,
            height: meta.height,
            mime: file.type || null,
            size: file.size || null,
          });
        } catch (e) {
          setError(e);
        } finally {
          setUploading(false);
        }
      }
    );
  }

  function cancel() {
    try { taskRef.current?.cancel(); } catch {}
    setUploading(false);
  }

  async function remove(path) {
    if (!path) return;
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      // ignore if already gone
      if (e?.code !== "storage/object-not-found") throw e;
    }
  }

  return { upload, cancel, remove, uploading, progress, error, result, setResult };
} 
