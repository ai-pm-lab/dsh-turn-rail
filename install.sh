#!/usr/bin/env bash
# turn-rail 一键安装：
#   1. 把 turn-rail 与 turn-rail-bundle 复制进 dsh 的 web profile
#   2. 在 web/package.json 的 dsh.profile.bundles 里注册 bundle（幂等）
# 执行前请先运行过一次 dsh web（让它生成 web profile）。
set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILES="$DSH_HOME/profiles"
PKG_DIR="$PROFILES/node_modules/@dsh-user"
WEB_PKG="$PROFILES/web/package.json"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$WEB_PKG" ]; then
  echo "错误：找不到 $WEB_PKG" >&2
  echo "请先运行一次 dsh web 生成 web profile，再执行本脚本。" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "错误：找不到 node 命令（编辑 package.json 需要 Node.js）。" >&2
  exit 1
fi

mkdir -p "$PKG_DIR"
cp -R "$HERE/turn-rail" "$PKG_DIR/turn-rail"
cp -R "$HERE/turn-rail-bundle" "$PKG_DIR/turn-rail-bundle"

node - "$WEB_PKG" <<'NODE'
const fs = require('fs')
const file = process.argv[2]
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
pkg.dsh = pkg.dsh || {}
pkg.dsh.profile = pkg.dsh.profile || {}
if (!Array.isArray(pkg.dsh.profile.bundles)) pkg.dsh.profile.bundles = []
if (!pkg.dsh.profile.bundles.includes('@dsh-user/turn-rail-bundle')) {
  pkg.dsh.profile.bundles.push('@dsh-user/turn-rail-bundle')
}
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
NODE

echo "安装完成："
echo "  - $PKG_DIR/turn-rail"
echo "  - $PKG_DIR/turn-rail-bundle"
echo "  - $WEB_PKG 已注册 @dsh-user/turn-rail-bundle"
echo "重启 dsh web 服务后生效。"
