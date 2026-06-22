import type { Env, ItemInput } from "./types";

type ParsedSmartEntry = {
  date?: string | null;
  is_sports?: boolean;
  is_plain_record?: boolean;
  sport?: string | null;
  league?: string | null;
  teams?: string[];
  tags?: string[];
  note?: string | null;
  confidence?: number;
};

export interface SmartAddResult {
  input: ItemInput;
  summary: string;
  parsed: Required<Pick<ParsedSmartEntry, "is_sports" | "is_plain_record">> & Omit<ParsedSmartEntry, "is_sports" | "is_plain_record">;
  source: "ai" | "rule";
}

export async function parseSmartAdd(env: Env, text: string): Promise<SmartAddResult> {
  const raw = text.trim();
  if (!raw) throw new Error("text is required");

  let source: "ai" | "rule" = "rule";
  let parsed = parseWithRules(raw);
  if (env.OPENAI_API_KEY) {
    parsed = await parseWithAi(env, raw).then((result) => {
      source = "ai";
      return result;
    }).catch(() => parsed);
  }
  return buildResult(raw, parsed, source);
}

async function parseWithAi(env: Env, text: string): Promise<ParsedSmartEntry> {
  const currentDate = taipeiDate();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.SMART_ADD_MODEL || "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You parse short personal media log entries into conservative JSON.",
            "The user may record watched sports games in Chinese, Japanese, Korean, or English.",
            "Do not look up schedules, scores, rosters, or results. Do not invent match outcomes or opinions.",
            "Return only fields that can be inferred from the text.",
            `Current date in Asia/Taipei is ${currentDate}. Resolve 今天/昨天 and M/D dates using this date.`,
            "JSON shape: {date,is_sports,is_plain_record,sport,league,teams,tags,note,confidence}.",
            "sport examples: baseball, basketball, football, soccer, volleyball, unknown.",
            "league examples: MLB, NPB, CPBL, KBO, NBA, WNBA, unknown.",
            "tags should include league when known, localized sport label such as 棒球, and team names. Keep tags short."
          ].join(" ")
        },
        { role: "user", content: text }
      ]
    })
  });

  if (!response.ok) throw new Error("AI parse failed");
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "{}";
  return normalizeParsed(JSON.parse(content));
}

function parseWithRules(text: string): ParsedSmartEntry {
  const normalized = text.replace(/\s+/g, " ").trim();
  const date = parseDate(normalized);
  const teams = extractTeams(normalized);
  const league = inferLeague(normalized, teams);
  const sport = inferSport(normalized, league);
  const isSports = teams.length >= 2 || league !== "unknown" || /(vs|VS|對|v\.|例行賽|季後賽|棒球|籃球|足球)/i.test(normalized);
  const tags = unique([
    league !== "unknown" ? league : "",
    sport === "baseball" ? "棒球" : sport === "basketball" ? "籃球" : "",
    ...teams
  ]);

  return normalizeParsed({
    date,
    is_sports: isSports,
    is_plain_record: !isSports,
    sport,
    league,
    teams,
    tags,
    note: extractNote(normalized),
    confidence: isSports ? 0.62 : 0.45
  });
}

function buildResult(raw: string, parsed: ParsedSmartEntry, source: "ai" | "rule"): SmartAddResult {
  const isSports = Boolean(parsed.is_sports);
  const teams = normalizeStringList(parsed.teams);
  const league = clean(parsed.league) || "unknown";
  const sport = clean(parsed.sport) || "unknown";
  const date = clean(parsed.date) || null;
  const tags = unique([...(parsed.tags || []), league !== "unknown" ? league : "", sportLabel(sport), ...teams]).filter(notPrivateMarker);
  const title = isSports && teams.length >= 2 ? `${teams[0]} vs ${teams[1]}` : raw;
  const metadata = {
    smart_add: {
      source,
      raw_input: raw,
      is_sports: isSports,
      is_plain_record: Boolean(parsed.is_plain_record),
      sport,
      league,
      teams,
      date,
      confidence: parsed.confidence ?? null
    }
  };

  const input: ItemInput = {
    raw_title: title,
    type: isSports ? "Sports" : null,
    category: isSports ? sportCategory(sport) : null,
    platform: isSports && league !== "unknown" ? league : null,
    watched_at: date,
    status: isSports ? "complete" : "raw",
    quick_note: clean(parsed.note) || null,
    metadata_json: JSON.stringify(metadata),
    progress_json: JSON.stringify({ watch_status: isSports ? "completed" : "plan_to_watch" }),
    tags
  };

  return {
    input,
    summary: buildSummary(input, parsed),
    parsed: {
      ...parsed,
      is_sports: isSports,
      is_plain_record: Boolean(parsed.is_plain_record)
    },
    source
  };
}

function buildSummary(input: ItemInput, parsed: ParsedSmartEntry) {
  const parts = [
    input.platform || "unknown",
    input.category || "一般紀錄",
    input.raw_title,
    input.watched_at ? shortDate(input.watched_at) : null
  ].filter(Boolean);
  return parts.join(" · ");
}

function normalizeParsed(value: unknown): ParsedSmartEntry {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    date: clean(row.date),
    is_sports: Boolean(row.is_sports),
    is_plain_record: Boolean(row.is_plain_record),
    sport: clean(row.sport) || "unknown",
    league: clean(row.league) || "unknown",
    teams: normalizeStringList(row.teams),
    tags: normalizeStringList(row.tags),
    note: clean(row.note),
    confidence: typeof row.confidence === "number" ? row.confidence : undefined
  };
}

function parseDate(text: string) {
  const now = new Date(`${taipeiDate()}T00:00:00+08:00`);
  if (/今天/.test(text)) return formatDate(now);
  if (/昨天/.test(text)) {
    now.setDate(now.getDate() - 1);
    return formatDate(now);
  }
  const match = text.match(/(\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  const year = new Date(`${taipeiDate()}T00:00:00+08:00`).getFullYear();
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function extractTeams(text: string) {
  const withoutDate = text
    .replace(/今天|昨天/g, "")
    .replace(/\d{1,2}[/-]\d{1,2}/g, "")
    .replace(/普通例行賽|例行賽|季後賽|熱身賽/g, "")
    .trim();
  const explicit = withoutDate.split(/\s+(?:vs|VS|Vs|v\.|對)\s+|(?:vs|VS|Vs|v\.|對)/).map(clean).filter(Boolean);
  if (explicit.length >= 2) return explicit.slice(0, 2);
  const tokens = withoutDate.split(/\s+/).map(clean).filter(Boolean).filter((token) => !/^(MLB|NPB|CPBL|KBO|NBA|WNBA|棒球|籃球)$/i.test(token));
  return tokens.slice(0, 2);
}

function inferLeague(text: string, teams: string[]) {
  if (/NBA|湖人|勇士|塞爾提克|太陽|金塊|尼克/i.test(text)) return "NBA";
  if (/MLB|藍鳥|運動家|道奇|教士|洋基|紅襪|大都會|小熊|水手|勇士|費城|費城人/i.test(text)) return "MLB";
  if (/NPB|阪神|巨人|讀賣|養樂多|軟銀|火腿|歐力士|廣島|中日/.test(text)) return "NPB";
  if (/CPBL|中職|兄弟|統一|樂天|富邦|味全|台鋼|龍|啾啾/.test(text)) return "CPBL";
  return teams.length >= 2 ? "unknown" : "unknown";
}

function inferSport(text: string, league: string) {
  if (["MLB", "NPB", "CPBL", "KBO"].includes(league) || /棒球|例行賽/.test(text)) return "baseball";
  if (["NBA", "WNBA"].includes(league) || /籃球/.test(text)) return "basketball";
  if (/足球|soccer|football/i.test(text)) return "soccer";
  return "unknown";
}

function extractNote(text: string) {
  const note = text.match(/(普通例行賽|例行賽|季後賽|熱身賽)/)?.[1];
  return note || null;
}

function sportLabel(sport: string) {
  if (sport === "baseball") return "棒球";
  if (sport === "basketball") return "籃球";
  if (sport === "soccer") return "足球";
  return "";
}

function sportCategory(sport: string) {
  if (sport === "baseball") return "Baseball";
  if (sport === "basketball") return "Basketball";
  if (sport === "soccer") return "Soccer";
  return "Sports";
}

function shortDate(date: string) {
  const match = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[1])}/${Number(match[2])}` : date;
}

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => clean(item)).filter(Boolean));
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(clean).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function notPrivateMarker(tag: string) {
  return !/^(adult|nsfw|private|成人|私密)$/i.test(tag.trim());
}
