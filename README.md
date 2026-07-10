# 暑假作业打卡系统

面向学校小组的图片打卡与统计系统。ROOT 负责全局用户和小组管理，ADMIN 负责组员、规则与提交审核，普通用户通过手机或微信内置浏览器完成图片打卡。

## 运行环境

- Node.js 20.9 或更高版本
- MySQL 8 / MariaDB 10.5 或更高版本
- npm

## 本地启动

1. 安装依赖：

   ```bash
   npm install
   ```

2. 复制 `.env.example` 为 `.env`，并填写数据库连接：

   ```env
   DATABASE_URL="mysql://用户名:密码@127.0.0.1:3306/check_in_system"
   ```

   数据库用户名或密码包含 `@`、`:`、`/` 等字符时，需要先进行 URL 编码。

3. 创建空数据库 `check_in_system`，然后执行迁移并生成 Prisma Client：

   ```bash
   npx prisma migrate deploy
   npm run db:generate
   ```

4. 启动开发服务器：

   ```bash
   npm run dev
   ```

5. 首次打开 `http://localhost:3000`。系统检测到没有 ROOT 时会自动进入初始化页，创建第一个 ROOT 账号。

## 生产部署

构建并启动：

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start
```

建议使用 Nginx 或 Caddy 提供 HTTPS 反向代理，并通过 systemd、PM2 或容器编排保持 Node.js 进程运行。微信内打开时，正式环境应使用可信域名和 HTTPS。

## 图片存储

上传图片保存在 `public/uploads`，数据库只记录文件路径和元数据。部署时必须保证该目录可写且持久化；多实例部署时应共享同一个持久化存储。

当前方案不适合直接部署到 Vercel 等无持久本地文件系统的平台，否则重新部署或实例切换后图片可能丢失。如需使用此类平台，应先将上传逻辑改为对象存储（例如 S3、R2、OSS 或 COS）。

`public/uploads` 中的文件可通过静态 URL 访问。生产环境若需要更严格的图片访问控制，应改用受鉴权的下载接口或私有对象存储。

## 备份与恢复

至少定期备份以下两部分，并保持同一时间点的一致性：

- MySQL/MariaDB 数据库
- `public/uploads` 整个目录

恢复时先还原数据库，再将上传目录恢复到相同路径。升级前建议同时创建一次完整备份。

## 常用命令

```bash
npm run lint          # ESLint 检查
npx tsc --noEmit      # TypeScript 类型检查
npm run build         # 生产构建
npm run db:generate   # 生成 Prisma Client
npm run db:migrate    # 开发环境创建并应用迁移
npx prisma migrate deploy # 生产环境应用已有迁移
```

## 角色说明

- `ROOT`：创建、停用和管理全部用户，分配 ADMIN 与小组，查看全局统计和审计记录。
- `ADMIN`：管理自己的组员和打卡规则，查看提交情况、退回作业，并可作为组员参与打卡。
- `USER`：查看个人任务、上传规定数量的图片、正常打卡或在规则允许时补卡。

表格批量导入仅限 ROOT 使用，支持 `.xlsx` 和 `.csv`，单个文件最大 5MB、最多 100 名用户。请优先在用户管理页下载系统提供的 Excel 模板。
