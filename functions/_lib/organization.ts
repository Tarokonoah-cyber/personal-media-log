const watchStatusPath = "$.watch_status";
const currentEpisodePath = "$.current_episode";
const totalEpisodesPath = "$.total_episodes";

export function inboxWhereSql(alias = "items") {
  const titleSql = `nullif(trim(coalesce(${alias}.official_title, ${alias}.raw_title, '')), '')`;
  const typeSql = `nullif(trim(coalesce(${alias}.type, '')), '')`;
  const watchStatusSql = `json_extract(${alias}.progress_json, '${watchStatusPath}')`;
  const currentEpisodeSql = `json_extract(${alias}.progress_json, '${currentEpisodePath}')`;
  const totalEpisodesSql = `coalesce(json_extract(${alias}.progress_json, '${totalEpisodesPath}'), json_extract(${alias}.metadata_json, '$.episode_count'))`;
  const seriesSql = seriesLikeSql(alias);

  return `(
    ${alias}.status != 'deleted'
    AND (
      (${watchStatusSql} IS NULL AND ${alias}.status IN ('raw', 'partial'))
      OR ${titleSql} IS NULL
      OR ${typeSql} IS NULL
      OR (
        ${seriesSql}
        AND (
          ${watchStatusSql} IS NULL
          OR ${currentEpisodeSql} IS NULL
          OR ${totalEpisodesSql} IS NULL
        )
      )
    )
  )`;
}

function seriesLikeSql(alias: string) {
  const haystack = `lower(coalesce(${alias}.type, '') || ' ' || coalesce(${alias}.category, '') || ' ' || coalesce(${alias}.platform, ''))`;
  const terms = ["series", "tv", "tv show", "drama", "season", "\u5f71\u96c6", "\u5287\u96c6", "\u6232\u5287"];
  return `(${terms.map((term) => `${haystack} LIKE '%${term}%'`).join(" OR ")})`;
}
