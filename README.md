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

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + Ant Design |
| 公式渲染 | KaTeX |
| 图表 | ECharts |
| 后端 | Python FastAPI + SQLAlchemy |
| 数据库 | SQLite |
| AI | 兼容 OpenAI 格式的 LLM API（DeepSeek / 硅基流动等）|
| 部署 | Docker 一体化容器 |

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

## 测试账号

```
用户名：wsw
密码：123456
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
│   ├── email_util.py        # 邮件发送工具
│   ├── requirements.txt     # Python 依赖
│   ├── routers/             # API 路由
│   │   ├── auth.py          # 登录注册
│   │   ├── practice.py      # 刷题 + AI 批改
│   │   ├── questions.py     # 题目查询
│   │   ├── dashboard.py     # 仪表盘统计
│   │   ├── wrongbook.py     # 错题本
│   │   ├── upload.py        # 上传题目
│   │   ├── qa.py            # AI 问答
│   │   ├── report.py        # 学习报告
│   │   ├── checkin.py       # 签到
│   │   ├── favorites.py     # 收藏
│   │   ├── user_settings.py # 用户设置
│   │   ├── membership.py    # 会员系统
│   │   ├── payment.py       # 支付
│   │   └── deps.py          # 配额限制依赖
│   └── scripts/             # 工具脚本
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── utils/           # 工具函数
│   │   └── auth.tsx         # 登录状态管理
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
| POST | /membership/codes | 批量生成兑换码（管理员）|
| POST | /membership/set | 手动设置会员（管理员）|
| POST | /payment/create | 创建支付订单 |
| GET | /payment/callback | 支付回调 |
| GET | /report/generate | 生成学习报告（SSE 流式）|
