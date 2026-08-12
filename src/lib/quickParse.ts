import { PRIVATE_LIBRARY_LABEL } from "./privacy";
import { hasReflection, mergeReflectionMetadata, reflectionFromText } from "./reflection";
import type { ItemInput } from "../types";

const ratingPattern = /(?:^|\s)(10(?:\.0)?|[0-9](?:\.\d)?)\s*(\/10|\/5|分)?(?=\s|$)/;
const codePattern = /\b[A-Z]{2,10}[-_ ]?\d{2,8}\b|FC2[-_\s]*(?:PPV[-_\s]*)?\d{4,8}/i;

export function parseQuickEntry(input: string, options: { privateMode?: boolean } = {}): ItemInput {
  if (options.privateMode) return parsePrivateQuickEntry(input);
  const tags = extractTags(input);
  const favorite = tags.some((tag) => ["收藏", "favorite", "fav", "愛"].includes(tag.toLowerCase()));
  const ratingMatch = input.match(ratingPattern);
  const rating = ratingMatch ? ratingFromMatch(ratingMatch) : ratingFromWords(input);
  const reflection = reflectionFromText(input);
  const withoutTags = stripTagText(input).replace(/\s+/g, " ").trim();
  const withoutRating = ratingMatch ? withoutTags.replace(ratingPattern, " ").replace(/\s+/g, " ").trim() : withoutTags;
  const parts = withoutRating.split(/\s+/);
  const noteStart = findNoteStart(parts);
  const titleParts = noteStart >= 0 ? parts.slice(0, noteStart) : parts;
  const noteParts = noteStart >= 0 ? parts.slice(noteStart) : [];
  const rawTitle = titleParts.join(" ").trim() || withoutRating || input.trim();

  return {
    raw_title: rawTitle,
    rating,
    watched_at: dateFromWords(input),
    quick_note: noteParts.join(" ").trim() || null,
    metadata_json: hasReflection(reflection) ? JSON.stringify(mergeReflectionMetadata(null, reflection)) : null,
    tags: tags.filter((tag) => tag !== "收藏"),
    favorite,
    status: "raw"
  };
}

function parsePrivateQuickEntry(input: string): ItemInput {
  const tags = extractTags(input);
  const codeMatch = input.match(codePattern);
  const code = codeMatch ? normalizeCode(codeMatch[0]) : "";
  const ratingMatch = input.match(ratingPattern);
  const rating = ratingMatch ? ratingFromMatch(ratingMatch) : ratingFromWords(input);
  const reflection = reflectionFromText(input);
  const watchedAt = dateFromWords(input);
  const title = stripPrivateNoise(input, code).trim();
  const metadata = mergeReflectionMetadata(null, reflection);
  Object.assign(metadata, {
    ...(code ? { code } : {}),
    ...(title ? { title } : {})
  });

  return {
    raw_title: title || code || input.trim(),
    official_title: title || null,
    code: code || null,
    type: PRIVATE_LIBRARY_LABEL,
    is_private: true,
    watched_at: watchedAt || formatDate(new Date()),
    rating,
    used: false,
    media_status: "已觀看",
    quick_note: null,
    metadata_json: JSON.stringify({ ...metadata, used: false }),
    tags,
    status: "raw"
  };
}

function extractTags(input: string) {
  const hashTags = Array.from(input.matchAll(/#([^\s#，,、]+)/g)).map((match) => match[1].trim());
  const labelTags = Array.from(input.matchAll(/(?:標籤|tags?)\s*[：:]\s*([^。；;\n]+)/gi))
    .flatMap((match) => match[1].split(/[,，、#\s]+/))
    .map((tag) => tag.trim());
  return Array.from(new Set([...hashTags, ...labelTags].filter(Boolean)));
}

function stripTagText(input: string) {
  return input
    .replace(/#([^\s#，,、]+)/g, " ")
    .replace(/(?:標籤|tags?)\s*[：:]\s*([^。；;\n]+)/gi, " ");
}

function stripPrivateNoise(input: string, code: string) {
  let text = stripTagText(input);
  if (code) text = text.replace(codePattern, " ");
  text = text
    .replace(ratingPattern, " ")
    .replace(/今天|今日|昨天|昨日|前天/g, " ")
    .replace(/看了|看完|已看|普通|尚可|一般|好看|很好|超好|神作|難看|很差|爛|爽|失望|想重看|可重看|不會重看|喜歡|私藏/g, " ")
    .replace(/[，,。；;：:]+/g, " ")
    .replace(/\s+/g, " ");
  return text;
}

function ratingFromWords(input: string) {
  if (/神作|超好|非常好|很棒/.test(input)) return 10;
  if (/很好|好看|不錯|讚/.test(input)) return 8;
  if (/普通|尚可|一般|還行/.test(input)) return 6;
  if (/難看|很差|無聊/.test(input)) return 4;
  if (/爛|糟/.test(input)) return 2;
  return null;
}

function ratingFromMatch(match: RegExpMatchArray) {
  const value = Number(match[1]);
  return match[2] === "/5" ? Math.min(10, value * 2) : value;
}

function dateFromWords(input: string) {
  const today = new Date();
  if (/前天/.test(input)) return formatDate(addDays(today, -2));
  if (/昨天|昨日/.test(input)) return formatDate(addDays(today, -1));
  if (/今天|今日|看了|看完|已看/.test(input)) return formatDate(today);
  const explicit = input.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (explicit) return `${explicit[1]}-${explicit[2].padStart(2, "0")}-${explicit[3].padStart(2, "0")}`;
  return null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCode(value: string) {
  return value.replace(/[_\s]+/g, "-").replace(/-+/g, "-").toUpperCase();
}

function findNoteStart(parts: string[]) {
  const episodeIndex = parts.findIndex((part) => /^ep?\d+$/i.test(part) || /^s\d+e\d+$/i.test(part));
  if (episodeIndex >= 0 && episodeIndex < parts.length - 1) return episodeIndex + 1;
  return parts.length > 3 ? 3 : -1;
}
