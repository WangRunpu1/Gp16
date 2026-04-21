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

### 双语对齐（最高优先级）

每次改动必须保持 `apps/web/src/i18n.ts` 中 zh 和 en 两个翻译对象完全对齐。禁止中英文混杂。

### 项目结构

- `apps/web/` — React 前端
- `apps/api/` — Fastify 后端（含内联 worker）
- `apps/worker/` — 独立 worker（与 api/worker.ts 逻辑相同，改动需同步）
- `packages/shared/` — 共享 TypeScript 类型
- `deploy/` — VM 部署脚本
