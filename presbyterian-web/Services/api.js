const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    next: { revalidate: 3600 },
    ...options,
  })
  if (!res.ok) return null
  return res.json()
}

// --- Branches ---
export async function getBranches() {
  return fetchAPI(`/branches/`)
}

export async function getBranch(slug) {
  return fetchAPI(`/branches/${slug}/`)
}

// --- Branch-scoped content ---
export async function getSermons(branch) {
  return fetchAPI(`/sermons/?branch=${branch}`)
}

export async function getSermonByVideoId(videoId) {
  return fetchAPI(`/sermons/${videoId}/`)
}

export async function getProjects(branch) {
  return fetchAPI(`/projects/?branch=${branch}`)
}

export async function getActivities(branch) {
  return fetchAPI(`/activities/?branch=${branch}`)
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
