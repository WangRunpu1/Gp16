# 光伏/电力系统 AI 设计平台：Cursor 可落地实施步骤

本文件把规划中的“后续在 Cursor 中的实施步骤（概览）”拆解为**可逐步落地**的迭代（Iteration）。每个迭代都包含：目标、产出物（文件/接口/UI）、命令（PowerShell）、验收点与回滚方式。

> 约定：本项目使用 **前端 React + TypeScript（Vite）**、**后端 FastAPI**，并逐步引入 **Redis + Celery**、**PostgreSQL** 与 **Docker Compose**。前期先用 **SQLite** 与“假数据/经验公式”跑通闭环，再逐步增强。

---

## 0) 先决条件（一次性）

- **本机工具**：
  - Node.js LTS（含 npm）
  - Python 3.11+（建议 3.11/3.12）
  - Docker Desktop（后续迭代需要）
- **目录约定**（最终形态）：

```text
Gp16/
  frontend/                 # React+TS+Vite
  backend/                  # FastAPI
  docker-compose.yml         # 容器编排（后期）
  README.md
  IMPLEMENTATION_STEPS.md
```

---

## Iteration 1：项目骨架可启动（前后端“Hello”打通）

### 目标
- 前端可启动并访问。
- 后端可启动并返回健康检查。
- 前端能请求后端（开发环境跨域）。

### 产出物
- `frontend/`：Vite + React + TS 项目
- `backend/`：FastAPI 项目，提供：
  - `GET /healthz`
- 本地启动说明写入 `README.md`

### 建议命令（PowerShell）
（在项目根目录 `Gp16/`）

```powershell
# 前端
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
cd ..

# 后端（建议使用 venv）
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi uvicorn[standard]
```

### 验收点
- `frontend` 启动后能看到默认页面。
- `backend` 启动后访问 `http://127.0.0.1:8000/healthz` 返回 `{"ok": true}`（或等价）。
- 前端能成功 `fetch` 后端 `/healthz` 并在页面展示状态。

### 回滚方式
- 删除 `frontend/` 或 `backend/` 目录即可回到干净状态。

---

## Iteration 2：前端画布与基础交互（本地状态版）

### 目标
- 画布页面具备：设备工具栏、画布、分析面板框架、AI 输入栏（先不接后端）。
- 支持：添加节点、拖拽、连线、删除（react-flow 默认能力即可）。
- 使用 `zustand`（或轻量 state）管理 `nodes/edges`。

### 产出物
- `frontend/src/pages/CanvasPage.tsx`（或路由对应页面）
- `frontend/src/components/`：
  - `DevicePalette`
  - `TopologyCanvas`（react-flow）
  - `AnalyticsPanel`（先占位卡片）
  - `AILayoutBar`（文本框+按钮，先只写入本地日志）
- `frontend/src/state/topologyStore.ts`（zustand store）

### 验收点
- 不连后端也能完成：添加节点→拖动→连线→删除→刷新后丢失（迭代 3 再做保存/同步）。
- 画布操作流畅，无明显卡顿。

---

## Iteration 3：后端分析接口（经验公式）+ 前端防抖调用

### 目标
- 后端实现 `POST /analysis`：输入拓扑 JSON + 项目参数，返回：
  - `summary`：年发电量、碳减排、等效植树
  - `cost_series`：5/10 年成本对比序列（先简单版）
- 前端在拓扑变化后 **1–2 秒防抖**调用 `/analysis`，驱动 `AnalyticsPanel` 展示。

### 产出物（后端）
- `backend/app/main.py`（或等价入口）
- `backend/app/schemas.py`：请求/响应 Pydantic 模型
- `backend/app/services/analysis.py`：计算函数（使用规划中的经验公式，参数可配置并提供默认值）
- CORS 配置允许 `frontend` 开发端口

### 产出物（前端）
- `frontend/src/api/client.ts`：封装 API 请求
- `frontend/src/hooks/useDebouncedAnalysis.ts`：拓扑变更触发分析
- `AnalyticsPanel` 展示 `summary` 与简单图表（先用 ECharts/Recharts 二选一）

### 验收点
- 拖动/连线不会每次都打 API（防抖生效）。
- 后端对缺失参数提供默认值，前端能拿到稳定响应。

---

## Iteration 4：拓扑持久化（先 SQLite）+ 方案版本雏形

### 目标
- 后端可保存/读取拓扑：
  - `POST /topologies`：保存当前拓扑，返回 `topology_id` 与 `version`
  - `GET /topologies/{id}`：读取
- 前端支持“保存方案”“加载方案”（最简按钮即可）。

### 产出物
- 后端引入 SQLAlchemy（或 SQLModel）+ SQLite：
  - `projects`/`topologies` 表先最小化（不必一次做全）
- 前端保存/加载按钮与简单列表（可先硬编码单条）

### 验收点
- 刷新页面后仍可从后端加载同一拓扑并渲染。

---

## Iteration 5：AI 布局异步任务（Redis + Celery）跑通

### 目标
- 引入 Redis 与 Celery，后端提供：
  - `POST /ai/layout`：提交任务（prompt + constraints），返回 `task_id`
  - `GET /ai/layout/{task_id}`：轮询状态与结果
- Worker 端完成：
  - 调用大模型 HTTP API（先用 stub/mock 也可以）
  - 输出 JSON 结构校验/修复（至少保证能解析为拓扑结构）
- 前端：
  - `AILayoutBar` 提交 prompt
  - 轮询任务状态，完成后把返回的 `nodes/edges` 应用到画布

### 关键设计约束（建议在实现时固化）
- **LLM 输出必须是 JSON**（禁止自然语言）
- 输出 schema 版本字段：`layout_version`
- 对设备类型与关键数值做最基本校验（负数、空数组等）

### 验收点
- 即使先用 mock LLM，也能完整跑通：提交→轮询→画布更新。
- 失败时（JSON 解析失败/超时）前端有明确错误提示。

---

## Iteration 6：报告生成（异步）+ PDF 下载

### 目标
- 后端提供：
  - `POST /reports`：触发报告生成（传 topology_id 或完整 JSON + analysis_id）
  - `GET /reports/{task_id}`：轮询状态，完成后返回 `download_url`
  - `GET /reports/download/{report_id}`：下载 PDF
- Worker 使用 HTML 模板（Jinja2）生成 PDF（WeasyPrint 或 wkhtmltopdf）
- 前端一键生成报告：显示进度，完成后自动下载

### 验收点
- 生成的 PDF 至少包含：封面（可简化）、拓扑快照占位、设备清单占位、关键指标（summary）。

---

## Iteration 7：容器化（docker-compose）一键启动开发/演示环境

### 目标
- 增加 `docker-compose.yml`：
  - `web`（前端构建产物由 Nginx 或 node 静态服务）
  - `api`（FastAPI）
  - `worker`（Celery worker）
  - `redis`
  - `db`（PostgreSQL，可从 Iteration 4 的 SQLite 迁移）
- 本地一条命令启动（面向演示/部署）

### 验收点
- `docker compose up --build` 后：
  - 前端可访问
  - 后端健康检查正常
  - AI/报告任务能跑通（至少 mock 模式）

---

## Iteration 8：配置与体验优化（收尾）

### 目标
- 参数配置页面（地点、电价、年用电量、排放因子等）
- 更稳健的错误处理、加载态、重试
- 逐步把“默认值”外置到配置（环境变量/配置文件/DB）

### 验收点
- 非技术用户可在 UI 内调整关键参数并看到分析结果变化。

---

## Cursor 落地执行方式（推荐工作流）

- **每个 Iteration 都保持“可运行”**：前端/后端/worker 任一新增能力都要能单独验收。
- **优先闭环，再扩展精度**：先让拓扑→分析→报告链路跑通，再提升计算模型/约束校验。
- **严格固定接口契约**：`/analysis`、`/ai/layout`、`/reports` 的请求/响应 Pydantic 模型优先落地，减少前后端反复改字段。

