# Taipei Day Trip — Codex Plugin

Codex Plugin：`@taipei-day-trip` → Booking Skill + 台北一日遊 MCP。

## 目錄

```text
plugins/taipei-day-trip/
├── .codex-plugin/plugin.json
├── .mcp.json                 # MCP URL + bearer_token_env_var（無明文 token）
├── .mcp.json.example
├── README.md
└── skills/booking/
    ├── SKILL.md
    └── agents/openai.yaml
```

## 使用前設定

1. 網站登入 → **會員中心** →「產生 / 更新金鑰」複製 Bearer Token。
2. 設定環境變數（勿寫進 git）：

```bash
export TAIPEI_DAY_TRIP_MCP_TOKEN='<你的 MCP token>'
```

3. 確認 `.mcp.json` 的 `url` 指向你的 MCP（線上或本機）：

- 線上：`http://57.182.233.82:8000/mcp/`
- 本機：`http://127.0.0.1:8000/mcp/`（可改 `.mcp.json` 或從 `.mcp.json.example` 複製調整）

## 在 Codex 載入

作業 7-4 測法：

1. 開一個新專案資料夾，用 Codex 打開。
2. 把整個 `taipei-day-trip` plugin 資料夾放進該專案（子目錄即可）。
3. Prompt：

```text
@taipei-day-trip 預定台北市一日遊行程
```

預期：問關鍵字 → 列出 id/name → 收 id/date/time → 預定成功 → 給 `/booking` 連結。

也可在本 repo 直接 `@taipei-day-trip …`（plugin 已在 `plugins/taipei-day-trip`）。

## MCP tools

- `搜尋台北市景點`（keyword）
- `預定景點導覽行程`（attractionId, date, time, price）

時間／價格：morning → 2000；afternoon → 2500。
