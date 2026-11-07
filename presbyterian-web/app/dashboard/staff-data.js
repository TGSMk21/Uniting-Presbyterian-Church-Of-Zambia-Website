import { staffRequest } from "./session";

const MOST_PAGES = 20;

// Every branch, a page at a time, for superusers' branch choices and lists.
export async function allBranches() {
  const branches = [];
  for (let page = 1; page <= MOST_PAGES; page++) {
    const { status, data } = await staffRequest(`/staff-branches/?page=${page}`);
    if (status !== 200) break;
    branches.push(...(data.results || []));
    if (!data.next) break;
  }
  return branches;
}
