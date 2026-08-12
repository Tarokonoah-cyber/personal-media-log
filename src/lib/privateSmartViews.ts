import type { ListFilters } from "../types";

export type PrivateSmartView = {
  id: "missing_tags" | "unrated" | "incomplete_metadata" | "missing_people" | "suspected_duplicate" | "unset_collection";
  label: string;
  description: string;
  keywords: string[];
  filters: Partial<ListFilters>;
};

export const privateSmartViews: PrivateSmartView[] = [
  {
    id: "missing_tags",
    label: "無 Tag",
    description: "直接列出尚未加上任何標籤的資料",
    keywords: ["tag", "標籤", "待整理"],
    filters: { qualityView: "missing_tags" }
  },
  {
    id: "unrated",
    label: "無評分",
    description: "直接列出尚未評分的資料",
    keywords: ["rating", "評分", "星星"],
    filters: { unrated: true }
  },
  {
    id: "incomplete_metadata",
    label: "Metadata 不完整",
    description: "缺正式標題、片商或發行日期",
    keywords: ["metadata", "資料", "片商", "日期", "標題"],
    filters: { qualityView: "incomplete_metadata" }
  },
  {
    id: "missing_people",
    label: "無人物",
    description: "直接列出尚未關聯人物的資料",
    keywords: ["人物", "女優", "演員", "people"],
    filters: { missingPeople: true }
  },
  {
    id: "suspected_duplicate",
    label: "疑似重複",
    description: "作品代號或標題與 metadata 高度相似，只供人工 review",
    keywords: ["duplicate", "重複", "番號", "作品代號", "標題"],
    filters: { qualityView: "suspected_duplicate" }
  },
  {
    id: "unset_collection",
    label: "收藏未分類",
    description: "直接列出尚未設定收藏狀態的資料",
    keywords: ["收藏", "未分類", "favorite"],
    filters: { favoriteLevelFilters: "unset" }
  }
];
