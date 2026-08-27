const RECENT_KEY = "excalidraw-shape-templates-recent";
const FAVORITES_KEY = "excalidraw-shape-templates-favorites";
const MAX_RECENT = 12;

const readList = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const writeList = (key: string, values: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore quota / private mode errors
  }
};

export const getRecentTemplateIds = () => readList(RECENT_KEY);

export const getFavoriteTemplateIds = () => readList(FAVORITES_KEY);

export const pushRecentTemplateId = (templateId: string) => {
  const recent = readList(RECENT_KEY).filter((id) => id !== templateId);
  recent.unshift(templateId);
  writeList(RECENT_KEY, recent.slice(0, MAX_RECENT));
};

export const toggleFavoriteTemplateId = (templateId: string): boolean => {
  const favorites = readList(FAVORITES_KEY);
  const index = favorites.indexOf(templateId);
  if (index >= 0) {
    favorites.splice(index, 1);
    writeList(FAVORITES_KEY, favorites);
    return false;
  }
  favorites.push(templateId);
  writeList(FAVORITES_KEY, favorites);
  return true;
};

export const isFavoriteTemplateId = (templateId: string) =>
  readList(FAVORITES_KEY).includes(templateId);
