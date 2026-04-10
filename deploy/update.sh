#!/usr/bin/env bash
# 快速部署更新脚本（代码已上传后执行）
# 用法：bash deploy/update.sh
set -euo pipefail
cd /opt/gp16

echo "[1/4] 安装依赖..."
npm install --workspaces

echo "[2/4] 构建..."
npm run build

echo "[3/4] 数据库迁移..."
cd apps/api
npx prisma migrate deploy
npm run seed
cd /opt/gp16

echo "[4/4] 重启服务..."
sudo systemctl restart gp16-api gp16-worker
sudo systemctl status gp16-api gp16-worker --no-pager

echo "部署完成！"
