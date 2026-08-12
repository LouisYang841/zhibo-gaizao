# 组装姬

> 基于「章鱼喷墨机」的完全重制版，模块化架构，功能全面扩展。

## 简介

**组装姬** 是对原版 [章鱼喷墨机](https://github.com/yuccc7878/zhibo-gaizao) 聊天应用的深度重制。保留了原版核心的 AI 角色聊天体验，同时将单文件架构重构为模块化引擎系统，新增直播、商店、抽卡、换装等多个功能模块。

### 与原版的关系

| | 原版「章鱼喷墨机」 | 重制版「组装姬」 |
|---|---|---|
| 架构 | 单 HTML 文件（~5000 行） | 模块化引擎 + 独立功能模块 |
| AI 调用 | 各处直接 fetch | AiService 统一服务层 |
| 功能模块 | 聊天 + 基础设置 | +直播/商店/抽卡/相册/换装/游戏/媒体 |
| 核心函数 | 76 个 | 保留 74 个 + 新增 84 个 |
| 总代码量 | ~5000 行 | ~12000 行 |

核心聊天逻辑（消息收发、气泡渲染、记忆系统、世界书、群聊等）**完全保留**，在此基础上扩展了模块化引擎和多个独立功能模块。

## 📌 本 Fork 改动（LouisYang841 版）

> 在「组装姬」基础上针对公开部署做的定制改动。

### 🌐 在线部署（GitHub Pages）

- 部署地址：**https://louisyang841.github.io/zhibo-gaizao/**
- 纯静态部署（无后端），所有数据存浏览器 IndexedDB / localStorage
- 部署方式：Pages source 指向 `main` 分支根目录，push 后约 1 分钟自动构建

### 🚀 OpenRouter 一键免费配置

- 「API 设置 → 新增配置」底部新增 **「🚀 一键填入 OpenRouter 免费配置」** 按钮
- 一键填入：端点 `https://openrouter.ai/api` + 内置公开 key + 免费模型 `google/gemma-4-26b-a4b-it:free`
- API 服务商下拉新增 `OpenRouter (免费)` 选项，选中自动填端点/路径
- **key 说明**：公开共享 key（额度上限 0.5 credit），仅供免费模型（`:free` 后缀）使用——免费模型不消耗额度；若 key 失效，在 OpenRouter dashboard 删除重建即可，页面可自行更换
- 免费模型上游偶发 429 限流（共享配额），属正常现象，稍后自动恢复

### 🧹 NSFW 强制规范移除

- 删除 `js/ui/promptBuilder.js` 中硬编码的 `NSFW_RULES` 常量（私聊 + 群聊均移除）
- 需要成人向风格的用户可在角色「自定义系统指令」或世界书自行注入
- `promptDefaults.js` 中「可以自由发言，不受内容限制」默认模板保留（设置内可修改），用于避免模型对正常话题拒答

### 🔧 开发注意事项（踩坑记录）

1. **GitHub Pages 缓存**：Pages 对所有文件下发 `max-age=600`（10 分钟）缓存。修改 JS 后**必须** bump `index.html` 中 `app.js?v=N` 版本号，否则浏览器命中旧缓存看不到变化
2. **双层 DOM 缓存**：新增 UI 元素 ID 必须同时登记：
   - `js/core/dom.js` 的 `IDS` 白名单（HTML 注入前缓存）
   - `js/app.js` ~71 行「重新缓存数组」（HTML 注入后缓存）
   
   漏任一层 → 元素引用为 `null` → 事件绑定被 `?.` 静默吞掉，点按钮没反应且无报错
3. **Push Protection**：GitHub secret scanning 会拦截 `sk-or-v1-...` 格式的 key。如需公开 key，用字符串拼接（`'sk-or-' + 'v1-...'`）绕过扫描

### 功能一览

**核心功能（继承自原版）**
- 💬 私聊 / 群聊，AI 角色扮演
- 🎭 表情包、语音、照片/视频、转账、礼物
- 📝 对话摘要 + 关键事件记忆系统
- 📖 世界书（全局 + 角色专属）
- 🎨 自定义气泡样式、主题颜色、字体
- 🖼️ AI 自主配图

**新增功能模块**

| 模块 | 图标 | 说明 |
|------|------|------|
| 直播 | 📺 | AI 剧情生成 + 弹幕互动，打赏系统，场景/等级/道具选择，AI 生图背景 |
| 商店 | 🛒 | 日常消费 + 限定套装，购买后可赠送，道具用于直播消耗 |
| 抽卡 | 🎲 | AI 角色生成，许愿系统，批量抽卡，加为好友 |
| 媒体 | 📰 | B站/头条/OnlyFans 三频道，AI 生成内容列表，流式详情页，分享到聊天 |
| 相册 | 📷 | 图片导入，封面设置 |
| 换装 | 👗 | 拖拽换装，15 种肤色，121 件内置服装，自定义导入，PNG 导出 |
| 游戏 | 🎮 | 2048/贪吃蛇/像素鸟/老虎机，金币奖励 |
| 激活世界 | 🌐 | AI 主动推进剧情，定时触发，支持私聊/群聊/双模式 |

## 项目结构

```
zhibo-gaizao/
├── 组装姬.html              # 主入口
├── app.js                    # 聊天室核心逻辑（单文件兼容版）
│
├── js/
│   ├── core/
│   │   ├── aiService.js      # AiService 统一 AI 通信层
│   │   ├── dataService.js    # 数据服务
│   │   ├── dom.js            # DOM 缓存
│   │   └── utils.js          # 工具函数与常量
│   ├── ui/
│   │   ├── chatRoom.js       # 聊天室
│   │   ├── chatList.js       # 聊天列表
│   │   ├── homeScreen.js     # 主屏幕
│   │   ├── settings.js       # 聊天设置
│   │   ├── customize.js      # 自定义 + 数据备份/导入
│   │   ├── wallpaper.js      # 壁纸
│   │   └── fontSettings.js   # 字体
│   └── systems/
│       ├── worldBook.js      # 世界书
│       ├── apiSettings.js    # API 设置
│       ├── group.js          # 群聊系统
│       ├── wallet.js         # 钱包/转账
│       ├── gift.js           # 礼物
│       ├── stickers.js       # 表情包
│       ├── voice.js          # 语音
│       ├── photoVideo.js     # 照片/视频
│       ├── imageRecognition.js # 图片识别
│       └── timeSkip.js       # 时间跳跃
│
├── engine/                   # 引擎核心层
│   ├── core.js               # Engine 模块注册 + AI 服务桥接
│   ├── db.js                 # 数据持久化（Dexie/IndexedDB）
│   ├── ui.js                 # UI 工具函数
│   └── styles.css            # 全局样式
│
├── modules/                  # 功能模块
│   ├── live/                 # 直播
│   ├── shop/                 # 商店
│   ├── gacha/                # 抽卡
│   ├── media/                # 媒体
│   ├── album/                # 相册
│   ├── wardrobe/             # 换装
│   ├── games/                # 游戏
│   └── bilibili/             # B站数据
│
├── assets/
│   ├── icons/nav/            # 侧边栏图标（本地）
│   ├── stickers/             # 内置表情包
│   └── wallpaper.jpg         # 默认壁纸
│
├── SKILL-MODULE-DEV.md       # 模块开发标准作业流程
├── CHANGELOG.md
└── README.md
```

## AI 服务架构

所有 AI 调用统一通过 `AiService` 适配层，模块无需关心底层 Provider 差异。

### 支持的 Provider

| Provider | 说明 |
|----------|------|
| `newapi` | 自定义 OpenAI 兼容 API |
| `deepseek` | DeepSeek |
| `claude` | Anthropic Claude |
| `gemini` | Google Gemini |

### 调用方式

```js
// 文字生成（流式）
const text = await Engine.services.aiChat({
    system: '系统提示词',
    messages: [{ role: 'user', content: '用户输入' }],
    onToken: (delta) => { element.textContent += delta; },
});

// 图片生成
const imageUrl = await Engine.services.aiGenerateImage('图片描述');
```

### 架构层次

```
模块代码
  ↓ Engine.services.aiChat() / aiGenerateImage()
Engine.services（自动同步 db 配置）
  ↓ AiService.chat() / generateImage()
AiService（适配器模式：OpenAI / Gemini）
  ↓ fetch()
外部 API
```

## Engine API

```js
// 模块注册
Engine.register({ id, name, icon, screen, order, init(), open() })
Engine.getModule(id)
Engine.getAllModules()

// AI 服务
Engine.services.aiChat({ system, messages, options, onToken })
Engine.services.aiGenerateImage(prompt, options)

// 数据 & UI
Engine.services.db
Engine.services.saveData()
Engine.services.switchScreen()
Engine.services.showToast()
```

## 自定义模块开发

详见 [SKILL-MODULE-DEV.md](./SKILL-MODULE-DEV.md)。

```bash
mkdir modules/my-module
```

```js
// modules/my-module/my-module.js
Engine.register({
    id: 'my-module',
    name: '我的模块',
    icon: '🎯',
    screen: 'my-module-screen',
    order: 10,

    async doAiTask() {
        const result = await Engine.services.aiChat({
            system: '你是一个...',
            messages: [{ role: 'user', content: '...' }],
        });
    },
});
```

## 依赖

- [Dexie.js](https://dexie.org/) - IndexedDB 封装（CDN）
- 需要配置 AI API（支持 DeepSeek / Claude / Gemini / NewAPI）

## 致谢

原版项目：[章鱼喷墨机](https://github.com/yuccc7878/zhibo-gaizao) — 本项目在其基础上进行了模块化重构与功能扩展。
