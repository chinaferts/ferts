#!/usr/bin/env bash
# 产物部署使用
set -euo pipefail

ROOT_DIR="$(pwd)"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5000}"

# ==================== 工具函数 ====================
info() {
  echo "[INFO] $1"
}
warn() {
  echo "[WARN] $1"
}
error() {
  echo "[ERROR] $1"
  exit 1
}
check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "命令 $1 未找到，请先安装"
  fi
}

# ============== 安装 Python 依赖 ======================
info "检查 Python 依赖..."
if command -v python3 &> /dev/null; then
  if [ -f "$ROOT_DIR/server/requirements.txt" ]; then
    info "安装 Python 依赖..."
    pip3 install -r "$ROOT_DIR/server/requirements.txt" --quiet || warn "Python 依赖安装失败，继续..."
  fi
fi
info "Python 依赖检查完成"

# ============== 创建上传目录 ======================
info "创建上传目录..."
mkdir -p "/tmp/uploads/photos"
mkdir -p "/tmp/uploads/qrcode"
info "上传目录创建完成"

# ============== 启动服务 ======================
# 检查核心命令
check_command "pnpm"
check_command "npm"

info "开始执行：pnpm run start (server)"
(pushd "$ROOT_DIR/server" > /dev/null && PORT="$PORT" pnpm run start; popd > /dev/null) || error "服务启动失败"
info "服务启动完成！\n"
