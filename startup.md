# 手动启动项目

## 1. 进入项目目录

在 PowerShell 里执行：

```powershell
cd D:\Projects\FoodMenu
```

## 2. 安装依赖

第一次启动，或者依赖变更后，执行：

```powershell
npm install
```

项目已经配置了 `.npmrc`，npm 缓存会写到项目内的 `.npm-cache/`，避免 Windows 用户目录权限问题。

## 3. 启动开发环境

执行：

```powershell
npm run dev
```

这个命令会同时启动：

- API server：http://localhost:3000
- React 前端：http://localhost:5173

## 4. 打开页面

管理端：

```text
http://localhost:5173/admin
```

展示端：

```text
http://localhost:5173/display
```

API 健康检查：

```text
http://localhost:3000/api/health
```

## 5. 小米 Pad 访问方式

如果小米 Pad 和电脑在同一个局域网，把地址里的 `localhost` 换成电脑的局域网 IP。

例如电脑 IP 是 `192.168.1.20`：

```text
http://192.168.1.20:5173/display
```

如果平板打不开，优先检查：

- 电脑和平板是否在同一个 Wi-Fi。
- Windows 防火墙是否允许 Node.js 访问局域网。
- server 是否还在运行。

## 6. 停止项目

回到运行 `npm run dev` 的 PowerShell 窗口，按：

```text
Ctrl + C
```

如果询问是否终止批处理操作，输入：

```text
Y
```

## 7. 生产模式预览

如果想先构建前端，再用 server 提供静态页面：

```powershell
npm run build
npm run start
```

然后打开：

```text
http://localhost:3000/display
```

生产模式下，前端页面由 Express server 提供，不再使用 `5173` 端口。

## 8. 树莓派 microSD 过渡期备份

如果临时用 microSD 跑树莓派，等待 SSD 到货期间不需要每天备份。当前项目的重要数据主要是 SQLite 数据库：

```text
data/foodmenu.sqlite
```

建议每周备份一次，或者在修改了很多菜单后手动备份一次。备份时把 `foodmenu.sqlite` 复制到电脑、移动硬盘或 NAS，并按日期重命名，例如：

```text
foodmenu-2026-08-16.sqlite
```

SSD 到货后，再把最新的 `foodmenu.sqlite` 迁移到 SSD 上的项目 `data/` 目录即可。
