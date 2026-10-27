# 定制记录（custom）

本文件记录在 fork 上对 Waku 做的自定义改造：每条包含 **目标 / 改动落点 / 约束 / 待办**。
与上游行为冲突时以本文件为准；凡是会改变部署形态、数据来源或交互模型的改动，都必须先在
这里登记，再动代码。原始项目说明见 `README.md`，开发规范见 `AGENTS.md`。

## 001 · Web 客户端部署方式改为 SPA

**日期**：本次定制首条
**目标**：`apps/web` 不再做 SSR/Worker 服务端渲染，只产出一份静态前端
（`index.html` + 静态资源），由任意静态托管（Cloudflare Pages/静态资源、Nginx、对象存储）
直接分发，浏览器端自己连用户的 waku-daemon。

**为什么**：

- Web 端本身只是 daemon 的浏览器客户端。任务状态、transcript、workspace、Git、附件、
  provider 进程全部由 daemon 持有，服务端渲染没有任何可信状态可渲染，SSR 只带来部署
  复杂度和 Worker 运行时约束。
- 静态托管后可部署到任意静态环境，不绑定 Cloudflare Worker 运行时，也不需要每次改动
  重新 `wrangler deploy` 服务端产物。

**改动落点**（`apps/web/vite.config.ts`）：

- 移除 `@cloudflare/vite-plugin`（`cloudflare({ viteEnvironment: { name: 'ssr' } })`），
  不再生成 Worker 的 `ssr` 环境。
- `tanstackStart()` 改为：

  ```ts
  tanstackStart({
    spa: {
      enabled: true,
      prerender: { outputPath: "/index.html" },
    },
  });
  ```

  即 SPA 模式 + 预渲染出唯一入口 `index.html`（所有路由走客户端路由）。

- 追加 `ssr.noExternal: true`：把预渲染运行时打进来，保证 workspace 依赖共用同一份 React。
- 追加 `resolve.dedupe: ["react", "react-dom"]`，避免多份 React 实例。

**约束**：

- 不要在 `apps/web` 里重新引入 SSR 专属能力：`createServerFn`、server route、
  `loader` 中的服务端 I/O、`@tanstack/react-start/server-entry`、Cloudflare bindings
  （KV/D1/R2/`env`）以及任何读 `process.env` 的服务端秘密。
- 浏览器端唯一的外部依赖是用户填写的 daemon WebSocket URL + token；token 绝不经过
  任何托管方服务端。
- 新增页面必须是纯客户端路由（`apps/web/src/routes/*`），深链依赖静态托管的
  history fallback 配置。

**已核实的状态**：`bun --filter @waku/web build` 通过（含 `tsc --noEmit`），产物为
`apps/web/dist/client/`（`index.html` + `assets/`）。`dist/server/` 只是预渲染/客户端路由
运行时的中间产物，静态部署只需 `dist/client`，不要把 `dist/server/server.js` 当服务端入口发布。

**已完成的上游清理**（移除全部 Worker/Cloudflare 部署面）：

- 删除 `apps/web/wrangler.jsonc`。
- `apps/web/package.json`：移除 `deploy`、`cf-typegen` 脚本，移除 `wrangler` 与
  `@cloudflare/vite-plugin` 依赖（`vite dev` / `vite build` / `vite preview` 即可）。
- `apps/web/tsconfig.json`：`include` 去掉 `worker-configuration.d.ts`；
  `apps/web/.gitignore` 去掉 `.wrangler` 与 `worker-configuration.d.ts`。
- `apps/web/README.md`：改为静态 SPA 说明（产物目录、SPA fallback、缓存前提）。
- 注意：顶层的 `website/` 是另一个 workspace（官网），仍用 Cloudflare 插件，本次未动。

**托管方式**：自有 Nginx 静态站点，配置由使用者自行维护，仓库不提供 nginx 配置或部署
脚本。仓库只负责产出可静态部署的 `dist/client`；前提约定是站点必须做 SPA fallback
（未匹配路径回落 `index.html`），且 `index.html` 不缓存、带 hash 的 `assets/*` 长缓存。

**待办 / 未完成**：

- 构建产物未做分包调优：`settings-view` 1.35 MB、`code-surfaces` 1.40 MB（gzip 后约 300 KB），
  首屏不需要它们，可按需动态加载。

## 002 · 移动端最小集：不自动放大 + 键盘避让 + 安全区

**日期**：本次定制第二条（最终范围）
**目标**：让 `apps/web` 在 iOS 上可用，同时把与上游的差异压到「1 个新文件 + 4 处小改」：
聚焦输入框不缩放、软键盘不遮挡输入框、刘海/Home 指示条不压内容。
触控命中区、hover 可见性、窄屏信息密度一律不做。

**为什么**：iOS Safari 在聚焦 `font-size < 16px` 的文本控件时会强制放大页面；
`100dvh` 在 iOS 上包含键盘区域，而壳层是 `overflow-hidden`，Safari 无法滚动避让，
键盘必定盖住 composer；`viewport-fit=cover` 又不带 `env(safe-area-inset-*)`，
横屏与全屏时两端会被圆角切掉。这三条是可用性问题，其余都是观感取舍。
曾按「方案 C」做过一版全面触屏适配（`coarse:` 变体 + 命中区 + hover 对应入口 +
settings 窄屏导航），涉及 13 个文件 +87/−27，合并上游成本过高，已整体回退。

**改动落点**（4 个文件，全部小改，无 `coarse:` 变体层）：

1. `apps/web/src/styles.css`：`@media (any-pointer: coarse)` 把文本控件字号钉到 16px（聚焦缩放）；
   `body` 加 `overscroll-behavior: none`（全屏/独立模式下橡皮筋露白、下拉刷新误触）；
   `button / [role=button] / [role=tab] / [role=menuitem]` 加 `touch-action: manipulation`
   （连点按钮时防误触双击缩放）。

```css
@media (any-pointer: coarse) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not(
      [type="file"]
    ),
  textarea,
  select {
    font-size: 16px !important;
  }
}
```

2. `apps/web/src/hooks/use-app-height.ts`（新增 ~50 行）：监听 `window.visualViewport` 的
   `resize`/`scroll`（rAF 合并）。仅当 `viewport.scale <= 1.01` 且
   `window.innerHeight - viewport.height > 120`（键盘打开）时，把 `--app-height` 写到
   `documentElement` 上，关闭/卸载时移除。阈值同时过滤掉 URL 栏收缩和 pinch 缩放。
3. `apps/web/src/routes/__root.tsx`：`RootComponent` 调 `useAppHeight()`；head 增加
   `{ name: 'format-detection', content: 'telephone=no' }`（否则 transcript 里的
   `13800138000`、`2024-01-01` 会被 iOS 变成拨号链接）。
4. `apps/web/src/components/waku-app.tsx`：壳层根 div 去掉 `h-dvh`，改为
   `style={{ height: 'var(--app-height, 100dvh)' }}` 加
   `pt/pb-[env(safe-area-inset-top|bottom)]`。

**约束**：

- 不要再引入 `coarse:` 变体、`interactive-widget=resizes-content`（只在 Chrome/Android 生效）、
  逐组件的字号/命中区/hover 重写：那会把差异扩散到十几个上游文件。
- 不加 `maximum-scale` / `user-scalable=no`，pinch 缩放必须保留。
- 安全区只覆盖主应用壳（`waku-app.tsx`）。`settings.$page`、`connection-panel`、`startup-screen`、
  `not-found-screen` 是 root 下的独立路由（各自 `h-dvh`/`min-h-dvh`），不共享壳层 padding；
  Safari 带 chrome 时 `env(safe-area-inset-bottom)` 本就为 0，只有装到主屏才需要补，
  真要补就在各自根节点加一行，不要为它把 `h-dvh` 全部改成 `h-full`。
- 壳层 `overflow: hidden` 让子元素的 `h-dvh` 无法被 padding 内缩（裁剪发生在 padding box），
  所以壳内不要再出现 `h-dvh` 的页面级容器。
- 新增文本控件不要靠 `text-[12px]` 一类样式压字号：触屏上会被这条规则拉回 16px。

**已验证**：`bun --filter @waku/web build`（`vite build && tsc --noEmit`）通过；
产物 `dist/client/index.html` 含 `format-detection`，CSS 含三条规则与 `safe-area-inset-top`，
`--app-height` 已进入 `__root` 的 client chunk。未经真机验证（本机无 iOS 设备）。


## 003 · 统一 @types/react 版本（修 web 构建的类型冲突）

**日期**：本次定制第三条
**目标**：让 `bun --filter @waku/web build`（`vite build && tsc --noEmit`）整体通过。
此前 `apps/web/src/components/transcript.tsx:1398` 报 TS2322：

```
Type '{ key?: Key | null | undefined; ref?: Ref<HTMLAnchorElement> | undefined; ... }'
is not assignable to type 'DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>'
Types of property 'ref' are incompatible ... Two different types with this name exist, but they are unrelated.
```

**为什么**：仓库里存在两份 `@types/react` —— 顶层 19.2.18（给 `apps/mobile` 的 `~19.2.2`）
与 `apps/web/node_modules` 下的 19.3.0，另有一份嵌在 `@types/react-dom/node_modules` 里。
`node_modules/react-markdown`（顶层解析）的 `components.a` 回调参数用的是 19.2.18 的
`Ref`，而 `apps/web` 的 JSX intrinsic 用的是 19.3.0 的 `Ref`，两者结构相同但名义不同，
展开到 `<a>` 上就报「two different types with this name」。`@types/react-dom@19.3.0` 的
peer 是 `@types/react@^19.3.0`，所以正确方向是统一到 19.3.0，而不是把 web 降回 19.2。

**改动落点**（仓库根 `package.json`）：

```json
"overrides": { "@types/react": "19.3.0" }
```

跑 `bun install` 后只装了一份 `@types/react@19.3.0`（顶层），`apps/web/node_modules/@types/react`
与 `@types/react-dom/node_modules/@types/react` 等嵌套副本被移除；`bun.lock` 的净变化只有
`@types/react` 解析结果与本条 overrides 记录，没有顺带升级其它依赖。

**约束**：`apps/mobile` 仍声明 `@types/react: ~19.2.2`，实际由根 overrides 提到 19.3.0；
以后升级 mobile 的 React 类型时不要删这条 override，否则 web 的类型冲突会复发。真要分歧，
应改为在 `apps/web` 里给 react-markdown 的 props 做显式类型收窄，而不是再引入第二份类型包。

**已验证**：`bun --filter @waku/web build` 退出码 0（vite build + tsc 全绿）；
`apps/mobile` 的 `bunx tsc --noEmit` 退出码 0（确认提到 19.3.0 未影响 RN 侧）。

## 004 · Web 应用图标与 manifest（iOS 添加到主屏）

**日期**：本次定制第四条
**目标**：iOS「添加到主屏幕」不再显示空白图标，且能拿到正确的标题与图标尺寸。

**为什么**：`apps/web` 之前没有任何 `rel="icon"` / `rel="apple-touch-icon"` / manifest，
也没有 `public/` 目录，iOS 只能回退到页面首屏截图（一片空白），Chrome 控制台还会报
`/favicon.ico` 404。

**改动落点**：

1. 新增 `apps/web/public/`（Vite `publicDir`，构建时原样拷到 `dist/client/` 根）：

| 文件 | 尺寸 | 来源 |
|---|---|---|
| `apple-touch-icon.png` | 180×180 | 直接复用 `website/public/apple-touch-icon.png` |
| `icon-512.png` | 512×512 | 复用 `website/public/og-icon.png` |
| `icon-192.png` | 192×192 | `sips -z 192 192` 从 512 缩 |
| `favicon.png` | 32×32 | `website/public/favicon.png` |
| `manifest.webmanifest` | — | 新建，`display: "browser"`、主题色 `#f7f7f6` |

全部不透明（`hasAlpha: no`）、满幅方形：iOS 会自己套圆角，源图不要再带圆角或透明边。

2. `apps/web/src/routes/__root.tsx` head：`links` 增加 `manifest`、`apple-touch-icon`
   (180x180)、`icon` (32x32 png)；meta 增加 `apple-mobile-web-app-title: Waku`。

**约束**：

- 图标 URL 用绝对路径 `/...`，前提是站点挂在根路径。若将来部署到子路径，必须同时改
  Vite `base` 与这里的 href（manifest 内的 `src`/`start_url`/`scope` 也要一起改）。
- 不要用 `resources/AppIcon.icns` 里的图当 web 图标：macOS 版图标自带圆角、投影和透明留白，
  被 iOS 再套一层圆角会糊。
- `manifest.webmanifest` 现在是 `display: "browser"`（点开仍带 Safari 工具栏）。想全屏独立运行，
  需要同时改 `display: "standalone"` 并加 `<meta name="apple-mobile-web-app-capable" content="yes">`；
  壳层已经按 `env(safe-area-inset-*)` + `--app-height` 准备好，但会失去浏览器的地址栏和返回按钮。
- iOS 会缓存主屏图标：改完必须从主屏删掉再重新添加，否则看到的还是旧图。

**已验证**：`bun --filter @waku/web build` 通过；`dist/client/` 根下五个文件齐全，
`dist/client/index.html` 里四条 link 与 `apple-mobile-web-app-title` 均已出现；
本地静态服务下五个 URL 全部 200 且 `content_type` 正确，manifest 可被 JSON 解析。

## 005 · 主题跟随系统（修 web 端不响应系统明暗）

**日期**：本次定制第五条
**目标**：web 端在「跟随系统」时，操作系统切换明暗后立即生效，不用刷新。

**为什么**：`apps/web/src/components/settings-view.tsx` 里那段 `matchMedia('(prefers-color-scheme: dark)')`
监听挂在 `AppearanceSettings` 组件内部 —— 只有打开「设置 → 外观」页面时才存在。
离开页面监听就卸载，于是：head 内联脚本只在首次加载时解析一次系统偏好，之后系统切换明暗
页面不动，用户会认为「没有自动跟随」。另外「未打开过外观页」的用户从来没写过
`waku.theme`，等于始终只吃加载瞬间的那一次解析。

**改动落点**：

1. `apps/web/src/lib/appearance.ts`：新增 `THEME_STORAGE_KEY`、`followAppearance(doc, storage,
   systemAppearance, events?)` —— 立即应用一次，然后订阅 `matchMedia` 的 `change`（系统切换）
   与 `storage` 事件（其它标签页改选择），返回清理函数。每次应用都重新读 `localStorage`，
   所以「跟随系统 / 固定亮 / 固定暗」三种状态互不干扰。
2. `apps/web/src/routes/__root.tsx`：`RootComponent` 里 `useFollowAppearance()`，随根组件生命周期
   常驻，不再依赖某个设置页面是否挂载。
3. `apps/web/src/components/settings-view.tsx`：外观页只负责写入选择 + 立即应用一次，
   去掉自己那份 `matchMedia` 监听（避免与根组件重复订阅）。
4. `apps/web/src/lib/appearance.test.ts`：补三个用例（系统切换、显式选择不跟随、跨标签页变更）。

**约束**：

- 主题的唯一真相仍是 `localStorage['waku.theme']`（`'system' | 'light' | 'dark'`），
  不要在组件状态里再存一份「当前明暗」；根组件的监听每次都会重读。
- 保留 `__root.tsx` head 里的内联脚本：它负责首屏绘制前就定好 `<html class>`，避免闪白/闪黑。
  删掉它会让根组件挂载前出现一帧错误配色。

**已验证**：`bun test src/lib` 137 项全过（含新增 3 项）；`bun --filter @waku/web build` 退出码 0。
浏览器实测（`dist/client` 静态服务 + Playwright）：初始 `html.class="light"`；写
`localStorage['waku.theme']='dark'` 并派发 `storage` 事件后立即变 `dark`；改回 `'system'`
后回到 `light`（与当时的 `matchMedia` 一致）。
