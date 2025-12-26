# Long Video Assistant (LVA) - 长视频创作助手

LVA 是一个基于 AI 驱动的个人长视频生产力工具。它旨在自动化从灵感到成片的繁琐流程，包括脚本撰写、分镜设计、AI 绘画生图、标题策划以及封面生成。

本项目采用 **Local-First** 架构，数据优先存储在本地 IndexedDB，支持离线使用，并能与 Cloudflare D1 (数据库) 和 R2 (对象存储) 进行云端同步。

## ✨ 核心功能

*   **全流程工作流**：
    *   **项目策划**：节点化视图管理 Input -> Script -> Storyboard -> Titles -> Cover。
    *   **AI 辅助**：集成 Google Gemini (2.5 Flash, 3 Pro) 模型，自动生成脚本、提取分镜画面描述、撰写简介。
    *   **分镜工坊**：批量 AI 生图 (支持 Gemini Image / Imagen 3)，支持本地预览、手工上传与云端同步。
*   **工具箱**：
    *   **灵感仓库**：收集稍纵即逝的灵感，支持 AI 智能解析杂乱文本提取选题。
    *   **AI 标题生成器**：独立工具，针对选题生成高点击率标题与封面方案。
*   **数据同步**：
    *   本地 IndexedDB 极速响应。
    *   后台自动与 Cloudflare D1 同步元数据。
    *   图片资源自动上传至 Cloudflare R2。
*   **高度可配置**：
    *   内置提示词 (Prompt) 编辑器，可自定义每个环节的 AI 指令。
    *   支持自定义 API Key 与模型选择。

## 🛠 技术栈

### 前端 (Client)
*   **Framework**: React 19 + Vite
*   **UI Library**: Tailwind CSS, Lucide React
*   **Routing**: React Router DOM
*   **State/Storage**: IndexedDB (Dexie-like wrapper), LocalStorage
*   **AI SDK**: Google GenAI SDK (`@google/genai`)

### 后端 / 基础设施 (Cloudflare)
*   **Hosting**: Cloudflare Pages
*   **Serverless**: Cloudflare Pages Functions (`/functions`)
*   **Database**: Cloudflare D1 (SQLite) - 用于存储项目元数据、灵感和设置。
*   **Storage**: Cloudflare R2 - 用于存储生成的图片。

## 🚀 本地开发指南

### 1. 环境准备
*   Node.js (v18+)
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (Cloudflare 开发工具)
*   一个 Google Cloud 项目 (获取 Gemini API Key)
*   一个 Cloudflare 账号

### 2. 克隆与安装
```bash
git clone <repository-url>
cd long-video-assistant
npm install
```

### 3. 配置 Cloudflare 资源 (Wrangler)
在项目根目录创建一个 `wrangler.toml` 文件（如果不存在），用于本地模拟 D1 和 R2 环境：

```toml
name = "long-video-assistant"
pages_build_output_dir = "dist"
compatibility_date = "2024-03-20"

# 绑定 D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "lva-db"
database_id = "xxxx-xxxx-xxxx-xxxx" # 本地开发时可以是任意占位符，部署时需真实ID

# 绑定 R2 存储桶
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "lva-images"
```

### 4. 运行开发服务器
本项目使用 `wrangler pages dev` 来代理 Vite 服务器，以便支持 Functions、D1 和 R2 的本地模拟。

```bash
# 启动前端 + 后端 (Functions) + 数据库模拟
npx wrangler pages dev -- npm run dev
```
*注意：首次运行会自动在本地 `.wrangler` 目录创建 SQLite 数据库文件。应用代码会自动初始化数据表结构 (`projects`, `inspirations`, `tools`, `prompts`)，无需手动运行 SQL。*

### 5. 配置环境变量
在项目根目录创建 `.env` 文件：

```env
# Google Gemini API Key
API_KEY=your_google_gemini_api_key
```

## ☁️ 部署指南 (Cloudflare Pages)

### 1. 创建 Cloudflare 资源
登录 Cloudflare Dashboard：
1.  **D1**: 创建一个数据库，命名为 `lva-db`。
2.  **R2**: 创建一个存储桶，命名为 `lva-images`。
    *   *重要*：在 R2 设置中配置 **CORS 策略**，允许你的域名访问（或允许所有 `*` 用于测试），否则前端无法下载/预览图片。

### 2. 绑定资源到 Pages
1.  创建一个新的 Pages 项目，连接你的 Git 仓库。
2.  **构建设置**：
    *   Build command: `npm run build`
    *   Build output directory: `dist`
3.  **设置 (Settings) -> Functions**:
    *   **D1 database bindings**: 变量名 `DB` -> 选择你创建的 `lva-db`。
    *   **R2 bucket bindings**: 变量名 `BUCKET` -> 选择你创建的 `lva-images`。
4.  **设置 (Settings) -> Environment variables**:
    *   添加变量 `API_KEY`，填入你的 Gemini API Key。

### 3. 部署
保存设置后，触发一次部署。应用将自动上线。

## 🔐 安全说明

*   **访问控制**：项目包含一个简单的硬编码密码登录页面 (`LandingPage.tsx` 和 `AuthGuard.tsx`)。
    *   默认密码：`1211`
    *   超级密码：`samsung1`
    *   **强烈建议**：部署前请在代码中修改这些密码，或集成更完善的 Auth 服务（如 Cloudflare Access）。
*   **API Key 安全**：
    *   API Key 通过环境变量注入构建过程 (`vite.config.ts`)。在 Cloudflare Pages 中，它作为环境变量存储，相对安全。
    *   应用支持用户在前端设置页面填入自定义 API Key（存储在 LocalStorage），以覆盖默认 Key。

## 📂 项目结构

```
├── components/        # React 组件 (Layout, AuthGuard)
├── functions/         # Cloudflare Pages Functions (后端 API)
│   ├── api/
│   │   ├── images/    # R2 图片上传/下载/删除
│   │   ├── projects/  # D1 项目 CRUD
│   │   ├── sync.ts    # 数据同步接口
│   │   └── ...
├── pages/             # 页面组件 (Dashboard, Workspace, etc.)
├── services/          # 业务逻辑服务
│   ├── geminiService.ts  # AI 调用封装
│   ├── storageService.ts # 数据存储 (IndexedDB + API Sync)
├── types.ts           # TypeScript 类型定义
├── index.html         # 入口 HTML
├── vite.config.ts     # Vite 配置
└── README.md          # 本文档
```

## ⚠️ 注意事项

1.  **Gemini 模型**：
    *   默认使用 `gemini-2.5-flash` (免费且快速)。
    *   高清生图使用 `gemini-3-pro-image-preview`，这可能需要 Google Cloud 计费账号。
2.  **R2 费用**：Cloudflare R2 有免费额度（10GB 存储，A类操作 100万次/月），个人使用通常足够，但请留意用量。
3.  **数据备份**：虽然有云端同步，但建议定期导出重要数据（应用内提供了 CSV 导出功能）。

## License

MIT License
