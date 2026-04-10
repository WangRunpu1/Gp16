#!/usr/bin/env bash
# GP16 一键部署脚本（Ubuntu 22.04，无 Docker）
# 用法：sudo bash setup.sh
set -euo pipefail

APP_DIR=/opt/gp16
NODE_VERSION=20
PG_DB=gp16
PG_USER=gp16
PG_PASS=gp16pass

echo "=== [1/7] 安装系统依赖 ==="
apt-get update -qq
apt-get install -y curl git postgresql redis-server

echo "=== [2/7] 安装 Node.js ${NODE_VERSION} ==="
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "=== [3/7] 配置 PostgreSQL ==="
systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"

echo "=== [4/7] 启动 Redis ==="
systemctl enable --now redis-server

echo "=== [5/7] 安装 Playwright Chromium ==="
npx playwright install chromium --with-deps 2>/dev/null || true

echo "=== [6/7] 写入 systemd 服务 ==="
cp ${APP_DIR}/deploy/gp16-api.service    /etc/systemd/system/
cp ${APP_DIR}/deploy/gp16-worker.service /etc/systemd/system/
systemctl daemon-reload

echo "=== [7/7] 完成 ==="
echo ""
echo "接下来请执行："
echo "  cd ${APP_DIR} && npm install"
echo "  npm run build"
echo "  cd apps/api && DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost/${PG_DB} npx prisma migrate deploy"
echo "  cd apps/api && DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost/${PG_DB} npm run seed"
echo "  sudo systemctl enable --now gp16-api gp16-worker"
echo ""
echo "访问：http://\$(curl -s ifconfig.me):8080"
