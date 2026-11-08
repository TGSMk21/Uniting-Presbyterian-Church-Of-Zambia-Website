"use client";

import { useId, useState } from "react";
import { removeItemPhoto, uploadItemPhoto } from "@/app/dashboard/content-actions";
import { ITEM_PHOTOS } from "@/Utilities/branchContent.mjs";
import { IMAGE_TYPES, shrinkImage } from "@/Utilities/imageUpload.mjs";
import { useConfirm } from "./confirm-dialog";

// Photos of a project or activity (owner's request, 2026-11-08). They save as soon as
// they're chosen, one after another; the API checks and re-saves each one.
export default function ItemPhotos({ branch, name, id, photos: initial, singular }) {
  const [photos, setPhotos] = useState(initial || []);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, dialog] = useConfirm();
  const inputId = useId();
  const room = ITEM_PHOTOS.most - photos.length;

  async function add(event) {
    const files = [...event.target.files].slice(0, Math.max(room, 0));
    event.target.value = "";
    setError(null);
    for (const [index, file] of files.entries()) {
      setBusy(`Adding ${index + 1} of ${files.length}…`);
      try {
        const smaller = await shrinkImage(file, ITEM_PHOTOS);
        const form = new FormData();
        form.append("image", smaller, "photo.jpg");
        const result = await uploadItemPhoto(branch, name, id, form);
        if (result.signedOut) return window.location.assign("/dashboard/login");
        if (result.error) {
          setError(`${file.name}: ${result.error}`);
          break;
        }
        setPhotos(result.photos);
      } catch (problem) {
        setError(`${file.name}: ${problem?.message || "This photo couldn't be added."}`);
        break;
      }
    }
    setBusy(null);
  }

  async function remove(photo) {
    const sure = await confirm({
      title: "Remove this photo?", message: "It comes off the website straight away.", confirmLabel: "Remove", danger: true,
    });
    if (!sure) return;
    setBusy("Removing…");
    setError(null);
    const result = await removeItemPhoto(branch, name, id, photo.id);
    if (result.signedOut) return window.location.assign("/dashboard/login");
    if (result.error) setError(result.error);
    else setPhotos(result.photos);
    setBusy(null);
  }

  return (
    <section className="dash-section dash-photos" aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`} className="dash-subheading">Photos</h2>
      <p className="dash-help">
        Shown on the website when someone opens this {singular}. The first photo is its cover. Up to {ITEM_PHOTOS.most};
        each saves as soon as you choose it.
      </p>
      {photos.length > 0 && (
        <ul className="dash-photo-grid">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <img src={photo.url} alt={`Photo ${index + 1}`} loading="lazy" />
              {index === 0 && <span className="dash-badge dash-photo-cover">Cover</span>}
              <button type="button" className="dash-photo-remove" onClick={() => remove(photo)} disabled={Boolean(busy)}
                aria-label={`Remove photo ${index + 1}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 ? (
        <label className="dash-field" htmlFor={inputId}>
          <span>{photos.length ? "Add more photos" : "Add photos"}</span>
          <input id={inputId} type="file" accept={IMAGE_TYPES} multiple onChange={add} disabled={Boolean(busy)} />
        </label>
      ) : (
        <p className="dash-help">This {singular} has the most photos it can have. Remove one to add another.</p>
      )}
      <p className="dash-savebar-status" role="status">
        {busy}
        {!busy && error && <span className="dash-error">{error}</span>}
      </p>
      {dialog}
    </section>
  );
}
