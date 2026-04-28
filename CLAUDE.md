# CLAUDE.md — Gp16

## 项目概述

光伏系统 AI 辅助设计与绿色影响分析平台（MVP）。npm workspaces 单体仓库，前端 React + Vite，后端 Fastify + Prisma (PostgreSQL)，异步任务 BullMQ (Redis)。

## 常用命令

```bash
npm install                            # 安装依赖
npm run dev -w @gp16/shared            # 编译共享类型
npm run dev -w @gp16/api               # API 服务 (端口 8080)
npm run dev -w @gp16/web               # 前端开发服务器
npm run build                          # 生产构建
npm run seed -w @gp16/api              # 填充种子数据
```

## 核心规则

### 工作路径约束（最高优先级）

一切修改仅限在 `D:\卯晓梅\Desktop\Gp16` 路径下进行。禁止在其它路径创建或修改任何文件。

### 双语对齐

每次改动必须保持 `apps/web/src/i18n.ts` 中 zh 和 en 两个翻译对象完全对齐。禁止中英文混杂。

### Agent 双模式行为规范

- **Plan 模式**：只做需求分析和方案建议，禁止输出 layout/canvas/device 相关词汇。最终以 question 类型询问用户是否生成布局。
- **Agent 模式**：直接执行布局生成，不询问是否确认。收到完整方案时立即调用 layout tool。
- **Plan → Agent 切换**：前端收集 Plan 模式的方案内容作为 Agent 模式的 prompt 上下文，自动切换并执行。

### 项目结构

- `apps/web/` — React 前端
- `apps/api/` — Fastify 后端（含内联 worker）
- `apps/worker/` — 独立 worker（与 api/worker.ts 逻辑相同，改动需同步）
- `packages/shared/` — 共享 TypeScript 类型
- `deploy/` — VM 部署脚本
