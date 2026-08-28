import { collectionLevelLabels, isCollectionLevel, isPrivateCollectionLevel, privateCollectionLevelLabels } from "../../shared/privateModel";
import type { ListFilters } from "../types";
import { privateFilterValues } from "./privateFilters";

export type PrivateFilterChip = {
  key: string;
  label: string;
  patch: Partial<ListFilters>;
};

export function privateFilterChips(filters: ListFilters): PrivateFilterChip[] {
  const chips: PrivateFilterChip[] = [];
  const add = (key: string, label: string, patch: Partial<ListFilters>) => chips.push({ key, label, patch: { ...patch, page: 1 } });
  const addCsv = (field: "platformFilters" | "makerFilters" | "favoriteLevelFilters" | "personFilters", prefix: string) => {
    for (const value of splitCsv(filters[field])) {
      const label = field === "favoriteLevelFilters" && isPrivateCollectionLevel(value) ? privateCollectionLevelLabels[value] : value;
      add(`${field}:${value}`, `${prefix}：${label}`, { [field]: removeCsv(filters[field], value) });
    }
  };

  if (filters.query.trim()) add("query", `搜尋：${filters.query.trim()}`, { query: "" });
  if (filters.ratingMin || filters.ratingMax) add("rating", `評分：${privateRatingLabel(filters.ratingMin)}～${privateRatingLabel(filters.ratingMax)}`, { ratingMin: "", ratingMax: "" });
  if (filters.unrated) add("unrated", "未評分", { unrated: false });
  if (filters.favorite) add("favorite", "收藏：是", { favorite: false });
  if (filters.usedFilter && filters.usedFilter !== "all") add("usedFilter", filters.usedFilter === "used" ? "已使用：是" : "已使用：否", { usedFilter: "all" });
  if (filters.collectionLevel.trim()) {
    const value = filters.collectionLevel.trim();
    add("collectionLevel", `收藏：${isCollectionLevel(value) ? collectionLevelLabels[value] : value}`, { collectionLevel: "" });
  }
  if (filters.favoriteLevel && filters.favoriteLevel !== "all") add("favoriteLevel", `收藏：${filters.favoriteLevel}`, { favoriteLevel: "all" });
  addCsv("platformFilters", "平台");
  addCsv("makerFilters", "片商");
  addCsv("favoriteLevelFilters", "收藏");
  addCsv("personFilters", "女優");
  if (filters.tag.trim()) add("tag", `包含：#${filters.tag.trim()}`, { tag: "" });
  if (filters.excludeTag?.trim()) add("excludeTag", `排除：#${filters.excludeTag.trim()}`, { excludeTag: "" });
  for (const tag of privateFilterValues(filters.includeTags)) add(`includeTags:${tag}`, `包含：#${tag}`, { includeTags: removeCsv(filters.includeTags, tag) });
  for (const tag of privateFilterValues(filters.excludeTags)) add(`excludeTags:${tag}`, `排除：#${tag}`, { excludeTags: removeCsv(filters.excludeTags, tag) });
  if (filters.platform.trim()) add("platform", `平台：${filters.platform.trim()}`, { platform: "" });
  if (filters.maker.trim()) add("maker", `片商：${filters.maker.trim()}`, { maker: "" });
  if (filters.series.trim()) add("series", `系列：${filters.series.trim()}`, { series: "" });
  if (filters.year.trim()) add("year", `年份：${filters.year.trim()}`, { year: "" });
  if (filters.codeQuery.trim()) add("code", `番號：${filters.codeQuery.trim()}`, { codeQuery: "" });
  if (filters.titleQuery.trim()) add("title", `片名：${filters.titleQuery.trim()}`, { titleQuery: "" });
  if (filters.person.trim()) add("person", `人物：${filters.person.trim()}`, { person: "" });
  if (filters.studio.trim()) add("studio", `片商：${filters.studio.trim()}`, { studio: "" });
  if (filters.missingPeople) add("missingPeople", "未填女優", { missingPeople: false });
  if (filters.metadataQualityBelow) add("metadataQualityBelow", `Metadata < ${filters.metadataQualityBelow}`, { metadataQualityBelow: "" });
  if (filters.missingTags) add("missingTags", "無 Tag", { missingTags: false });
  if (filters.incompleteMetadata) add("incompleteMetadata", "Metadata 不完整", { incompleteMetadata: false });
  if (filters.duplicateCandidate) add("duplicateCandidate", "Duplicate candidate：有", { duplicateCandidate: false });
  if (filters.qualityView) {
    const labels = { missing_tags: "無 Tag", incomplete_metadata: "Metadata 不完整", suspected_duplicate: "疑似重複" } as const;
    add("qualityView", labels[filters.qualityView], { qualityView: "" });
  }
  if (filters.hasNote === "yes" || filters.hasNote === "no") add("hasNote", filters.hasNote === "yes" ? "有心得" : "無心得", { hasNote: "all" });
  if (filters.hasCover === "yes" || filters.hasCover === "no") add("hasCover", filters.hasCover === "yes" ? "有封面" : "無封面", { hasCover: "all" });
  return chips;
}

function splitCsv(value?: string) {
  return privateFilterValues(value);
}

function removeCsv(current: string | undefined, value: string) {
  return splitCsv(current).filter((entry) => entry !== value).join(",");
}

function privateRatingLabel(value: string) {
  return value ? `${value} 分` : "不限";
}
