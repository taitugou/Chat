# TTG Chat 项目文档

欢迎使用 TTG Chat 项目文档！

## 文档目录

- [项目架构说明](./项目架构说明.md) - 架构分层、关键模块与数据流
- [部署指南](./部署指南.md) - 部署步骤与环境配置
- [配置说明](./配置说明.md) - 需要自行配置的内容清单
- [API 文档](./API文档.md) - REST API / Socket 相关接口说明
- [路由地图](./game-route-map.md) - 前后端主要路由与页面映射

## 专题文档

- 玩法规则与实现（模板 + 明细）：[games/README.md](./games/README.md)
- 玩法模式状态与传统对照：[games/game-modes-audit.md](./games/game-modes-audit.md)
- 性能优化与度量：[performance/game-frontend-performance.md](./performance/game-frontend-performance.md)
- UI 适配建议：[ui/game-ui-adaptation.md](./ui/game-ui-adaptation.md)
- iOS UI 规范（房间/对局模块）：[ui/ios-ui-spec.md](./ui/ios-ui-spec.md)
- 设计语言（Design System）：[ui/design-system-guide.md](./ui/design-system-guide.md)
- 测试系统说明：[tests/game-test-system.md](./tests/game-test-system.md)
- 房间/对局测试用例：[tests/test-cases.md](./tests/test-cases.md)
- 房间/对局测试基线：[tests/test-baseline.md](./tests/test-baseline.md)
- 房间/对局缺陷跟踪：[tests/defect-log.md](./tests/defect-log.md)
- 修复与回归验证报告：[tests/fix-verification.md](./tests/fix-verification.md)
- 自动化脚本片段：[tests/automation-snippets.md](./tests/automation-snippets.md)
- 测试素材（历史文档）：[tests/assets-testkit-history.md](./tests/assets-testkit-history.md)
- 社交交互功能实现报告：[deliverables/social-features-report.md](./deliverables/social-features-report.md)

## 快速开始

1. 阅读 [部署指南](./部署指南.md) 进行环境配置
2. 参考 [配置说明](./配置说明.md) 完成必要配置
3. 查看 [API文档](./API文档.md) 了解接口使用

## 项目结构

```
ttg-chat/
├── frontend/          # 前端Vue应用
├── backend/           # 后端Node.js服务
├── database/          # 数据库脚本
├── nginx/             # Nginx配置
├── docs/              # 项目文档
└── README.md          # 项目说明
```

## 技术支持

如有问题，请查看相关文档或提交Issue。

