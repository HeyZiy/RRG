# 项目结构评审与改造建议（2026-04-22）

## 评审范围

- 前端页面分层与状态管理
- API 路由组织方式与职责边界
- Prisma 模型与迁移约束
- Electron 与 Next 的联动启动方式
- 文档完整性

## 主要问题

### 1. 主页面承担职责过多

文件：`src/app/page.tsx`

现状：
- 同时负责仪表盘展示、账户管理、交易录入、持仓维护、资产管理、配置编辑、全局汇总等。
- 组件状态与网络请求高度集中，导致可维护性与测试性下降。

风险：
- 回归影响面过大。
- 新需求接入时冲突概率高，开发效率下降。

建议：
- 将页面拆分为“容器 + 领域模块”结构。
- 先抽离 hooks（如 usePortfolioData/useSummary/useAllocationActions），再抽离 UI 子模块。

### 2. API 路由业务逻辑重复，缺少服务层

目录：`src/app/api/*`

现状：
- 参数解析、数据校验、业务规则、Prisma 调用耦合在 route 文件内。
- 各 route 使用风格不完全一致（错误码与错误信息、解析方式）。

风险：
- 规则更新容易出现多处漏改。
- 难以编写稳定的单元测试。

建议：
- 新增 `src/server/services/`（或 `src/lib/services/`）承载领域逻辑。
- route 仅保留协议适配、输入输出和错误映射。
- 引入统一校验层（Zod）与统一错误结构。

### 3. 汇总目标语义有技术债

文件：`src/app/api/summary/targets/route.ts` 与 `src/app/page.tsx`

现状：
- 后端持久化字段为 `targetAmount`，前端汇总页面已改为百分比输入并进行换算。

风险：
- 总盘变化时，目标占比语义会与用户直觉产生偏差。

建议：
- 中期演进为“目标占比优先”的领域模型（例如新增 `targetPercent`），
  在展示层按需要换算金额。

### 4. 生成代码与业务代码共处 src

目录：`src/generated/prisma`

现状：
- Prisma 生成产物放在 `src/generated/prisma`，与业务代码同层。

风险：
- 扩大源码检索噪音。
- 影响代码导航与静态检查体验。

建议：
- 保持当前可运行前提下，后续可迁移到 `generated/prisma`（仓库根目录）或保留但在 README 中明确“只读，不手改”。

### 5. 文档曾明显滞后于实现

现状：
- README 过去是默认模板，与项目实际命令和架构不一致。

建议：
- 保持“功能变更即同步文档”的提交习惯。

## 推荐目标结构（增量演进）

```text
+ src/
+   app/
+     page.tsx                       # 仅保留页面编排
+     api/
+       ...                          # 仅保留协议层
+   features/
+     portfolio/
+       components/
+       hooks/
+       actions/
+       types.ts
+     summary/
+       components/
+       hooks/
+       actions/
+   server/
+     services/
+       account.service.ts
+       allocation.service.ts
+       summary.service.ts
+     validators/
+       account.schema.ts
+       allocation.schema.ts
+   lib/
+     db.ts
+     price-fetcher.ts
+```

## 重构优先级

### P0（本周）
- 拆分 `src/app/page.tsx` 的数据请求与业务动作为 hooks/actions。
- 统一 API 输入校验和错误返回格式。

### P1（下周）
- 抽出服务层并迁移重复业务逻辑。
- 为 allocations/transactions/summary 增加基础集成测试。

### P2（后续）
- 梳理全局目标配置语义（amount vs percent）并完成模型升级。
- 优化 generated 目录位置与工程边界。

## 已完成的结构性改进（近期）

- `AssetAllocation` 增加 `(accountId, assetId)` 唯一约束，避免重复配置。
- allocations 接口支持幂等保存并清理历史重复行。
- 全局汇总已纳入现金分类，组合占比语义更完整。
- Electron 开发模式使用外部 Next Webpack 服务并行启动，提升稳定性。
