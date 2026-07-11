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

2. 复制 `.env.example` 为 `.env`，并填写数据库与腾讯云 COS 配置：

   ```env
   DATABASE_URL="mysql://用户名:密码@127.0.0.1:3306/check_in_system"
   TENCENT_COS_SECRET_ID="腾讯云 SecretId"
   TENCENT_COS_SECRET_KEY="腾讯云 SecretKey"
   TENCENT_COS_BUCKET="存储桶名称-APPID"
   TENCENT_COS_REGION="ap-guangzhou"
   NEXT_PUBLIC_CDN_DOMAIN="https://图片访问域名"
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

新图片通过腾讯云 STS 临时凭证从浏览器直接上传到 COS，Next.js 只负责用户鉴权、签发精确到对象键的短期上传权限，以及在上传后校验 COS 对象并写入数据库。长期 SecretId/SecretKey 不会发送到浏览器。

所有新对象保存在 `homework/{用户ID}/{任务ID}/{随机文件名}`。数据库只记录对象键和图片元数据；历史版本中保存在 `public/uploads` 的图片仍保持兼容访问与删除。

COS 存储桶必须配置跨域访问规则，至少允许网站正式域名以及本地开发地址，允许 `PUT`、`POST`、`HEAD` 请求和全部必要请求头。例如：

```text
允许来源：https://example.com、http://localhost:3000、http://127.0.0.1:3000
允许方法：PUT、POST、HEAD
允许请求头：*
暴露响应头：ETag、Content-Length、x-cos-request-id
```

用于签发 STS 的腾讯云身份需要 `sts:GetFederationToken` 权限，且其自身必须具备对目标 `homework/` 路径的 COS 上传权限。临时凭证有效期为 15 分钟，并且每次只允许写入服务端生成的具体对象键。

## 备份与恢复

至少定期备份以下内容，并保持同一时间点的一致性：

- MySQL/MariaDB 数据库
- 腾讯云 COS 存储桶中的 `homework/` 对象
- 如系统由旧版本升级，继续备份 `public/uploads` 中的历史图片

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
