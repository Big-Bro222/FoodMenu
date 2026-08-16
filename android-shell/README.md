# FoodMenu Pad Android Shell

这是给小米 Pad 5 / HyperOS 准备的薄 Android 壳 App。它不替代现有 Web 项目，只负责把展示页装进 Pad：

- WebView 打开 FoodMenu 展示页
- 全屏、竖屏、常亮
- 开机后尝试自动打开
- 把 Pad 电池百分比和充电状态传给网页显示，不做省电模式或低电量自动处理
- 长按屏幕可修改展示页地址

## 展示页地址

默认地址在这里：

```text
app/src/main/res/values/config.xml
```

默认值按 `npm run dev` 配置为：

```text
http://192.168.81.1:5173/display
```

第一次安装后也可以直接在 Pad 上长按展示页，修改成你的电脑局域网 IP，例如：

```text
http://192.168.31.25:3000/display
```

现在默认按开发模式使用。电脑上运行：

```powershell
npm run dev
```

然后 Pad 使用 `http://电脑IP:5173/display`。

如果以后改成生产模式，再在电脑上运行：

```powershell
npm run build
npm run start
```

然后 Pad 使用 `http://电脑IP:3000/display`。这样前端由 Express server 提供，不依赖 Vite 开发端口。

## 构建 APK

当前约定由用户在 Android Studio 里手动构建 APK：

1. 用 Android Studio 打开 `D:\Projects\FoodMenu\android-shell`。
3. 等待 Gradle Sync 完成。
4. 选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)`。
5. APK 会生成在：

```text
android-shell/app/build/outputs/apk/debug/app-debug.apk
```

如果你只安装命令行工具，也可以在 `android-shell` 目录运行：

```powershell
gradle :app:assembleDebug
```

## 安装到小米 Pad 5

方式一：把 APK 传到 Pad 上，点开安装，并允许“安装未知来源应用”。

方式二：安装 ADB 后 USB 连接 Pad：

```powershell
adb install -r android-shell/app/build/outputs/apk/debug/app-debug.apk
```

## 如果打开后看不到页面

新版壳 App 会先显示当前正在打开的 URL，并提供“修改地址”和“重载”按钮。

最常见原因是端口不对或 IP 不对：

- 电脑运行 `npm run dev` 时，Pad 地址通常是 `http://电脑IP:5173/display`
- 电脑运行 `npm run build` + `npm run start` 时，Pad 地址通常是 `http://电脑IP:3000/display`

建议先在 Pad 自带浏览器里打开同一个地址；浏览器能打开后，再把这个地址填进 FoodMenu Pad。

## HyperOS 设置建议

为了让开机自启更可靠，安装后可以在 Pad 上手动进入：

```text
设置 > 应用设置 > 授权管理 > 自启动管理
```

然后允许 `FoodMenu Pad` 自启动。如果 HyperOS 仍然拦截，可以进入应用详情，把本应用的后台策略调成“不限制”或允许后台运行。

## 重要限制

省电模式检测曾尝试过 Android 标准 API 和 HyperOS/MIUI 设置兜底，但在小米 Pad 5 / HyperOS 上不可靠。当前版本只保留电池百分比和充电状态显示，不做省电模式检测、低电量告警或自动处理。

开机自动打开在 HyperOS 上也可能被系统策略拦截。最可靠的展示机模式，是把这个 App 设成默认桌面或使用 kiosk/设备所有者管理。
