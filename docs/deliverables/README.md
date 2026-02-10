# /game 交付物标准（本仓库落地位置）

## 1. 规则文档
- 每玩法规则说明书：`docs/games/*.md`
- 通行规则差异登记： [rules_research.md](file:///f:/C/rules_research.md)

## 2. 测试报告
- 单元测试：`backend/tests/games/*Rules.test.js`（Vitest）
- 联机集成测试：`backend/scripts/game-e2e.mjs`、`backend/scripts/game-scenarios.mjs`
- 一键生成测试报告：`backend/scripts/game-test-report.mjs`
  - 输出：`backend/reports/game-tests/<timestamp>/summary.md`（含 stdout/stderr 日志）

## 3. UI 设计稿（文字版）
- 对局页 UI 动态适配系统说明： [game-ui-adaptation.md](file:///f:/C/docs/ui/game-ui-adaptation.md)
- 各玩法 UI 要点：见对应 `docs/games/<gameCode>.md` 的 “UI 动态适配要点” 章节

## 4. 性能分析报告
- 前端性能基线与已落地优化： [game-frontend-performance.md](file:///f:/C/docs/performance/game-frontend-performance.md)

## 5. 持续集成
- GitHub Actions：`.github/workflows/ci.yml`（后端单测 + 前端构建）

