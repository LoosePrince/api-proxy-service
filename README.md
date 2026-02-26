# API 中转服务

一个轻量级的 Node.js API 中转服务，专为解决前端跨域请求问题而设计。

## 项目概述

本项目提供了一个简单而有效的解决方案，帮助开发者绕过浏览器的同源策略限制，支持对第三方 API 进行安全的跨域请求。同时集成了用户反馈系统和后台管理功能。

## 核心功能

### API 中转服务
- ✅ 支持 GET、POST、PUT、DELETE 等 HTTP 方法
- ✅ 自动添加 CORS 头部信息（允许所有来源）
- ✅ 请求参数透传
- ✅ 响应数据原样返回
- ✅ 基于 IP 的流量限制和突发控制
- ⚠️ 不支持 WebSocket 等持续连接

### 安全防护
- 🔒 **bcrypt 密码加密**：管理员密码强制使用 bcrypt 哈希存储
- 🚫 **自动黑名单**：基于异常行为自动触发临时 IP 黑名单
- 🛡️ **限流控制**：多层级限流策略（API/登录/反馈）
- 🔍 **可疑活动检测**：自动识别并拦截恶意请求
- 📝 **访问统计**：详细的访问日志和统计分析

### 用户界面
- 🏠 **首页**：项目简介和使用说明
- 📝 **反馈表单**：用户意见建议收集
- 🚫 **举报表单**：滥用行为举报系统

### 后台管理
- 👨‍💼 **管理员登录**：基于 bcrypt 的安全认证
- 📊 **流量监控**：API 调用统计和分析
- 📋 **内容管理**：查看和处理用户提交的反馈与举报
- 🚫 **黑名单管理**：查看和管理 IP 黑名单

## 技术架构

### 后端技术栈
- **Node.js**: 服务端运行环境
- **Express.js**: Web 应用框架
- **SQLite**: 轻量级数据库
- **dotenv**: 环境变量管理
- **cors**: 跨域资源共享处理
- **express-rate-limit**: 流量限制
- **bcryptjs**: 密码加密

### 前端技术栈
- **HTML5 + CSS3**: 页面结构和样式
- **JavaScript (ES6+)**: 交互逻辑
- **Bootstrap**: 响应式 UI 框架
- **Chart.js**: 数据可视化

### 数据库设计
```sql
-- 用户反馈表
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100),
    email VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 举报信息表
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_url TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    reporter_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API 调用日志表
CREATE TABLE api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method VARCHAR(10) NOT NULL,
    target_url TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_status INTEGER,
    response_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 黑名单表（支持临时黑名单）
CREATE TABLE blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address VARCHAR(45),
    user_agent_hash VARCHAR(64),
    device_fingerprint VARCHAR(128),
    reason TEXT,
    added_by VARCHAR(50) DEFAULT 'system',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(ip_address, user_agent_hash)
);

-- 访问统计表
CREATE TABLE access_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    hour INTEGER,
    ip_address VARCHAR(45),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    request_count INTEGER DEFAULT 0,
    avg_response_time INTEGER,
    error_count INTEGER DEFAULT 0,
    UNIQUE(date, hour, ip_address, endpoint)
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
│   │   ├── blacklist.js         # 黑名单检查
│   │   └── logger.js            # 日志记录
│   ├── models/              # 数据模型
│   │   └── database.js          # 数据库连接
│   ├── routes/              # 路由定义
│   │   ├── api.js               # API中转路由
│   │   ├── admin.js             # 管理后台路由
│   │   └── public.js            # 公共页面路由
│   └── utils/               # 工具函数
│       ├── validator.js         # 数据验证
│       ├── security.js          # 安全相关
│       ├── blacklist.js         # 黑名单管理
│       └── analytics.js         # 访问统计
├── public/                  # 静态资源
├── scripts/                 # 脚本工具
│   └── generate-password.js     # 密码哈希生成
├── app.js                   # 应用入口
└── package.json
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
```

### 3. 生成管理员密码哈希
```bash
npm run init-password
```
按照提示输入密码，将生成的哈希值复制到 `.env` 文件的 `ADMIN_PASSWORD_HASH` 中。

### 4. 初始化数据库
```bash
npm run init-db
```

### 5. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 环境变量配置
```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 管理员账户
ADMIN_USERNAME=admin
# 管理员密码哈希（使用 npm run init-password 生成）
ADMIN_PASSWORD_HASH=$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 数据库配置
DB_PATH=./data/app.db

# 安全配置
SESSION_SECRET=your_session_secret_change_this_in_production

# 限流配置
RATE_LIMIT_WINDOW=15  # 时间窗口（分钟）
RATE_LIMIT_MAX=100    # 最大请求次数
MAX_REQUEST_SIZE=1    # 最大请求大小（MB）

# 黑名单配置
BLACKLIST_DURATION=3600      # 临时黑名单时长（秒），默认1小时
AUTO_BLACKLIST_THRESHOLD=10  # 自动触发黑名单的失败请求次数
AUTO_BLACKLIST_WINDOW=300    # 自动黑名单检查窗口（秒），默认5分钟
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
- 单次请求大小限制：1MB（可配置）
- 请求频率限制：
  - 普通 API：同 IP 每 15 分钟最多 100 次请求
  - 严格模式：每分钟最多 30 次请求
  - 突发控制：每 10 秒最多 10 次请求
- 登录限制：每 15 分钟最多 5 次尝试
- 不支持文件上传和下载
- 不支持 WebSocket 连接
- 不支持流式数据传输

## 用户界面

### 首页功能
- 项目介绍和使用说明
- API 使用示例和文档
- 快速开始指南
- 在线 API 测试工具

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
- 使用 bcrypt 加密的环境变量密码
- Session 管理，支持自动登出
- 防暴力破解保护（限流）

### 管理功能
1. **仪表板**
   - API 调用总量统计
   - 今日/本周/本月流量图表
   - 系统状态监控
   - 实时访问统计

2. **反馈管理**
   - 查看所有用户反馈
   - 标记处理状态
   - 删除垃圾信息

3. **举报处理**
   - 查看举报列表
   - 处理恶意请求
   - 一键添加到黑名单

4. **黑名单管理**
   - 查看所有黑名单条目
   - 区分永久和临时黑名单
   - 手动移除黑名单
   - 查看自动拦截记录

5. **访问统计**
   - 按时间段统计访问量
   - IP 访问排行
   - 热门端点分析
   - 错误率统计

## 安全防护机制

### 1. 密码安全
- 强制使用 bcrypt 哈希存储
- 盐值 rounds 设置为 12
- 提供密码生成工具脚本

### 2. 流量控制
- 多层限流策略
- 基于 IP 的精准控制
- 可配置的限流参数
- 429 状态码和重试时间提示

### 3. 黑名单系统
- **自动黑名单**：
  - 基于失败请求次数自动触发
  - 可配置的阈值和检查窗口
  - 临时黑名单自动过期
  
- **手动黑名单**：
  - 管理员手动添加
  - 支持永久和临时黑名单
  - 设备指纹识别

### 4. 可疑活动检测
- 自动识别恶意 User-Agent
- 路径遍历攻击检测
- 自动化工具识别
- 自动记录并触发黑名单

### 5. 访问统计
- 详细的访问日志
- 多维度统计分析
- 性能监控
- 错误追踪

## 部署建议

### 生产环境配置
1. 修改 `SESSION_SECRET` 为强随机字符串
2. 使用 `npm run init-password` 生成强密码哈希
3. 配置反向代理（Nginx）
4. 启用 HTTPS
5. 调整限流参数以适应实际流量
6. 定期清理旧日志数据

### Docker 部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 注意事项

**安全提示：**
- 请勿将 `.env` 文件提交到版本控制
- 定期更换管理员密码
- 监控异常访问模式
- 及时更新依赖包

**使用限制：**
- 本服务仅供学习和开发测试使用
- 请勿用于商业用途或违法活动
- 使用时请遵守相关法律法规和目标 API 的使用条款
- 注意保护用户隐私数据

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- ✅ 初始版本发布
- ✅ API 中转核心功能
- ✅ 用户反馈和举报系统
- ✅ 后台管理功能
- ✅ 基于 bcrypt 的安全认证
- ✅ 自动临时黑名单系统
- ✅ 多层级流量限制
- ✅ 访问统计分析
