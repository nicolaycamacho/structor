function normalizeTitle(title) {
  if (typeof title !== "string") throw new TypeError("title must be a string");
  return title.trim().replace(/\s+/g, " ");
}

function makeCard(state, title) {
  return Object.freeze({ state, title: normalizeTitle(title) });
}

export function activeCard(title) {
  return makeCard("active", title);
}

export function queuedCard(title) {
  return makeCard("queued", title);
}
