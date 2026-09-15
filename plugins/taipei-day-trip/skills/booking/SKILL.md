---
name: taipei-day-trip-booking
description: >
  預定台北市一日遊行程。用台北一日遊 MCP 先搜尋景點再建立 booking，
  最後給出 Booking 頁連結完成付款。當使用者說「預定台北市一日遊行程」、
  「幫我訂一日遊」、「搜尋景點並預定」時使用。
---

# Taipei Day Trip Booking

用 **台北一日遊** MCP 完成：搜尋景點 → 預定行程 → 導向付款頁。

## MCP tools（名稱必須一字不差）

| 步驟 | Tool name | 參數 |
|------|-----------|------|
| 搜尋 | `搜尋台北市景點` | `keyword`（字串） |
| 預定 | `預定景點導覽行程` | `attractionId`, `date`, `time`, `price` |

每個 MCP 請求需帶會員中心產生的 Bearer Token（由 Codex MCP config / 環境變數注入，Skill 不要向使用者索取 token 明文寫進對話以外的設定檔）。

## 固定流程（必須依序執行，不可跳步）

### 1. 請使用者輸入搜尋關鍵字

只問關鍵字（景點名或捷運站），例如：「請輸入要搜尋的台北景點關鍵字或捷運站名。」

### 2. 呼叫搜尋 tool

呼叫 MCP tool **`搜尋台北市景點`**，參數：

```json
{ "keyword": "<使用者輸入>" }
```

- 若回傳 `{ "error": true }`：告知失敗，請使用者換關鍵字或確認 MCP / Token。
- 成功時 `data` 為陣列。

### 3. 顯示景點列表

至少列出每個景點的 **`id`** 與 **`name`**（可附簡短 description）。用清楚列表格式，方便使用者挑選 id。

### 4. 用自然語言收集預定資訊

請使用者提供：

- 景點編號（attraction id）
- 日期（可用自然語言，如「明天」「9/20」「2026-09-20」）
- 時段（可用自然語言，如「早上」「上午」「下午」）

### 5. 一律轉成系統格式後再呼叫預定 tool

轉換規則（對齊網站前端）：

| 使用者說法 | 系統值 |
|------------|--------|
| 早上 / 上午 / morning | `time` = `"morning"`，`price` = **2000** |
| 下午 / afternoon | `time` = `"afternoon"`，`price` = **2500** |
| 日期 | `date` = `"YYYY-MM-DD"`（相對日期依當下台北時區換算） |
| 景點編號 | `attractionId` = 整數 |

`price` **必須**由時段推導，不要讓使用者亂填金額；若使用者給的價格與時段不符，以時段規則為準並簡短說明。

### 6. 呼叫預定 tool

呼叫 MCP tool **`預定景點導覽行程`**，參數範例：

```json
{
  "attractionId": 27,
  "date": "2026-09-20",
  "time": "morning",
  "price": 2000
}
```

- 成功：`{ "ok": true, "message": "…請到 <Booking URL> 完成付款。" }`
- 失敗：`{ "error": true }` → 說明可能原因（日期過去、景點不存在、token 無效、格式錯）並請使用者修正後重試。

### 7. 顯示 Booking 頁連結

從成功 message 取出 Booking URL（通常形如 `http://主機/booking`），**明確顯示可點連結**，請使用者到該頁完成訂單／付款。

## 注意

- 不要略過「先搜尋再預定」。
- 不要直接發明景點 id；必須來自搜尋結果或使用者明確指定且存在於列表中。
- 不要把 MCP Bearer Token 印在回覆裡。
