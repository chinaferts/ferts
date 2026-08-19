#!/bin/bash
# 自动版本号更新脚本
# 每次部署时自动增加 0.1（MINOR 版本）

set -e

echo "🔄 开始更新版本号..."

# 读取当前版本号
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' client/app.config.ts | head -1)
echo "📱 当前版本：$CURRENT_VERSION"

# 解析版本号
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)

# 增加 MINOR 版本，PATCH 重置为 0
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="${MAJOR}.${NEW_MINOR}.0"

echo " 新版本：$NEW_VERSION"

# 更新 client/app.config.ts
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" client/app.config.ts
echo "✅ 已更新 client/app.config.ts"

# 更新 package.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
echo "✅ 已更新 package.json"

# 更新 server/src/routes/versions.ts 中的版本号
if [ -f "server/src/routes/versions.ts" ]; then
  sed -i "s/latestVersion: '$CURRENT_VERSION'/latestVersion: '$NEW_VERSION'/" server/src/routes/versions.ts
  echo "✅ 已更新 server/src/routes/versions.ts"
fi

echo "✨ 版本号更新完成：$CURRENT_VERSION → $NEW_VERSION"
