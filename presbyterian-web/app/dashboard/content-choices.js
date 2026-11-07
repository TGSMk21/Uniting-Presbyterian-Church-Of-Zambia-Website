import { apiPath } from "@/Utilities/branchContent.mjs";
import { staffRequest } from "./session";

const MOST_PAGES = 10;

// The rows a section's form needs to choose from: a daily message's minister.
export async function sectionChoices(branch, name) {
  if (name !== "messages") return {};
  const ministers = [];
  for (let page = 1; page <= MOST_PAGES; page++) {
    const { status, data } = await staffRequest(`${apiPath(branch, "ministers")}?page=${page}`);
    if (status !== 200) break;
    ministers.push(...(data.results || []));
    if (!data.next) break;
  }
  return { ministers };
}
