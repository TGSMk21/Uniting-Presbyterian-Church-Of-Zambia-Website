import { branchTag, contentTag } from '@/Utilities/pageContent.mjs'
import { BRANCH_LIST_TAG, UPCOMING_ACTIVITIES_TAG, sectionTag } from '@/Utilities/branchContent.mjs'

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
// The dashboard clears the tag when staff change service times.
export async function getBranches() {
  return fetchAPI(`/branches/`, { next: { revalidate: 3600, tags: [BRANCH_LIST_TAG] } })
}

export async function getBranch(slug) {
  return fetchAPI(`/branches/${encodeURIComponent(slug)}/`, { next: { revalidate: 3600, tags: [branchTag(slug)] } })
}

// Changed page wording for "national" or a branch slug. The dashboard clears the
// tag on save, so edits show straight away.
export async function getPageContent(scope) {
  return fetchAPI(`/page-content/${encodeURIComponent(scope)}/`, { next: { revalidate: 3600, tags: [contentTag(scope)] } })
}

// --- Branch-scoped content ---
// The dashboard clears these tags when staff save, so changes show straight away.
function cachedFor(...tags) {
  return { next: { revalidate: 3600, tags } }
}

export async function getSermons(branch, page = 1) {
  return fetchAPI(`/sermons/?branch=${branch}&page=${page}`, cachedFor(sectionTag('sermons', branch)))
}

// video_id is only unique within a branch, so the branch is required.
export async function getSermonByVideoId(branch, videoId) {
  return fetchAPI(
    `/sermons/${encodeURIComponent(videoId)}/?branch=${encodeURIComponent(branch)}`,
    cachedFor(sectionTag('sermons', branch)),
  )
}

export async function getProjects(branch) {
  return fetchAPI(`/projects/?branch=${branch}`, cachedFor(sectionTag('projects', branch)))
}

export async function getActivities(branch) {
  return fetchAPI(`/activities/?branch=${branch}`, cachedFor(sectionTag('activities', branch)))
}

// Every active branch's activities from today on, soonest first.
export async function getUpcomingActivities() {
  const today = new Date().toISOString().slice(0, 10)
  return fetchAPI(`/activities/?date__gte=${today}`, { next: { revalidate: 3600, tags: [UPCOMING_ACTIVITIES_TAG] } })
}

export async function getMinisters(branch) {
  return fetchAPI(`/ministers/?branch=${branch}`, cachedFor(sectionTag('ministers', branch)))
}

export async function getDailyMessages(branch) {
  return fetchAPI(`/daily-messages/?branch=${branch}`)
}

export async function getPages(branch) {
  return fetchAPI(`/pages/?branch=${branch}`)
}
