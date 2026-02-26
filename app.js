const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { initializeDatabase } = require('./src/models/database');
const { logError, requestLogger } = require('./src/middleware/logger');

// 加载环境变量
require('dotenv').config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS配置
app.use(cors({
    origin: function(origin, callback) {
        // 允许所有来源（生产环境中应该限制）
        callback(null, true);
    },
    credentials: true
}));

// 压缩响应
app.use(compression());

// 请求日志
if (process.env.NODE_ENV !== 'production') {
    app.use(requestLogger);
} else {
    app.use(morgan('combined'));
}

// 解析请求体
app.use(express.json({ limit: `${process.env.MAX_REQUEST_SIZE || 1}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${process.env.MAX_REQUEST_SIZE || 1}mb` }));

// Session配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// 设置信任代理（如果使用反向代理）
app.set('trust proxy', 1);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 静态资源配置
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Bootstrap 相关静态资源
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use('/bootstrap-icons', express.static(path.join(__dirname, 'node_modules', 'bootstrap-icons', 'font')));

// 路由
const apiRoutes = require('./src/routes/api');
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');

app.use('/api', apiRoutes);
app.use('/public', publicRoutes);
app.use('/admin', adminRoutes);

// 根路径重定向到首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API信息端点
app.get('/info', (req, res) => {
    res.json({
        name: 'API中转服务',
        version: '1.0.0',
        description: '一个轻量级的 Node.js API 中转服务',
        author: 'Your Name',
        endpoints: {
            api: '/api',
            admin: '/admin',
            public: '/public'
        },
        documentation: {
            homepage: '/',
            feedback: '/feedback.html',
            report: '/report.html'
        },
        limits: {
            requestSize: `${process.env.MAX_REQUEST_SIZE || 1}MB`,
            rateLimit: `${process.env.RATE_LIMIT_MAX || 100} 请求每 ${process.env.RATE_LIMIT_WINDOW || 15} 分钟`
        }
    });
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404处理
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        // API路径返回JSON错误
        res.status(404).json({
            error: '接口未找到',
            message: `路径 ${req.path} 不存在`,
            timestamp: new Date().toISOString()
        });
    } else {
        // 其他路径返回404页面或重定向到首页
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// 全局错误处理
app.use(logError);
app.use((err, req, res, next) => {
    console.error('全局错误处理:', err);
    
    // 不泄露错误详情到生产环境
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.startsWith('/public/')) {
        // API路径返回JSON错误
        res.status(err.status || 500).json({
            error: '服务器内部错误',
            message: isDevelopment ? err.message : '服务暂时不可用，请稍后重试',
            timestamp: new Date().toISOString(),
            ...(isDevelopment && { stack: err.stack })
        });
    } else {
        // 其他路径返回错误页面
        res.status(err.status || 500).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// 优雅关闭处理
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
    console.log(`\n收到 ${signal} 信号，开始优雅关闭...`);
    
    server.close(() => {
        console.log('HTTP 服务器已关闭');
        
        // 关闭数据库连接
        const { closeDatabase } = require('./src/models/database');
        closeDatabase().then(() => {
            console.log('数据库连接已关闭');
            process.exit(0);
        }).catch(err => {
            console.error('关闭数据库连接时出错:', err);
            process.exit(1);
        });
    });
    
    // 强制退出超时
    setTimeout(() => {
        console.error('强制退出');
        process.exit(1);
    }, 10000);
}

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        console.log('正在初始化数据库...');
        await initializeDatabase();
        console.log('数据库初始化完成');
        
        // 启动HTTP服务器
        const server = app.listen(PORT, () => {
            console.log(`
🚀 API中转服务已启动！

📍 服务地址: http://localhost:${PORT}
🏠 首页: http://localhost:${PORT}
📊 API信息: http://localhost:${PORT}/info
❤️ 健康检查: http://localhost:${PORT}/health

🔧 环境: ${process.env.NODE_ENV || 'development'}
💾 数据库: ${process.env.DB_PATH || './data/app.db'}

开始使用 API 中转服务吧！ 🎉
            `);
        });
        
        // 将server设为全局变量以便优雅关闭
        global.server = server;
        
        return server;
        
    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
    startServer();
}

module.exports = app; 