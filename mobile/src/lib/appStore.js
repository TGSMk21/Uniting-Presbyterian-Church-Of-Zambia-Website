import { API_BASE, fetchJSON } from "./api.js";
import { defaultBlobs } from "./blobStore.js";
import { createStore } from "./store.js";

// The app's single shared store instance.
export const appStore = createStore({ blobs: defaultBlobs(), fetcher: fetchJSON, apiBase: API_BASE });
