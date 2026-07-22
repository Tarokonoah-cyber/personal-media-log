import type { MediaItem } from "../types";
import { isPrivateItem, PRIVATE_LIBRARY_LABEL } from "./privacy";

export const libraryTree = [
  { id: "movie", label: "電影", children: [] },
  { id: "series", label: "影集", children: [] },
  { id: "anime", label: "動畫", children: [] },
  { id: "shadiao-anime", label: "沙雕动画", children: [] },
  { id: "youtube", label: "YouTube", children: [] },
  { id: "private", label: PRIVATE_LIBRARY_LABEL, children: [] },
  { id: "other", label: "其他", children: [] }
] as const;

export function classifyItem(item: MediaItem) {
  if (isPrivateItem(item)) return { type: PRIVATE_LIBRARY_LABEL, category: "" };

  const haystack = normalize(`${item.type || ""} ${item.category || ""} ${item.platform || ""} ${item.tags.join(" ")}`);
  const category = normalize(item.category || "");

  if (includesAny(haystack, ["沙雕动画", "沙雕動畫", "b站", "bilibili", "宗门食神", "宗門食神", "回档修仙", "回檔修仙", "修仙"])) {
    return { type: "沙雕动画", category: "" };
  }
  if (includesAny(haystack, ["youtube", "yt"])) return { type: "YouTube", category: "" };
  if (includesAny(haystack, ["anime", "animation", "anime series", "動畫", "動漫"])) {
    if (includesAny(haystack, ["series", "tv", "season", "影集", "劇"])) return { type: "影集", category: "動畫影集" };
    return { type: "動畫", category: "" };
  }
  if (includesAny(haystack, ["series", "tv", "tv show", "drama", "k-drama", "c-drama", "j-drama", "variety", "影集", "劇集", "韓劇", "陸劇", "日劇", "台劇", "美劇", "綜藝"])) {
    return { type: "影集", category: seriesCategory(haystack || category) };
  }
  if (includesAny(haystack, ["movie", "film", "cinema", "電影"])) {
    return { type: "電影", category: movieCategory(haystack || category) };
  }

  return { type: "其他", category: "" };
}

function movieCategory(value: string) {
  if (includesAny(value, ["korea", "korean", "韓國", "韓"])) return "韓國";
  if (includesAny(value, ["china", "chinese", "中國", "大陸", "陸"])) return "中國";
  if (includesAny(value, ["japan", "japanese", "日本", "日"])) return "日本";
  if (includesAny(value, ["us", "usa", "america", "美國", "美"])) return "美國";
  if (includesAny(value, ["europe", "euro", "歐洲", "歐"])) return "歐洲";
  if (includesAny(value, ["taiwan", "tw", "台灣", "臺灣", "台"])) return "台灣";
  if (includesAny(value, ["hong kong", "hk", "香港", "港"])) return "香港";
  return "其他";
}

function seriesCategory(value: string) {
  if (includesAny(value, ["k-drama", "korea", "korean", "韓劇", "韓國"])) return "韓劇";
  if (includesAny(value, ["c-drama", "china", "chinese", "陸劇", "中國", "大陸"])) return "陸劇";
  if (includesAny(value, ["j-drama", "japan", "japanese", "日劇", "日本"])) return "日劇";
  if (includesAny(value, ["us series", "usa", "america", "美劇", "美國"])) return "美劇";
  if (includesAny(value, ["tw drama", "taiwan", "台劇", "台灣", "臺灣"])) return "台劇";
  if (includesAny(value, ["anime series", "anime", "動畫", "動漫"])) return "動畫影集";
  if (includesAny(value, ["variety", "綜藝"])) return "綜藝";
  return "其他";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term.toLowerCase()));
}
