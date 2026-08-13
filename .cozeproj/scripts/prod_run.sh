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

# ============== 安装中文字体 ======================
info "检查中文字体..."
FONT_PATH="/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
if [ ! -f "$FONT_PATH" ]; then
  info "安装中文字体..."
  # 尝试多种安装方式
  if command -v apt-get &> /dev/null; then
    apt-get install -y -qq fonts-wqy-microhei 2>/dev/null || \
    warn "apt-get 安装中文字体失败"
  elif command -v yum &> /dev/null; then
    yum install -y -q wqy-microhei-fonts 2>/dev/null || \
    warn "yum 安装中文字体失败"
  else
    warn "未找到包管理器，跳过中文字体安装"
  fi
  
  # 再次检查字体是否安装成功
  if [ ! -f "$FONT_PATH" ]; then
    warn "中文字体未找到，PDF可能无法显示中文"
  else
    info "中文字体安装成功"
  fi
else
  info "中文字体已存在"
fi
info "中文字体检查完成"

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

# ============== 构建服务端代码 ======================
info "构建服务端代码..."
cd "$ROOT_DIR/server"

# 始终安装 Node.js 依赖（确保外部化依赖可用）
info "安装服务端依赖..."
pnpm install --prod --frozen-lockfile || error "服务端依赖安装失败"

NODE_ENV=production pnpm run build || error "服务端构建失败"
cd "$ROOT_DIR"
info "服务端构建完成"

# ============== 启动服务 ======================
info "开始启动服务..."
cd /tmp/server_dist

# 设置 NODE_PATH 指向服务端依赖目录
export NODE_PATH="$ROOT_DIR/server/node_modules"

NODE_ENV=production PORT="$PORT" node index.cjs &
sleep 3
if pgrep -f "index.cjs" > /dev/null; then
  info "服务启动成功！"
else
  error "服务启动失败"
fi
