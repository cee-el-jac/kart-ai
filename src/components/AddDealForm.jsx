// src/components/AddDealForm.jsx
import React, { useEffect, useState } from "react";
import { saveOrUpdateDeal, makeDealId } from "../services/firestoreDeals";
import MediaUploader from "./MediaUploader";

export default function AddDealForm({
  // optional prefill from OCR Smart Assist
  initial = {
    type: "grocery",           // "grocery" | "gas"
    item: "",
    store: "",
    station: "",
    location: "",
    unit: "/ea",
    price: "",
    imageUrl: "",              // allow prefill
    description: "",           // allow prefill
  },
  currentUser,                 // { uid, displayName }  (pass from app-level auth)
  onSaved,                     // callback(deal)
}) {
  const [type, setType] = useState(initial.type || "grocery");
  const [item, setItem] = useState(initial.item || "");
  const [store, setStore] = useState(initial.store || "");
  const [station, setStation] = useState(initial.station || "");
  const [location, setLocation] = useState(initial.location || "");
  const [unit, setUnit] = useState(initial.unit || "/ea");
  const [price, setPrice] = useState(initial.price ?? "");
  const [imageUrl, setImageUrl] = useState(initial.imageUrl || "");
  const [description, setDescription] = useState(initial.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setType(initial.type || "grocery");
    setItem(initial.item || "");
    setStore(initial.store || "");
    setStation(initial.station || "");
    setLocation(initial.location || "");
    setUnit(initial.unit || "/ea");
    setPrice(initial.price ?? "");
    setImageUrl(initial.imageUrl || "");
    setDescription(initial.description || "");
  }, [initial]);

  const canSave =
    (type === "gas" ? station || store : item || store) &&
    String(price).trim().length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!canSave) return;

    try {
      setSaving(true);
      const deal = {
        type,
        item: item.trim(),
        store: store.trim(),
        station: station.trim(),
        location: location.trim(),
        unit: unit.trim() || "/ea",
        price: Number(price),
        imageUrl: imageUrl || "",
        description: description.trim(),
        createdBy: currentUser?.uid || null,
        createdByName: currentUser?.displayName || null,
      };
      // deterministic id prevents duplicates on same logical deal
      const id = makeDealId(deal);
      const saved = await saveOrUpdateDeal({ ...deal, id });
      setSaving(false);
      if (onSaved) onSaved(saved);
      // simple reset (keep image to let user post multiple similar deals if they want)
      // remove this line if you prefer full reset:
      // setImageUrl("");
    } catch (err) {
      console.error(err);
      setSaving(false);
      setError("Could not save deal. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border rounded px-2 py-1"
          title="Deal type"
        >
          <option value="grocery">Grocery</option>
          <option value="gas">Gas</option>
        </select>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder={type === "gas" ? "Fuel (e.g., Regular Unleaded)" : "Item (e.g., Smarties)"}
          className="border rounded px-2 py-1 flex-1"
        />
        <input
          value={type === "gas" ? station : store}
          onChange={(e) => (type === "gas" ? setStation(e.target.value) : setStore(e.target.value))}
          placeholder={type === "gas" ? "Station (e.g., Esso)" : "Store (e.g., Food Basics)"}
          className="border rounded px-2 py-1 flex-1"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (City, Prov/State)"
          className="border rounded px-2 py-1 flex-1"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={type === "gas" ? "Price (¢/L e.g., 144.9)" : "Price (e.g., 1.99)"}
          className="border rounded px-2 py-1 w-40"
          inputMode="decimal"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit (/ea, /kg, /L…)"
          className="border rounded px-2 py-1 w-28"
        />
      </div>

      {/* Photo uploader */}
      <div className="flex items-start gap-3">
        <MediaUploader
          onUploaded={(url) => setImageUrl(url)}
          initialUrl={imageUrl}
          buttonLabel={imageUrl ? "Replace photo" : "Upload photo"}
        />
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="deal"
            className="border rounded max-h-24"
          />
        ) : null}
      </div>

      {/* Caption / notes */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Caption / notes (optional)"
        className="border rounded px-2 py-1 w-full min-h-[80px]"
      />

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSave || saving}
          className="border rounded px-3 py-1 bg-black text-white disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post deal"}
        </button>
      </div>
    </form>
  );
} 
