const rateLimit = require('express-rate-limit');

// 获取客户端IP
const getClientIP = (req) => {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
};

// API中转服务的限流配置 - 基于IP的细粒度控制
const apiLimiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 默认15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 默认每窗口最多100个请求
    message: {
        error: '请求过于频繁',
        message: '您的请求次数已达到限制，请稍后再试',
        resetTime: new Date(Date.now() + ((parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000)),
        retryAfter: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60
    },
    standardHeaders: true, // 返回rate limit信息在 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    // 自定义键生成器，基于IP地址
    keyGenerator: (req) => {
        return getClientIP(req);
    },
    // 跳过成功的请求计数（可选）
    skipSuccessfulRequests: false,
    // 跳过失败的请求计数（可选）
    skipFailedRequests: false,
    // 请求处理函数
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    },
    // 跳过的条件
    skip: (req) => {
        // 可以在这里添加白名单逻辑
        return false;
    }
});

// 更严格的登录限流
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 每个IP每15分钟最多5次登录尝试
    message: {
        error: '登录尝试过于频繁',
        message: '请15分钟后再试',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIP(req);
    },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

// 反馈表单限流
const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 每个IP每小时最多10次反馈
    message: {
        error: '反馈提交过于频繁',
        message: '每小时最多提交10次反馈',
        retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIP(req);
    },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

// 大流量限制 - 更严格的限流（用于高流量接口）
const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 30, // 每分钟最多30个请求
    message: {
        error: '请求过于频繁',
        message: '该接口限制较严格，请稍后再试',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIP(req);
    },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

// 突发流量控制 - 使用滑动窗口
const burstLimiter = rateLimit({
    windowMs: 10 * 1000, // 10秒窗口
    max: 10, // 每10秒最多10个请求
    message: {
        error: '请求过于频繁',
        message: '检测到突发请求，请放慢速度',
        retryAfter: 10
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIP(req);
    },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

module.exports = {
    apiLimiter,
    loginLimiter,
    feedbackLimiter,
    strictLimiter,
    burstLimiter,
    getClientIP
}; 
