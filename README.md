# 私人觀看紀錄 Personal Media Log

手機優先的私人觀看紀錄系統，部署在 Cloudflare Pages，API 由 Cloudflare Pages Functions 提供，資料存在 Cloudflare D1，匯出與備份檔可存入 Cloudflare R2。

## 核心功能

- 手機首頁快速新增，一行輸入即可建立 Inbox/raw 紀錄
- `raw_title` 是唯一必填欄位，其他欄位都可之後補
- D1 儲存、讀取、分頁搜尋、篩選、詳細編輯、軟刪除
- 狀態：`raw`、`partial`、`complete`、`archived`、`deleted`
- 標籤、人物、清單、平台、分類
- 統計頁：總筆數、今年筆數、每月觀看、平均評分、Top 20、最近觀看、分類/平台/標籤數
- CSV / JSON 匯入，含預覽與欄位對應
- JSON / CSV 匯出
- R2 加密備份與還原 API 架構
- Cloudflare Access 全站保護設計

## 本機開發

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npm run cf:dev
```

本機 Pages Functions 需要 `.dev.vars` 裡的 `DEV_AUTH_EMAIL`。Production 不使用這個值，請用 Cloudflare Access 保護整個 Pages site。

前端純 Vite 開發可使用：

```bash
npm run dev
```

但完整 API / D1 / R2 流程請用 `npm run cf:dev`。

## Cloudflare D1

建立資料庫：

```bash
npx wrangler d1 create personal-media-log
```

將輸出的 `database_id` 填入 `wrangler.toml`：

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

本專案的列表、搜尋、篩選與分頁由 `/api/items` 在 D1 SQL 層處理，不會一次讀出全部資料到前端。

## Cloudflare R2

建立 bucket：

```bash
npx wrangler r2 bucket create personal-media-log-backups
```

`wrangler.toml` 已預留：

```toml
[[r2_buckets]]
binding = "MEDIA_LOG_BACKUPS"
bucket_name = "personal-media-log-backups"
```

備份檔會先用 AES-GCM 加密，再寫入 R2。請設定 32 bytes base64 key：

```bash
openssl rand -base64 32
npx wrangler pages secret put BACKUP_ENCRYPTION_KEY_B64
```

R2 備份、每日 Cron、自動加密備份、還原功能已建立 API 與 UI 入口；R2 binding、密鑰與 Cron 觸發需在 Cloudflare production 環境驗證。

## Cloudflare Access

請在 Cloudflare Zero Trust 建立 Access Application，保護整個 Pages 網域。

建議設定：

- Application domain：你的 Pages production domain
- Policy：Allow only your email
- Session duration：依個人需求
- Identity provider：Cloudflare One-Time PIN 或你慣用的 IdP

API 使用 Cloudflare Access headers 判斷登入狀態：

- `Cf-Access-Authenticated-User-Email`
- `Cf-Access-Jwt-Assertion`

可額外設定允許清單：

```bash
npx wrangler pages secret put ACCESS_ALLOWED_EMAILS
```

值可以是單一 email 或逗號分隔清單。不要把 service token、管理金鑰或 Access secret 放入前端。

## 匯入

支援：

- CSV
- JSON array
- `{ "items": [...] }`
- Excel 先另存 CSV 再匯入

匯入流程：

1. 選擇 `.csv` 或 `.json`
2. 預覽欄位
3. 對應欄位
4. 提交匯入

重複資料判斷：

- `code` 已存在
- 或 `raw_title / official_title + watched_at` 相同

## 匯出與資料可攜

一鍵匯出：

- `/api/export/json`
- `/api/export/csv`

匯出不包含軟刪除資料。

## 每日自動備份

`wrangler.toml` 已預留 cron：

```toml
[triggers]
crons = ["17 19 * * *"]
```

若 Pages Functions 的 Cron 在你的帳號/部署模式不可用，請建立一個 Cloudflare Worker Cron，每日呼叫同一套備份服務或受保護的備份 API。此段需在 Cloudflare production 環境驗證。

## 部署 Cloudflare Pages

Build command：

```bash
npm run build
```

Build output：

```text
dist
```

部署前檢查：

```bash
npm run typecheck
npm run build
npm run db:migrate:remote
```

部署：

```bash
npx wrangler pages deploy dist --project-name personal-media-log
```

如果已經接 GitHub 到 Cloudflare Pages，push 後請到 Cloudflare Pages deployment 頁面確認 production 狀態。

## API

- `GET /api/items`
- `POST /api/items`
- `GET /api/items/:id`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`
- `GET /api/stats`
- `POST /api/import/preview`
- `POST /api/import/commit`
- `GET /api/export/json`
- `GET /api/export/csv`
- `GET /api/backups`
- `POST /api/backups`
- `POST /api/backups/:id/restore`
- `POST /api/backups/run-scheduled`
