# Personal Media Log

私人觀影 / 追劇資料庫。前端部署在 Cloudflare Pages，API 使用 Pages Functions，主要資料存在 Cloudflare D1，匯入 / 匯出與備份檔可使用 Cloudflare R2。

## 功能重點

- 手機優先快速新增：只需要輸入標題即可建立紀錄。
- Notion-style database：支援 Table、List、Poster Wall 視圖。
- 觀看狀態：Plan to Watch、Watching、Completed、Paused、Dropped、Rewatching。
- 影集追劇進度：目前季 / 集、總季數 / 集數、單集長度、進度備註。
- TMDb metadata lookup：由後端 API 使用 secret 查詢，不把 token 放在前端。
- 搜尋、篩選、分頁由 API / SQL 處理，避免一次載入全部資料。
- 匯入 CSV / JSON，匯出 CSV / JSON。
- JSON 匯出包含 `metadata_json`、`progress_json` 與日期欄位，是完整備份格式。

## 本機開發

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npm run cf:dev
```

單純開前端 UI 可使用：

```bash
npm run dev
```

需要測試 Pages Functions、D1、R2 時請使用：

```bash
npm run cf:dev
```

## Cloudflare D1

建立資料庫：

```bash
npx wrangler d1 create personal-media-log
```

將 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "MEDIA_LOG_DB"
database_name = "personal-media-log"
database_id = "..."
migrations_dir = "migrations"
```

套用 migration：

```bash
npm run db:migrate:remote
```

目前 migrations：

- `0001_initial.sql`：建立 items 與關聯資料表。
- `0002_add_item_metadata_json.sql`：新增 `items.metadata_json`，保存 TMDb 補充資料。
- `0003_add_watch_progress_fields.sql`：新增 `progress_json`、`started_at`、`completed_at`、`planned_at`。

`0003_add_watch_progress_fields.sql` 只使用 `ALTER TABLE ... ADD COLUMN`，不會重建 `items` table，也不會刪除既有資料。

## 觀看狀態與舊狀態相容

D1 既有 `status` 欄位目前仍沿用舊值：`raw`、`partial`、`complete`、`archived`、`deleted`。前端顯示新的 watch status，並同步寫入 `progress_json.watch_status`。

儲存 mapping：

- `plan_to_watch` -> `raw`
- `watching` -> `partial`
- `completed` -> `complete`
- `paused` -> `partial`
- `dropped` -> `archived`
- `rewatching` -> `partial`

讀取時會優先使用 `progress_json.watch_status`。如果舊資料沒有 `progress_json.watch_status`，才會從舊 `status` fallback。UI 不會顯示 archived / 封存選項；`archived` 只作為 dropped 的後端相容值。

## 追劇進度

`progress_json` 用來保存使用者自己的追劇進度，不與 TMDb metadata 混用：

```json
{
  "watch_status": "watching",
  "current_season": 2,
  "current_episode": 5,
  "total_seasons": 6,
  "total_episodes": 73,
  "episode_runtime": 50,
  "progress_note": ""
}
```

`total_seasons` / `total_episodes` 會優先讀 `progress_json`，如果沒有，才從 `metadata_json` 的 TMDb 資料補上。

## 日期欄位

日期都是選填：

- `planned_at`：預計看
- `started_at`：開始看
- `completed_at`：看完
- `watched_at`：保留為舊資料的紀錄日期 / 觀看日期

UI 不會把日期當成必填，也不會強迫每筆資料都有看完時間。

## Cloudflare R2

建立備份 bucket：

```bash
npx wrangler r2 bucket create personal-media-log-backups
```

`wrangler.toml` 需要有：

```toml
[[r2_buckets]]
binding = "MEDIA_LOG_BACKUPS"
bucket_name = "personal-media-log-backups"
```

備份加密 key：

```bash
openssl rand -base64 32
npx wrangler pages secret put BACKUP_ENCRYPTION_KEY_B64 --project-name your-pages-project
```

R2 備份、排程與還原請在 Cloudflare production 環境驗證。

## TMDb Metadata

申請方式：

1. 到 [TMDb](https://www.themoviedb.org/) 建立帳號。
2. 進入 Settings -> API。
3. 建立 API application。
4. 複製 Read Access Token。

設定 Cloudflare Pages secret：

```bash
npx wrangler pages secret put TMDB_READ_TOKEN --project-name your-pages-project
```

也可設定 legacy API key：

```bash
npx wrangler pages secret put TMDB_API_KEY --project-name your-pages-project
```

系統會優先使用 `TMDB_READ_TOKEN`。TMDb request 只會從 Pages Functions 發出，token 不會進入前端 bundle。

## Cloudflare Access

請在 Cloudflare Zero Trust 建立 Access Application 保護 Pages production domain。

建議設定：

- Application domain：Pages production domain。
- Policy：只允許你的 email。
- Identity provider：Cloudflare One-Time PIN 或你的 IdP。

後端會使用 Cloudflare Access headers / JWT 驗證：

- `Cf-Access-Authenticated-User-Email`
- `Cf-Access-Jwt-Assertion`

可設定允許名單：

```bash
npx wrangler pages secret put ACCESS_ALLOWED_EMAILS --project-name your-pages-project
```

不要把 service token、管理金鑰或 TMDb token 放在前端。

## 匯入 / 匯出

支援匯入：

- CSV
- JSON array
- `{ "items": [...] }`
- Excel 請先匯出 CSV 再匯入。

匯出端點：

- `GET /api/export/json`
- `GET /api/export/csv`

完整備份請使用 JSON，因為 CSV 不適合完整保存巢狀 JSON 欄位，例如 `metadata_json` 與 `progress_json`。

## 驗證與部署

```bash
npm run typecheck
npm run build
npm run db:migrate:remote
```

如果已連接 GitHub 與 Cloudflare Pages，push 到 production branch 後 Cloudflare Pages 會自動部署。

手動部署：

```bash
npx wrangler pages deploy dist --project-name personal-media-log
```

## API

- `GET /api/items`
- `POST /api/items`
- `GET /api/items/:id`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`
- `GET /api/stats`
- `POST /api/import/preview`
- `POST /api/import/commit`
- `POST /api/metadata/search`
- `POST /api/metadata/apply`
- `GET /api/export/json`
- `GET /api/export/csv`
- `GET /api/backups`
- `POST /api/backups`
- `POST /api/backups/:id/restore`
- `POST /api/backups/run-scheduled`
