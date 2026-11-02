const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const TIMEOUT_MS = 10000

// Returns null on any failure (HTTP error, timeout, API unreachable) so pages
// render an empty state instead of crashing — including during `next build`.
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...options,
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error(`API request failed: ${url}`, err)
    return null
  }
}

// --- Branches ---
export async function getBranches() {
  return fetchAPI(`/branches/`)
}

export async function getBranch(slug) {
  return fetchAPI(`/branches/${encodeURIComponent(slug)}/`)
}

// --- Branch-scoped content ---
export async function getSermons(branch, page = 1) {
  return fetchAPI(`/sermons/?branch=${branch}&page=${page}`)
}

// video_id is only unique within a branch, so the branch is required.
export async function getSermonByVideoId(branch, videoId) {
  return fetchAPI(`/sermons/${encodeURIComponent(videoId)}/?branch=${encodeURIComponent(branch)}`)
}

export async function getProjects(branch) {
  return fetchAPI(`/projects/?branch=${branch}`)
}

export async function getActivities(branch) {
  return fetchAPI(`/activities/?branch=${branch}`)
}

// Every active branch's activities from today on, soonest first.
export async function getUpcomingActivities() {
  const today = new Date().toISOString().slice(0, 10)
  return fetchAPI(`/activities/?date__gte=${today}`)
}

export async function getMinisters(branch) {
  return fetchAPI(`/ministers/?branch=${branch}`)
}

export async function getDailyMessages(branch) {
  return fetchAPI(`/daily-messages/?branch=${branch}`)
}

export async function getPages(branch) {
  return fetchAPI(`/pages/?branch=${branch}`)
}
