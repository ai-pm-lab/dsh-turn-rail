# Changelog

## [0.2.0] — 2025-08-29

- 面向 GitHub 公开发布的准备：新增公开 README、LICENSE、CHANGELOG
- 新增 `install.sh` / `uninstall.sh` 一键安装与卸载脚本
- 补齐 package.json 元数据（description / keywords / license），声明 `zod` 依赖
- 新增效果截图（收起态、展开态、tooltip、加载动画）

## [0.1.1]

- 加载动画细节调优：距对话窗口右边界 50px → 约100px → 80px → **60px**，下滑深度 40px
- 加载动画收起时停在对话窗口顶部淡出，不再上滑侵入标题栏
- 加载动画改为 iOS 条状 spinner：12 根放射条 + 逐条相位旋转
- 新增加载动画：点击早期记录自动翻页时顶部滑入旋转、完成上滑消失
- 修复贴底时跳转被聊天视图底部跟随拉回：先上移离开底部阈值再平滑滚动
- 投影注册适配 dsh rc.8（`schema` → `stateSchema`、`view` → `wire.view`），导航条恢复显示全部轮次
- 导航条默认可滚动查看全部轮次；用户滚动时暂停跟随；修复顶部 active 高亮

## [0.1.0]

- 初始版本：右侧悬浮轮次导航条（指示线 + 标题 + tooltip 预览 + 点击跳转 + 滚动跟随高亮）
- 服务端 `turn-rail-history` 投影，全量轮次摘要轻量下发
