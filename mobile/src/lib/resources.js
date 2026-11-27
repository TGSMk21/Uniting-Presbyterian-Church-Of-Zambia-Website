// One function per thing the app reads: where it lives (key), where it comes from (path),
// how old a saved copy may be before we ask the network again (maxAgeMs), and what a
// trustworthy answer looks like (validate). Store keys match the blobStore key rules.
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const branchPath = (branch, segment) => `${segment}?branch=${encodeURIComponent(branch)}`;
const branchOk = (branch, listField) => (d) =>
  d?.branch?.slug === branch && Array.isArray(d?.[listField]);

export const homeResource = (branch) => ({
  key: `home.${branch}`,
  path: branchPath(branch, "/app/home/"),
  maxAgeMs: 5 * MIN,
  validate: (d) => d?.branch?.slug === branch,
});

export const announcementsResource = (branch) => ({
  key: `announcements.${branch}`,
  path: branchPath(branch, "/app/announcements/"),
  maxAgeMs: 5 * MIN,
  validate: branchOk(branch, "announcements"),
});

export const sermonsResource = (branch) => ({
  key: `sermons.${branch}`,
  path: branchPath(branch, "/app/sermons/"),
  maxAgeMs: 15 * MIN,
  validate: branchOk(branch, "sermons"),
});

export const messagesResource = (branch) => ({
  key: `messages.${branch}`,
  path: branchPath(branch, "/app/messages/"),
  maxAgeMs: 15 * MIN,
  validate: branchOk(branch, "messages"),
});

export const eventsResource = (branch) => ({
  key: `events.${branch}`,
  path: branchPath(branch, "/app/events/"),
  maxAgeMs: 15 * MIN,
  validate: branchOk(branch, "events"),
});

export const messageResource = (branch, id) => ({
  key: `message.${branch}.${id}`,
  path: `/app/messages/${id}/?branch=${encodeURIComponent(branch)}`,
  maxAgeMs: DAY,
  validate: (d) => d?.id === Number(id),
});

export const hymnCollectionsResource = () => ({
  key: "hymn-collections",
  path: "/app/hymns/collections/",
  maxAgeMs: DAY,
  validate: (d) => Array.isArray(d?.collections),
});

export const hymnsResource = (collection) => ({
  key: `hymns.${collection}`,
  path: `/app/hymns/?collection=${encodeURIComponent(collection)}`,
  maxAgeMs: DAY,
  validate: (d) => d?.collection === collection && Array.isArray(d?.hymns),
});
