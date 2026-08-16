# turn-rail 永久插件（随服务自启）

动态插件（cordis_define 创建的）只在当前进程存活，服务重启即丢失。这里把它固化到
web profile 里，随 `dsh web` 启动自动加载，不依赖任何会话。

## 组成

| 包 | 作用 |
| --- | --- |
| `turn-rail/` | 客户端插件本体：`client.js` 是手写的浏览器 bundle（`window.__ModuleLoader__.load` 契约，免构建）；`index.js` 是无操作的服务端锚点 |
| `turn-rail-bundle/` | profile bundle：`cordis.patch.yml` 用 `- insert:` 把 turn-rail 行插入 web roster |

## 安装位置（安装脚本做的事）

- `~/.dsh/profiles/node_modules/@dsh-user/turn-rail/`
- `~/.dsh/profiles/node_modules/@dsh-user/turn-rail-bundle/`
- `~/.dsh/profiles/web/package.json` → `dsh.profile.bundles` 追加 `@dsh-user/turn-rail-bundle`

## 重新安装

```bash
cp -R plugins/turn-rail         ~/.dsh/profiles/node_modules/@dsh-user/turn-rail
cp -R plugins/turn-rail-bundle  ~/.dsh/profiles/node_modules/@dsh-user/turn-rail-bundle
# 校验组合树（应出现 turn-rail 行）
node /Users/huangjingyan/deepseek-harness/apps/cli/lib/bin.js --profile web --dump-config | grep turn-rail
# 重启服务生效
```

## 改动 client.js 后

直接覆盖 `~/.dsh/profiles/node_modules/@dsh-user/turn-rail/client.js`，重启服务生效
（bundle rev 是内容哈希，浏览器会自动刷新缓存）。
