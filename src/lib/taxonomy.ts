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

export type LibraryParent = (typeof libraryTree)[number]["label"];

export function classifyItem(item: MediaItem) {
  const type = normalize(`${item.type || ""} ${item.category || ""} ${item.platform || ""}`);
  const category = normalize(item.category || "");
  const platform = normalize(item.platform || "");

  if (type.includes("youtube") || platform.includes("youtube")) return { type: "YouTube", category: "" };
  if (type.includes("anime") || type.includes("動畫")) {
    if (type.includes("series") || type.includes("劇集")) return { type: "Series", category: "Anime Series" };
    return { type: "Anime", category: "" };
  }
  if (type.includes("series") || type.includes("drama") || type.includes("韓劇") || type.includes("日劇") || type.includes("陸劇") || type.includes("台劇") || type.includes("variety")) {
    return { type: "Series", category: seriesCategory(type || category) };
  }
  if (type.includes("movie") || type.includes("film") || type.includes("電影")) {
    return { type: "Movie", category: movieCategory(type || category) };
  }

  return { type: "Other", category: "" };
}

export function typeForFilter(type: string) {
  if (type === "Movie") return "Movie";
  if (type === "Series") return "Series";
  if (type === "Anime") return "Anime";
  if (type === "YouTube") return "YouTube";
  return "";
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
