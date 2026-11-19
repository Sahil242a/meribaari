/** Tokens this phone has taken, so a refresh or a closed tab never loses them. */
const KEY = 'mb_tokens';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

export function saveToken(t) {
  const all = read().filter((x) => x.id !== t.id);
  all.unshift({ ...t, savedAt: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 10)));
  } catch {
    /* private mode: token page still works from the URL */
  }
}

export const getToken = (id) => read().find((x) => x.id === id);

/** Most recent token for this clinic taken today. */
export function todaysTokenFor(slug) {
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  return read().find((x) => x.slug === slug && x.savedAt >= startOfDay);
}
