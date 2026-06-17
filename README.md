# 民航机务工具借用系统

专业的民航机务工具管理与借用全栈应用，支持机务员、工具管理员、质量员三种角色协同工作。

## 功能特性

### 三种角色
- **机务员**：申请借用工具、归还工具、查看申请记录
- **工具管理员**：工具管理、申请审批、工具发放、调查单管理
- **质量员**：校准确认、校准管理、调查单管理

### 核心功能
- ✅ 工具档案管理（含校准有效期、风险等级）
- ✅ 借用申请单管理（草稿、提交、审批流程）
- ✅ 高风险维修双人确认机制
- ✅ 质量员校准确认（校准过期工具不能借出）
- ✅ 工具发放管理
- ✅ 工具归还管理
- ✅ 缺件自动生成调查单
- ✅ 调查单处理流程
- ✅ 校准记录管理
- ✅ 工作台数据统计

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Ant Design 组件库
- React Router 路由
- Axios HTTP 客户端

### 后端
- Node.js + Express
- TypeScript
- SQLite 数据库
- JWT 身份认证
- bcryptjs 密码加密

### 部署
- Docker + docker-compose
- Nginx 反向代理

## 快速开始

### 本地开发

#### 启动后端
```bash
cd backend
npm install
npm run init-db
npm run dev
```
后端服务运行在 http://localhost:3001

#### 启动前端
```bash
cd frontend
npm install
npm run dev
```
前端服务运行在 http://localhost:5173

### Docker 部署

```bash
docker-compose up -d
```
- 前端访问地址: http://localhost:8080
- 后端API地址: http://localhost:3001

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 机务员 | tech01 | 123456 |
| 工具管理员 | admin01 | 123456 |
| 质量员 | quality01 | 123456 |

## 业务流程

1. **机务员** 创建借用申请单，选择需要的工具
2. 申请单提交后进入**待审批**状态
3. **工具管理员** 审批申请单
4. **高风险维修**需要第二人（机务员）确认工具清单
5. **质量员** 确认所有工具的校准状态（校准过期不能借出）
6. **工具管理员** 发放工具
7. **机务员** 使用完毕后归还工具
8. 归还时如有缺件，系统自动生成**调查单**
9. **管理员/质量员** 处理调查单并关闭

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── app.ts          # 入口文件
│   │   ├── db/             # 数据库相关
│   │   ├── middleware/     # 中间件
│   │   ├── routes/         # 路由
│   │   └── types/          # 类型定义
│   ├── Dockerfile
│   └── package.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 公共组件
│   │   ├── api/            # API接口
│   │   ├── context/        # React Context
│   │   └── utils/          # 工具函数
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml      # Docker编排配置
```
