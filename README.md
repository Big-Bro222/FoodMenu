# FoodMenu

本地运行的家庭每周餐食计划 Web App。

## 技术栈

- React + Vite：前端管理端和展示端。
- Node.js + Express：本地 API server。
- SQLite：本地数据存储。

## 本地启动

```bash
npm install
npm run dev
```

启动后：

- 管理端：http://localhost:5173/admin
- 展示端：http://localhost:5173/display
- API：http://localhost:3000/api/health

小米 Pad 在同一局域网内访问时，把 `localhost` 换成运行 server 的电脑局域网 IP。

更多启动、生产模式和树莓派 microSD 过渡期每周备份说明见 [`startup.md`](startup.md)。

## 第一阶段范围

- 创建、编辑、保存草稿、发布每周餐食计划。
- 展示端读取当前已发布计划。
- 展示端缓存最后一次成功加载的计划。
- 展示端轮询版本号，发布更新后自动刷新。

暂不做 OCR、账号、云同步、完整菜谱库和提醒事项同步。
