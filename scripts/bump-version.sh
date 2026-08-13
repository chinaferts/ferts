#!/bin/bash
# 自动增加版本号脚本
# 在每次部署前运行，自动将 app.config.ts 中的版本号增加 0.0.1

set -e

APP_CONFIG="client/app.config.ts"
VERSIONS_FILE="server/src/routes/versions.ts"

echo " 自动更新版本号..."

# 从 app.config.ts 提取当前版本号
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$APP_CONFIG")

if [ -z "$CURRENT_VERSION" ]; then
  echo "❌ 无法从 $APP_CONFIG 中提取版本号"
  exit 1
fi

echo "📌 当前版本号：$CURRENT_VERSION"

# 解析版本号的各个部分
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# 增加 PATCH 版本号
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

echo "🆕 新版本号：$NEW_VERSION"

# 更新 app.config.ts 中的版本号
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" "$APP_CONFIG"

# 更新 versions.ts 中的最新版本号
sed -i "s/latestVersion: '$CURRENT_VERSION'/latestVersion: '$NEW_VERSION'/g" "$VERSIONS_FILE"
sed -i "s/latestVersion: \"$CURRENT_VERSION\"/latestVersion: \"$NEW_VERSION\"/g" "$VERSIONS_FILE"

echo "✅ 版本号已从 $CURRENT_VERSION 更新为 $NEW_VERSION"
echo ""
echo " 更新的文件："
echo "   - $APP_CONFIG"
echo "   - $VERSIONS_FILE"
echo ""
echo "⚠️  请记得："
echo "   1. 提交更改到 Git"
echo "   2. 重新构建 APK"
echo "   3. 上传 APK 到下载链接"
