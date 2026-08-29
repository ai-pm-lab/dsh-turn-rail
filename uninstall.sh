#!/usr/bin/env bash
# turn-rail 卸载：从 web profile 移除 bundle 注册并删除插件目录。
set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILES="$DSH_HOME/profiles"
PKG_DIR="$PROFILES/node_modules/@dsh-user"
WEB_PKG="$PROFILES/web/package.json"

if [ -f "$WEB_PKG" ]; then
  node - "$WEB_PKG" <<'NODE'
const fs = require('fs')
const file = process.argv[2]
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
if (pkg.dsh && pkg.dsh.profile && Array.isArray(pkg.dsh.profile.bundles)) {
  pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((b) => b !== '@dsh-user/turn-rail-bundle')
}
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
NODE
fi

rm -rf "$PKG_DIR/turn-rail" "$PKG_DIR/turn-rail-bundle"
echo "已卸载 turn-rail。重启 dsh web 服务后生效。"
