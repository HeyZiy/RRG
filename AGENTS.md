# AGENTS.md

## 项目概述

这是一个基于 Next.js 的资产分配管理系统，使用 Prisma 作为 ORM，Tailwind CSS 用于样式，Shadcn UI 作为组件库。

## 核心理念：无摩擦用户体验与以用户为中心的设计（关键）

- **零重复录入**：用户绝不应重复输入相同信息。
- **全局便捷性**：核心操作应在应用的任何位置均可即时访问，而非深藏于特定情境菜单中。
- **即时视觉反馈**：用户执行操作时，界面必须即时响应，无需手动刷新页面。依赖全局事件立即热重载关联视图。
- **专业产品命名**：UI 标签命名须严格遵循产品管理（PM）专业术语体系，禁止使用通用化、占位式或口语化名称。标签命名应精准、专业且具备品牌质感，与应用设计体系保持一致。
  特别说明：开发过程中，用户或AI沟通中提及的名称仅为需求描述，不可直接作为最终命名，须基于专业术语体系进行标准化命名优化。
- **产品经理视角**：对于用户的要求，如果不是明确的bug修复指令，可以尝试给出更合理、更符合一般用户使用习惯的方案。**

## 目录结构

```
asset_allocator/
├── prisma/             # Prisma 数据库配置和迁移
├── public/             # 静态资源
├── scripts/            # 自定义脚本
├── src/
│   ├── app/            # Next.js 应用路由
│   │   ├── api/        # API 路由
│   │   ├── layout.tsx  # 应用布局
│   │   └── page.tsx    # 主页
│   ├── components/     # 组件
│   │   └── ui/         # Shadcn UI 组件
│   ├── lib/            # 工具库
│   └── middleware.ts   # 中间件
├── .gitignore
├── package.json
└── tsconfig.json
```

## 技术栈

- **前端框架**: Next.js 16.1.6
- **React**: 19.2.3
- **数据库**: Prisma ORM + PostgreSQL
- **样式**: Tailwind CSS 4
- **组件库**: Shadcn UI
- **表单处理**: React Hook Form + Zod
- **TypeScript**: 5
- **代码检查**: ESLint 9

## 开发流程

1. **环境设置**
   - 确保 Node.js 版本为 20.x
   - 安装依赖：`npm install`
   - 配置环境变量（参考 `.env.example`）

2. **数据库设置**
   - 生成 Prisma 客户端：`npx prisma generate`
   - 运行数据库迁移：`npx prisma migrate dev`
   - 填充种子数据：`npm run seed`

3. **开发模式**
   - 启动开发服务器：`npm run dev`
   - 访问：http://localhost:3000

4. **构建与部署**
   - 构建生产版本：`npm run build`
   - 启动生产服务器：`npm start`

## 常用命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run seed` | 填充种子数据 |
| `npm run sync:assets` | 同步资产元数据 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `npx prisma generate` | 生成 Prisma 客户端 |
| `npx prisma migrate dev` | 运行数据库迁移 |
| `npx prisma studio` | 启动 Prisma Studio |

## 代码规范

1. **TypeScript**
   - 使用严格模式
   - 为所有变量和函数添加类型

2. **ESLint**
   - 遵循项目的 ESLint 配置
   - 提交前运行 `npm run lint` 检查

3. **Git 规范**
   - 提交信息清晰明了
   - 遵循 conventional commits 规范

4. **目录结构**
   - 组件按功能模块化
   - API 路由按资源分类

## AI 助手使用指南

### 快速预览

1. **项目结构**：使用 `LS` 工具查看目录结构
2. **代码文件**：使用 `Read` 工具查看具体文件内容
3. **搜索代码**：使用 `Grep` 或 `SearchCodebase` 工具搜索特定代码
4. **运行命令**：使用 `RunCommand` 工具运行项目命令

### 开发流程约束

1. **环境准备**：在开始开发前，确保运行 `npm install` 安装依赖
2. **数据库操作**：修改数据库模型后，必须运行 `npx prisma migrate dev` 创建迁移
3. **代码检查**：提交代码前，必须运行 `npm run lint` 检查代码质量
4. **构建验证**：在部署前，必须运行 `npm run build` 验证构建是否成功

### 推荐工作流

1. **需求分析**：了解需求，确定修改范围
2. **代码探索**：查看相关文件，理解现有代码
3. **实现修改**：编写代码，确保类型正确
4. **测试验证**：运行开发服务器，测试功能
5. **代码检查**：运行 ESLint，确保代码质量
6. **构建验证**：运行构建命令，确保部署成功

## 注意事项

1. **环境变量**：确保配置正确的数据库连接字符串
2. **数据库迁移**：修改数据库模型后，必须创建并运行迁移
3. **依赖管理**：添加新依赖时，确保版本兼容
4. **安全考虑**：API 路由中添加适当的权限检查
5. **性能优化**：注意数据库查询性能，避免 N+1 查询

## 资源链接

- [Next.js 文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form 文档](https://react-hook-form.com/docs)
- [Zod 文档](https://zod.dev/docs)