# Asset Allocator

资产配置与交易管理系统，基于 Next.js + Prisma + Electron。

## 技术栈

- Next.js 16 (App Router)
- React 19 + TypeScript 5
- Prisma + SQLite
- Tailwind CSS 4 + shadcn/ui
- Electron 41

## 运行方式

### 1) 纯 Web 开发

```bash
npm run dev
```

### 2) Electron 桌面开发（推荐）

```bash
npm run electron:dev
```

说明：该命令并行启动 Next Webpack 开发服务与 Electron 壳层，避免 Turbopack 在当前环境下的不稳定行为。

### 3) 构建与检查

```bash
npm run lint
npm run build
```

## 关键脚本

- `npm run dev`: Next 开发模式
- `npm run dev:webpack`: 强制 Webpack 的 Next 开发模式
- `npm run electron:only`: 仅启动 Electron（依赖外部 Next 服务）
- `npm run electron:dev`: 并行启动 Next + Electron
- `npm run seed`: 数据库种子
- `npm run sync:assets`: 同步资产元数据
- `npm run build`: Prisma 生成 + 迁移 + Next 构建

## 当前目录结构

```text
asset_allocator/
├─ electron/                 # Electron 主进程与 preload
├─ prisma/                   # Prisma schema 与迁移
├─ scripts/                  # 维护脚本
├─ src/
│  ├─ app/
│  │  ├─ api/                # Route Handlers
│  │  ├─ settings/           # 设置页
│  │  └─ page.tsx            # 当前主页面（后续拆分重点）
│  ├─ components/ui/         # shadcn ui 组件
│  ├─ generated/prisma/      # Prisma 生成产物
│  └─ lib/                   # DB 与行情工具
└─ README.md
```

## 架构状态与后续规划

项目结构审查与改造路线见：

- `docs/PROJECT_STRUCTURE_REVIEW.md`

## 开发约束（推荐）

- API 层只做协议和校验，尽量将复杂业务收敛到服务层。
- 页面状态按领域拆分，避免超大单文件承载所有交互。
- 对关键业务实体（如持仓、配置）优先使用数据库唯一约束兜底。
- 所有新功能应同步补充 README 或 docs 文档。
