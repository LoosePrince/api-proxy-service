# API 中转服务

一个轻量级的 Node.js API 中转服务，专为解决前端跨域请求问题而设计。

> 目前仅为初版，功能不完善

## 项目概述

本项目提供了一个简单而有效的解决方案，帮助开发者绕过浏览器的同源策略限制，支持对第三方 API 进行安全的跨域请求。同时集成了用户反馈系统和后台管理功能。

## 核心功能

### API 中转服务
- ✅ 支持 GET、POST、PUT、DELETE 等 HTTP 方法
- ✅ 自动添加 CORS 头部信息
- ✅ 请求参数透传
- ✅ 响应数据原样返回
- ⚠️ 不支持 WebSocket 等持续连接
- ⚠️ 限制大流量接口访问（单次请求限制）

### 用户界面
- 🏠 **首页**：项目简介和使用说明
- 📝 **反馈表单**：用户意见建议收集
- 🚫 **举报表单**：滥用行为举报系统

### 后台管理
- 👨‍💼 **管理员登录**：基于环境变量的安全认证
- 📊 **流量监控**：API 调用统计和分析
- 📋 **内容管理**：查看和处理用户提交的反馈与举报

## 技术架构

### 后端技术栈
- **Node.js**: 服务端运行环境
- **Express.js**: Web 应用框架
- **SQLite**: 轻量级数据库
- **dotenv**: 环境变量管理
- **cors**: 跨域资源共享处理

### 前端技术栈
- **HTML5 + CSS3**: 页面结构和样式
- **JavaScript (ES6+)**: 交互逻辑
- **Bootstrap**: 响应式 UI 框架

### 数据库设计
```sql
-- 用户反馈表
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100),
    email VARCHAR(255),
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 举报信息表
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_url TEXT,
    reason TEXT,
    description TEXT,
    reporter_email VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API 调用日志表
CREATE TABLE api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method VARCHAR(10),
    target_url TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_status INTEGER,
    response_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 项目结构

```
├── src/
│   ├── controllers/          # 控制器层
│   │   ├── proxyController.js    # API中转逻辑
│   │   ├── feedbackController.js # 反馈处理
│   │   └── adminController.js    # 后台管理
│   ├── middleware/           # 中间件
│   │   ├── auth.js              # 认证中间件
│   │   ├── rateLimit.js         # 流量限制
│   │   └── logger.js            # 日志记录
│   ├── models/              # 数据模型
│   │   └── database.js          # 数据库连接
│   ├── routes/              # 路由定义
│   │   ├── api.js               # API中转路由
│   │   ├── admin.js             # 管理后台路由
│   │   └── public.js            # 公共页面路由
│   └── utils/               # 工具函数
│       ├── validator.js         # 数据验证
│       └── security.js          # 安全相关
├── public/                  # 静态资源
│   ├── css/                    # 样式文件
│   ├── js/                     # 前端脚本
│   ├── index.html              # 首页
│   ├── feedback.html           # 反馈页面
│   └── report.html             # 举报页面
├── views/                   # 后台模板
│   ├── admin/                  # 管理后台页面
│   │   ├── dashboard.ejs       # 仪表板
│   │   ├── feedback.ejs        # 反馈管理
│   │   └── logs.ejs            # 日志查看
│   └── login.ejs               # 登录页面
├── .env.example             # 环境变量示例
├── package.json             # 项目依赖
└── app.js                   # 应用入口
```

## 安装与配置

### 环境要求
- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤
1. 克隆项目到本地
2. 安装依赖包：`npm install`
3. 复制环境变量文件：`cp .env.example .env`
4. 配置环境变量（见下方配置说明）
5. 初始化数据库：`npm run init-db`
6. 启动服务：`npm start`

### 环境变量配置
```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# 数据库配置
DB_PATH=./data/app.db

# 安全配置
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# 限流配置
RATE_LIMIT_WINDOW=15  # 时间窗口（分钟）
RATE_LIMIT_MAX=100    # 最大请求次数
MAX_REQUEST_SIZE=1    # 最大请求大小（MB）
```

## API 使用说明

### 中转接口格式
```
GET/POST/PUT/DELETE /api/proxy?url=<目标URL>
```

### 请求示例
```javascript
// GET 请求
fetch('/api/proxy?url=https://api.example.com/data')
    .then(response => response.json())
    .then(data => console.log(data));

// POST 请求
fetch('/api/proxy?url=https://api.example.com/submit', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        // 请求数据
    })
});
```

### 限制说明
- 单次请求大小限制：1MB
- 请求频率限制：同IP每15分钟最多100次请求
- 不支持文件上传和下载
- 不支持 WebSocket 连接
- 不支持流式数据传输

## 用户界面

### 首页功能
- 项目介绍和使用说明
- API 使用示例和文档
- 快速开始指南

### 反馈系统
**表单字段：**
- 姓名（可选）
- 邮箱地址（可选）
- 反馈内容

### 举报系统
**表单字段：**
- 被举报的 URL
- 举报原因（下拉选择）
- 详细描述
- 举报人邮箱（可选）

## 后台管理

### 登录验证
- 使用环境变量中配置的用户名密码
- Session 管理，支持自动登出
- 防暴力破解保护

### 管理功能
1. **仪表板**
   - API 调用总量统计
   - 今日/本周/本月流量图表
   - 系统状态监控

2. **反馈管理**
   - 查看所有用户反馈
   - 标记处理状态
   - 删除垃圾信息

3. **举报处理**
   - 查看举报列表
   - 处理恶意请求
   - 添加黑名单

4. **日志查看**
   - API 调用详细记录
   - 错误日志分析
   - 性能监控数据

## 安全考虑

### 防护措施
- URL 白名单机制（可选配置）
- 请求大小和频率限制
- XSS 和 CSRF 防护
- SQL 注入防护
- 敏感信息过滤

### 监控告警
- 异常流量检测
- 恶意请求识别
- 系统资源监控
- 自动封禁机制

## 部署建议

### 生产环境
- 使用 PM2 进行进程管理
- 配置 Nginx 反向代理
- 启用 HTTPS 加密传输
- 定期备份数据库
- 配置日志轮转

### 性能优化
- 启用响应压缩
- 设置适当的缓存策略
- 数据库索引优化
- 静态资源 CDN 加速

## 许可证

MIT License

## 支持与反馈

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件
- 使用站内反馈功能

---

**注意：** 本服务仅供学习和开发测试使用，请勿用于商业用途或违法活动。使用时请遵守相关法律法规和目标 API 的使用条款。 