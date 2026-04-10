# GP16 光伏/电力系统 AI 辅助设计平台（MVP）

## 远程测试（老师/助教）

- 访问：`http://137.43.49.40:8080`
- 测试账号（数据库 seed 预置）：
  - `staff@gp16.local` / `Staff123!`
  - `customer@gp16.local` / `Customer123!`

## 项目结构

```text
Gp16/
  apps/
    web/        # React + TS + Vite（画布、仪表盘）
    api/        # Node + TS API（分析、鉴权、报告、任务提交）
    worker/     # BullMQ worker（AI 布局、报告生成）
  packages/
    shared/     # 前后端共享类型与 schema
```

## 本地开发（可选）

你的 Windows 本机当前未安装 Node/npm；如果要本地跑：

1. 安装 Node.js LTS（建议 20+）
2. 在项目根目录执行：

```powershell
npm install
```

随后分别启动：

```powershell
npm run dev -w @gp16/web
npm run dev -w @gp16/api
npm run dev -w @gp16/worker
```

## VM 部署（systemd，无 Docker）

后续实现完成后，会在 `deploy/` 目录提供一键安装与 systemd 服务文件，并写明：

- 安装 Node/PostgreSQL/Redis
- 初始化数据库与 seed 测试账号
- 启动 `api`、`worker`、`web`（web 由 api 提供静态资源）
- 对外监听 `8080`

