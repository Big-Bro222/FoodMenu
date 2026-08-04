# FoodMenu Agent Context

This file is the handoff context for future Codex chats working in this repository.

## Project Summary

FoodMenu is a local family weekly meal planner.

- Frontend: React 19 + Vite.
- Backend: Express.
- Storage: SQLite through `better-sqlite3`.
- Workspace: `D:\Projects\FoodMenu`.
- Main branch in use: `codex/phase-1-react-sqlite`.
- Latest important local commit: `d6d9ff2 Restore display and weekly planning features`.
- As of that commit, the branch is ahead of `origin/codex/phase-1-react-sqlite` by 1 commit.

The app has two main surfaces:

- Admin: `http://localhost:5173/admin`
- Display: `http://localhost:5173/display`

The API server runs on:

- `http://localhost:3000`

Vite proxies `/api` requests from port `5173` to `http://127.0.0.1:3000`.

## How To Run

From PowerShell:

```powershell
cd D:\Projects\FoodMenu
npm run dev
```

This starts:

- API server on `0.0.0.0:3000`
- Vite frontend on `0.0.0.0:5173`

Important: `server/package.json` must keep:

```json
"dev": "node src/index.js"
```

Do not change it back to `node --watch src/index.js`. The watch mode notices SQLite writes and can restart the server during POST/PUT requests, causing `Request failed: 500`, `ECONNRESET`, or broken create/save actions.

Useful checks:

```powershell
npm run build
npm run test
```

The user often uses an iPad/pad as the display device. Recorded viewport:

- `712 x 1000`
- `DPR 2.25`
- portrait orientation

For a pad on the same LAN, use the computer LAN IP instead of localhost, for example:

```text
http://192.168.110.167:5173/display
```

## Important Files

- `client/src/main.jsx`: all React app logic.
- `client/src/styles.css`: all UI styling.
- `server/src/db.js`: database schema, plan logic, display-week logic.
- `server/src/index.js`: Express API routes.
- `server/test/db.test.js`: backend tests.
- `server/package.json`: server scripts. Keep dev mode non-watch.
- `data/foodmenu.sqlite`: local SQLite database.
- `startup.md`: older manual startup doc. It may contain mojibake/encoding damage; prefer this file for current context.

## Current Features To Preserve

### Meal Slots

There are three meal slots:

- `morning`: 上午
- `lunch`: 午饭
- `dinner`: 晚饭

Backend `slots` must include all three. Tests expect 21 entries per week plan.

### Admin

Admin features:

- List weekly plans.
- Create weekly plan.
- Duplicate year/week creation is handled in frontend by navigating to the existing plan instead of POSTing.
- Edit plan details and meals.
- Save only in the detail editor.
- Publish from the list.
- Delete from the list.
- Past weeks are locked:
  - can view
  - cannot edit
  - cannot publish
  - cannot delete

Past-week locking is based on the real current ISO week, not the Sunday-display rule.

### Display

Display is designed primarily for portrait pad use.

Display features:

- Blackboard-style visual design.
- Long Cang font from Google Fonts.
- 2 columns x 4 rows on the recorded pad viewport:
  - 7 day cards
  - 1 info card
- No vertical scroll on `712 x 1000` portrait viewport.
- Local display drag-swap only on display, not admin.
- Long-press drag:
  - mouse: 280 ms
  - touch: 760 ms
- Drag preview follows pointer centered.
- Local display changes can differ from admin data.
- If display differs from admin/server:
  - show controls only then
  - `保存到管理端`: upload display changes to admin, then publish
  - `放弃调整`: discard local display changes and restore server data
- Display has an online/offline card.
- Refresh interval is `REFRESH_INTERVAL_SECONDS = 45`.
- Online card has an icon-only refresh button.
- Refresh button is disabled while offline.
- Local date/today highlight updates every minute, even when server is offline.
- Fullscreen button exists only on display surfaces, not admin.
- On portrait pad, fullscreen intent is remembered:
  - if user clicks full screen, store intent in localStorage
  - if fullscreen exits unexpectedly, try to re-enter fullscreen
  - if user clicks exit fullscreen, stop auto-resume until they click fullscreen again
  - iPadOS/Safari may block non-user-gesture fullscreen; code should best-effort only

### Emoji Background Stickers

Display online mode detects food keywords from the whole weekly menu and renders random emoji stickers in the blackboard background.

Rules live in `FOOD_EMOJI_RULES` in `client/src/main.jsx`.

Current important mappings:

As of 2026-08-04, the mapping was expanded to broadly cover Unicode Food & Drink emojis and nearby food-useful symbols. The full source of truth is `FOOD_EMOJI_RULES` in `client/src/main.jsx`; do not rely on the short list below as exhaustive.

- 鸡腿/凤爪/鸡 -> 🍗
- 牛肉/牛肋条 -> 🥩
- 卤肉/肉酱/肉 -> 🥓
- 蘑菇 -> 🍄
- 酸菜/生菜/白菜/娃娃菜/西兰花 -> 🥬
- 芝士 -> 🧀
- 面包 -> 🍞
- 汉堡 -> 🍔
- 饭 -> 🍚
- 面/汤 -> 🍜
- 意大利/肉酱面 -> 🍝
- 麻辣/辣 -> 🌶️
- 馄饨/饺子/包子 -> 🥟
- 豆腐/豆 -> 🫘
- 三文鱼/鱼 -> 🐟

Sticker behavior:

- Only shown while online.
- Opaque, not transparent.
- Random rotation is large: about +/- 42 degrees.
- Positions are distributed across a 4-column grid with jitter, to avoid clustering on the left.
- Pad CSS limits sticker size to roughly `32-58px`.

### Display Week Rule

This is a special business rule:

- Monday through Saturday: display the current ISO week.
- Sunday: display next ISO week early.

Example:

- On the Sunday before Week32, the display should show Week32 for Monday-Saturday, while Sunday meals come from Week31.

Backend behavior:

- `getDisplayWeek()` implements the Sunday-next-week rule.
- `/api/current-plan` should prefer the plan for the display week.
- If the display-week plan exists but is draft/unpublished, the server should auto-publish it.
- When showing a next week plan, Sunday entries should be copied from the previous week's Sunday if that previous plan exists.
- Returned display plan includes metadata:
  - `displayWeek`
  - `previousSundayWeek`
  - `isDisplayWeekMismatch`

Frontend behavior:

- It computes the same display week locally.
- If the displayed plan's `year/weekNumber` differs from the local display week, the week chip becomes red and shows `AlertTriangle`.
- This warning helps detect stale or mismatched server data.

## Known Data Notes

The local database has real user data, not just seed data.

Observed around 2026-08-04:

- Week31 exists and is published.
- Week32 exists and is published.
- Week30 exists and is locked/past.

Do not wipe `data/foodmenu.sqlite` unless the user explicitly asks.

## Known Pitfalls

### Code Was Lost Before

After many changes, only commit `6ba668a` remained and later UI reverted. The work was restored and committed as:

```text
d6d9ff2 Restore display and weekly planning features
```

If features appear missing again, first check:

```powershell
git -c safe.directory=D:/Projects/FoodMenu log --oneline -5
git -c safe.directory=D:/Projects/FoodMenu status --short --branch
```

The restored feature commit should be present.

### Server Still Old After Code Changes

After editing server code, restart `npm run dev`. Otherwise the running `3000` process may still serve old logic.

### Frontend Page Can Load Without Server

`localhost:5173/admin` or `/display` can still load if the frontend is running and backend is stopped. API actions such as create/save/publish will fail until port `3000` is running.

### Encoding/Mojibake

Some older files and previous terminal outputs showed mojibake Chinese. New code should be saved as UTF-8 and use real Chinese strings where user-facing text exists.

## Testing Before Final Responses

For code changes, run:

```powershell
npm run build
npm run test
```

If changing backend display-week behavior, make sure `server/test/db.test.js` still covers:

- 21 entries per plan
- create/update/publish/current version
- display-week draft auto-publish
- delete unlocked plan
- locked past-week plan behavior

## Git Instructions For This Repo

Current branch convention uses `codex/`.

After meaningful changes:

```powershell
git -c safe.directory=D:/Projects/FoodMenu status --short
git -c safe.directory=D:/Projects/FoodMenu add <files>
git -c safe.directory=D:/Projects/FoodMenu commit -m "<message>"
```

The user explicitly wanted a commit after restoring context/features, so future substantial restores/fixes should usually be committed when verified.
