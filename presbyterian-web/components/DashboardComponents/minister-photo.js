"use client";

import { removeMinisterPhoto, uploadMinisterPhoto } from "@/app/dashboard/content-actions";
import { MINISTER_PHOTO } from "@/Utilities/branchContent.mjs";
import ImageField from "./image-field";

export default function MinisterPhoto({ branch, id, value, viewHref }) {
  return (
    <div className="dash-section dash-photo-section">
      <ImageField
        field={MINISTER_PHOTO}
        value={value}
        viewHref={viewHref}
        upload={(form) => uploadMinisterPhoto(branch, id, form)}
        remove={() => removeMinisterPhoto(branch, id)}
      />
      <small className="dash-help">The photo saves on its own as soon as you confirm it.</small>
    </div>
  );
}
