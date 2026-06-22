import type { MediaItem } from "../types";

export const libraryTree = [
  {
    id: "movie",
    label: "Movie",
    children: ["Korea", "China", "Japan", "US", "Europe", "Taiwan", "Hong Kong", "Other"]
  },
  {
    id: "series",
    label: "Series",
    children: ["K-Drama", "C-Drama", "J-Drama", "US Series", "TW Drama", "Anime Series", "Variety", "Other"]
  },
  { id: "anime", label: "Anime", children: [] },
  { id: "youtube", label: "YouTube", children: [] },
  { id: "other", label: "Other", children: [] }
] as const;

export function classifyItem(item: MediaItem) {
  const haystack = normalize(`${item.type || ""} ${item.category || ""} ${item.platform || ""} ${item.tags.join(" ")}`);
  const category = normalize(item.category || "");

  if (includesAny(haystack, ["adult", "nsfw", "jav", "av ", "18+", "r18", "xxx", "adult content", "成人"])) {
    return { type: "Other", category: "" };
  }
  if (includesAny(haystack, ["youtube", "yt"])) return { type: "YouTube", category: "" };
  if (includesAny(haystack, ["anime", "animation", "anime series", "動畫"])) {
    if (includesAny(haystack, ["series", "tv", "season", "劇集"])) return { type: "Series", category: "Anime Series" };
    return { type: "Anime", category: "" };
  }
  if (includesAny(haystack, ["series", "drama", "tv show", "k-drama", "c-drama", "j-drama", "variety", "韓劇", "陸劇", "日劇", "台劇", "美劇", "綜藝"])) {
    return { type: "Series", category: seriesCategory(haystack || category) };
  }
  if (includesAny(haystack, ["movie", "film", "cinema", "電影"])) {
    return { type: "Movie", category: movieCategory(haystack || category) };
  }

  return { type: "Other", category: "" };
}

function movieCategory(value: string) {
  if (includesAny(value, ["korea", "korean", "韓"])) return "Korea";
  if (includesAny(value, ["china", "chinese", "陸", "中"])) return "China";
  if (includesAny(value, ["japan", "japanese", "日"])) return "Japan";
  if (includesAny(value, ["us", "usa", "america", "美"])) return "US";
  if (includesAny(value, ["europe", "euro", "歐"])) return "Europe";
  if (includesAny(value, ["taiwan", "tw", "台", "臺"])) return "Taiwan";
  if (includesAny(value, ["hong kong", "hk", "港"])) return "Hong Kong";
  return "Other";
}

function seriesCategory(value: string) {
  if (includesAny(value, ["k-drama", "korea", "korean", "韓劇", "韓"])) return "K-Drama";
  if (includesAny(value, ["c-drama", "china", "chinese", "陸劇", "陸"])) return "C-Drama";
  if (includesAny(value, ["j-drama", "japan", "japanese", "日劇", "日"])) return "J-Drama";
  if (includesAny(value, ["us series", "usa", "america", "美劇", "美"])) return "US Series";
  if (includesAny(value, ["tw drama", "taiwan", "台劇", "臺劇", "台", "臺"])) return "TW Drama";
  if (includesAny(value, ["anime series", "anime", "動畫"])) return "Anime Series";
  if (includesAny(value, ["variety", "綜藝"])) return "Variety";
  return "Other";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term.toLowerCase()));
}
