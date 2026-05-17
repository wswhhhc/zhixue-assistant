# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 错题分析与自适应学习平台 — 高等数学选择题的智能学习工具。AI 批改 + 错因分析 + 自适应推荐。

## 开发命令

```bash
# 后端启动
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 前端启动
cd frontend && npm run dev

# 前端构建
cd frontend && npm run build

# 前端 lint
cd frontend && npm run lint

# Docker 完整启动
docker-start.bat

# Docker 停止
docker-stop.bat
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + Ant Design 6 |
| 公式渲染 | KaTeX |
| 图表 | ECharts 6 |
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| AI | 兼容 OpenAI 格式的 LLM API（DeepSeek / 硅基流动等） |
| 部署 | Docker 一体化容器（多阶段构建） |

## 架构要点

### 前后端分离，Docker 生产合并
- 开发时前端 `:5173` 独立 dev server，后端 `:8000` 提供 API
- 生产构建后前端静态文件由 FastAPI 在 `/` 路径统一托管（`backend/static/`）
- 生产环境 API 使用同源请求（`VITE_API_BASE=""`），无需单独配置 CORS

### 后端结构（`backend/`）
- **main.py** — FastAPI 入口，注册 CORS 中间件、安全头、lifespan（自动备份 DB + 迁移 + 种子数据）
- **database.py** — SQLite 连接（`data/zhixue.db`），启动自动备份（保留 7 份），`run_migrations()` 处理 SQLite 不支持 `ALTER ADD IF NOT EXISTS` 的兼容
- **models.py** — 8 个模型：Question, AnswerRecord, User, UsageRecord, Checkin, Favorite, MembershipCode, PaymentRecord
- **schemas.py** — Pydantic 请求/响应模型，包含管理员相关 schema
- **config.py** — 环境变量加载（LLM API、JWT、SMTP、CORS），北京时间工具函数
- **routers/** — 15 个路由模块，每个独立的 `APIRouter`：
  - `auth`（登录注册 + 验证码）、`practice`（刷题 + AI 批改 SSE 流式）、`questions`（题目查询）、`dashboard`（统计）、`wrongbook`（错题本）、`upload`（拍照上传 + 手动录入）、`qa`（AI 问答 SSE）、`report`（学习报告 SSE）、`checkin`（签到）、`favorites`（收藏）、`user_settings`、`membership`（会员系统）、`payment`（支付）、`admin`（管理员）
- **seed.py / seed_data.py / seed_test_users.py** — 题库初始化脚本

### 前端结构（`frontend/src/`）
- **main.tsx** — 入口，Ant Design ConfigProvider 主题配置（支持暗色/亮色），BrowserRouter + ThemeProvider
- **App.tsx** — 路由定义，分三大块：用户端路由（ProtectedRoute）、管理员端路由（AdminProtectedRoute）、公开路由（登录/支付回调）
- **auth.tsx** — AuthProvider 上下文，管理 token/user_id/membership 等状态，localStorage 持久化，暴露 `authFetch()` 工具函数
- **config.ts** — `API_BASE` 常量，通过 `VITE_API_BASE` 环境变量覆盖
- **contexts/ThemeContext.tsx** — 主题上下文，暗色/亮色切换
- **components/** — 通用组件：AppLayout（用户端布局）、AdminLayout（管理端布局）、ProtectedRoute、AdminProtectedRoute
- **pages/** — 每个功能对应一个页面组件 + CSS
- **styles/** — 三套设计系统 CSS（tech-design-system、scholarly-design-system、design-system）

### 数据流
1. 用户操作 → 前端 fetch（`authFetch` 自动注入 Bearer token）
2. FastAPI 路由处理 → SQLAlchemy ORM → SQLite
3. AI 功能：前端发起 SSE 请求 → 后端调用 LLM API（流式响应）→ 逐 chunk 推送到前端
4. 配额限制（`deps.py`）：非会员每日限制 AI 功能调用次数

### 部署
- 单容器部署，Dockerfile 两阶段构建
- SQLite 数据库通过 volume 持久化到 `data/` 目录
- 环境变量通过 `backend/.env` 配置

### 测试账号
- 用户名：wsw，密码：123456
- 管理员：初始化后通过 `role = 'admin'` 在 users 表设置
