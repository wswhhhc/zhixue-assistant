# 智学助手 — AI 驱动的学科诊断与自适应学习平台

AI 批改 + 错因分析 + 自适应推荐，专注于高等数学选择题的智能学习平台。

## 功能特性

- **智能刷题** — 随机抽题 / 知识点推荐，自适应推送薄弱点
- **AI 批改** — 答对得肯定与拓展，答错得错因诊断 + 解题步骤 + 学习建议
- **相似题生成** — 错题后 AI 自动生成同知识点巩固题
- **错题本** — 按错因类型筛选，查看原题 + AI 分析详情
- **掌握度雷达图** — 各知识点掌握情况可视化
- **拍照上传题目** — 图片识别提取题目，AI 审查后入库
- **AI 问答** — 仪表盘底部随时提问
- **验证码登录** — 图片验证码 + 邮箱注册验证码
- **会员系统** — 会员兑换码、配额管理、支付集成
- **学习报告** — 全面数据统计 + AI 学习建议，支持打印/导出
- **管理员后台** — 系统概览 / 用户管理 / 题库管理 / 内容审核 / 兑换码管理 / 支付管理 / 错题分析

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + Ant Design 6 |
| 公式渲染 | KaTeX |
| 图表 | ECharts 6 |
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| 数据库 | SQLite |
| AI | 兼容 OpenAI 格式的 LLM API（DeepSeek / 硅基流动等）|
| 部署 | Docker 一体化容器（多阶段构建）|

## 快速开始

### 方式一：Docker（推荐）

```bash
# 启动（首次会自动构建）
docker-start.bat

# 停止
docker-stop.bat
```

访问 http://localhost:8000

### 方式二：本地开发

```bash
# 1. 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. 前端（新开终端）
cd frontend
npm install
npm run dev
```

或直接运行 `start.bat`。

### 前置配置

在 `backend/.env` 中配置 LLM API（已配置硅基流动，可直接使用）：

```env
LLM_API_KEY=sk-your-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=Qwen/Qwen3-VL-8B-Instruct

# SMTP 邮箱（注册验证码用，可省略）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@qq.com
SMTP_PASS=your-auth-code
```

## 管理员端

管理员后台提供运营管理功能，包括：

- **系统概览** — 用户数、题目数、答题量、会员数等核心指标
- **统计图表** — 做题趋势、知识点正确率、来源分布、行为趋势
- **用户管理** — 用户列表搜索、会员编辑、用户学习详情查看
- **题库管理** — 全部题目列表、筛选、编辑、删除
- **内容审核** — 用户上传题目的审核/驳回
- **兑换码管理** — 批量生成、启用/禁用
- **支付管理** — 支付订单列表与状态查看
- **错题分析** — 高频错题排行榜、错误类型分布、薄弱知识点排名

访问 `/admin/login` 使用管理员账号登录。

## 测试账号

```
学生端：用户名 wsw，密码 123456
管理员：需要在 users 表中设置 role = 'admin'
```

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── database.py          # 数据库连接
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic 模式定义
│   ├── config.py            # 配置（API Key 等）
│   ├── seed.py              # 预置题库初始化
│   ├── seed_data.py         # 题库数据（题目内容）
│   ├── seed_test_users.py   # 测试用户初始化
│   ├── email_util.py        # 邮件发送工具
│   ├── schemas.py           # Pydantic 请求/响应模型（含管理员 schema）
│   ├── config.py            # 环境变量配置（LLM API / JWT / SMTP / CORS）
│   ├── requirements.txt     # Python 依赖
│   ├── routers/             # API 路由（15 个模块）
│   │   ├── auth.py          # 登录注册 + 验证码
│   │   ├── practice.py      # 刷题 + AI 批改 SSE
│   │   ├── questions.py     # 题目查询
│   │   ├── dashboard.py     # 仪表盘统计
│   │   ├── wrongbook.py     # 错题本
│   │   ├── upload.py        # 上传题目（拍照+手动）
│   │   ├── qa.py            # AI 问答 SSE
│   │   ├── report.py        # 学习报告 SSE
│   │   ├── checkin.py       # 签到打卡
│   │   ├── favorites.py     # 收藏管理
│   │   ├── user_settings.py # 用户设置
│   │   ├── membership.py    # 会员系统
│   │   ├── payment.py       # 支付
│   │   ├── admin.py         # 管理员后台
│   │   ├── notifications.py # 通知系统
│   │   └── deps.py          # 配额限制依赖
│   └── scripts/             # 工具脚本
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── admin/       # 管理员页面（7 个）
│   │   │   └── ...          # 用户端页面（12 个）
│   │   ├── components/      # 通用组件
│   │   ├── contexts/        # 上下文（ThemeContext）
│   │   ├── hooks/           # 自定义钩子（useChartTheme）
│   │   ├── utils/           # 工具函数（renderLatex）
│   │   ├── styles/          # 设计系统 CSS（3 套）
│   │   ├── auth.tsx         # 用户登录状态管理
│   │   ├── adminAuth.ts     # 管理员认证工具
│   │   └── config.ts        # API_BASE 配置
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── 需求文档.md
│   ├── 开发顺序.md
│   └── 用户手册.md
│
├── Dockerfile
├── docker-compose.yml
├── docker-start.bat
├── docker-stop.bat
└── start.bat
```

## API 概览

### 用户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/register | 注册 |
| POST | /auth/login | 登录 |
| POST | /auth/captcha | 获取验证码图片 |
| GET | /questions/random | 随机题目 |
| GET | /questions/knowledge-points | 知识点列表 |
| POST | /practice/submit | 提交答案（SSE 流式返回 AI 分析）|
| POST | /practice/generate-similar | 生成相似题 |
| GET | /practice/recommend | 推荐薄弱知识点题目 |
| GET | /dashboard/stats | 仪表盘统计数据 |
| GET | /wrong-book | 错题本列表（支持筛选） |
| GET | /wrong-book/{id} | 错题详情 |
| POST | /upload/image | 拍照上传识别 |
| POST | /upload/manual | 手动输入题目 |
| POST | /qa/ask | AI 问答（SSE 流式） |
| GET | /checkin/today | 今日签到状态 |
| POST | /checkin | 签到 |
| GET | /checkin/status | 签到状态（连续天数/本周）|
| GET | /favorites | 收藏列表 |
| POST | /favorites/add | 添加收藏 |
| POST | /favorites/remove | 取消收藏 |
| GET | /user/goal | 获取每日目标 |
| PUT | /user/goal | 修改每日目标 |
| GET | /membership/status | 会员状态与配额 |
| POST | /membership/redeem | 兑换会员码 |
| POST | /payment/create | 创建支付订单 |
| GET | /payment/callback | 支付回调 |
| GET | /report/generate | 生成学习报告（SSE 流式）|
| GET | /notifications | 通知列表（当前用户）|
| PUT | /notifications/{id}/read | 标记通知已读 |

### 管理员 API（需要 admin 权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /admin/login | 管理员登录 |
| GET | /admin/stats | 系统概览统计 |
| GET | /admin/stats/trend | 每日答题趋势 |
| GET | /admin/stats/knowledge-mastery | 各知识点正确率 |
| GET | /admin/stats/overview-charts | 来源分布 & 会员比例 |
| GET | /admin/stats/dashboard-insights | 行为趋势 & 待处理事项 |
| GET | /admin/users | 用户列表（分页+搜索） |
| PUT | /admin/users/{id} | 编辑用户会员信息 |
| GET | /admin/users/{id}/stats | 用户学习详情 |
| GET | /admin/questions | 全部题目列表（含筛选） |
| PUT | /admin/questions/{id} | 编辑题目 |
| DELETE | /admin/questions/{id} | 删除题目 |
| GET | /admin/questions/pending | 待审核题目列表 |
| PUT | /admin/questions/{id}/review | 审核题目（通过/驳回） |
| POST | /admin/questions/batch-review | 批量审核题目 |
| GET | /admin/codes | 兑换码列表 |
| POST | /admin/codes/generate | 批量生成兑换码 |
| PUT | /admin/codes/{id} | 启用/禁用兑换码 |
| GET | /admin/payments | 支付订单列表 |
| GET | /admin/analytics/wrong-questions | 高频错题排行榜 |
| GET | /admin/analytics/error-types | 全平台错误类型分布 |
| GET | /admin/analytics/weak-knowledge | 薄弱知识点排名 |
