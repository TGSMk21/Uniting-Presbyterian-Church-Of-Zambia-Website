export function openExternally(url) {
  if (globalThis.Capacitor?.isNativePlatform?.()) {
    window.open(url, "_system");
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
