#!/usr/bin/env bash
# 产物部署使用
set -euo pipefail

ROOT_DIR="$(pwd)"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5000}"

info() { echo "[INFO] $1"; }
warn() { echo "[WARN] $1"; }
error() { echo "[ERROR] $1"; exit 1; }

# ============== Python 依赖 ======================
info "检查 Python 依赖..."
if command -v python3 &> /dev/null; then
  if [ -f "$ROOT_DIR/server/requirements.txt" ]; then
    pip3 install -r "$ROOT_DIR/server/requirements.txt" --quiet || warn "Python 依赖安装失败"
  fi
fi
info "Python 依赖检查完成"

# ============== 创建上传目录 ======================
mkdir -p "/tmp/uploads/photos"
mkdir -p "/tmp/uploads/qrcode"
info "上传目录创建完成"

# ============== 构建客户端 ======================
if [ ! -d "$ROOT_DIR/client/dist" ]; then
  info "客户端未构建，开始构建..."
  (cd "$ROOT_DIR/client" && npx expo export --platform web) || warn "客户端构建失败"
fi
info "客户端构建检查完成"

# ============== 复制 node_modules ======================
info "复制 node_modules..."
if [ ! -d "/tmp/server_node_modules" ]; then
  cp -r "$ROOT_DIR/server/node_modules" "/tmp/server_node_modules" || warn "node_modules 复制失败"
fi
info "node_modules 复制完成"

# ============== 构建服务端代码 ======================
info "构建服务端代码..."
cd "$ROOT_DIR/server"
NODE_ENV=production pnpm run build || error "服务端构建失败"
cd "$ROOT_DIR"
info "服务端构建完成"

# ============== 启动服务 ======================
info "开始启动服务..."
cd /tmp/server_dist
# 使用 NODE_PATH 让 Node 能找到复制的 node_modules
NODE_ENV=production PORT="$PORT" NODE_PATH="/tmp/server_node_modules" node --experimental-vm-modules index.mjs &
sleep 3
if pgrep -f "index.mjs" > /dev/null; then
  info "服务启动成功！"
else
  # 如果还是失败，尝试另一种方式
  kill %1 2>/dev/null || true
  NODE_ENV=production PORT="$PORT" NODE_PATH="/tmp/server_node_modules" node index.mjs &
  sleep 3
  if pgrep -f "index.mjs" > /dev/null; then
    info "服务启动成功！"
  else
    error "服务启动失败"
  fi
fi
