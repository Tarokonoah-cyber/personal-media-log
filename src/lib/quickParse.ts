import type { ItemInput } from "../types";

const ratingPattern = /(?:^|\s)([0-5](?:\.\d)?)\s*(?:\/5|分)?(?:\s|$)/;

export function parseQuickEntry(input: string): ItemInput {
  const tags = Array.from(input.matchAll(/#([^\s#]+)/g)).map((match) => match[1].trim()).filter(Boolean);
  const favorite = tags.some((tag) => ["收藏", "favorite", "fav", "愛"].includes(tag.toLowerCase()));
  const ratingMatch = input.match(ratingPattern);
  const rating = ratingMatch ? Number(ratingMatch[1]) : null;
  const withoutTags = input.replace(/#([^\s#]+)/g, " ").replace(/\s+/g, " ").trim();
  const withoutRating = ratingMatch ? withoutTags.replace(ratingPattern, " ").replace(/\s+/g, " ").trim() : withoutTags;
  const parts = withoutRating.split(/\s+/);
  const noteStart = findNoteStart(parts);
  const titleParts = noteStart >= 0 ? parts.slice(0, noteStart) : parts;
  const noteParts = noteStart >= 0 ? parts.slice(noteStart) : [];
  const rawTitle = titleParts.join(" ").trim() || withoutRating || input.trim();

  return {
    raw_title: rawTitle,
    rating,
    quick_note: noteParts.join(" ").trim() || null,
    tags: tags.filter((tag) => tag !== "收藏"),
    favorite,
    status: "raw"
  };
}

function findNoteStart(parts: string[]) {
  const episodeIndex = parts.findIndex((part) => /^ep?\d+$/i.test(part) || /^s\d+e\d+$/i.test(part));
  if (episodeIndex >= 0 && episodeIndex < parts.length - 1) return episodeIndex + 1;
  return parts.length > 3 ? 3 : -1;
}
