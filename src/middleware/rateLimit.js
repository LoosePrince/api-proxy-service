const rateLimit = require('express-rate-limit');

// API中转服务的限流配置
const apiLimiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 默认15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 默认每窗口最多100个请求
    message: {
        error: '请求过于频繁',
        message: '您的请求次数已达到限制，请稍后再试',
        resetTime: new Date(Date.now() + ((parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000))
    },
    standardHeaders: true, // 返回rate limit信息在 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    // 自定义键生成器，基于IP地址
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    },
    // 跳过成功的请求计数（可选）
    skipSuccessfulRequests: false,
    // 跳过失败的请求计数（可选）
    skipFailedRequests: false
});

// 更严格的登录限流
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 每个IP每15分钟最多5次登录尝试
    message: {
        error: '登录尝试过于频繁',
        message: '请15分钟后再试'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    }
});

// 反馈表单限流
const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 每个IP每小时最多10次反馈
    message: {
        error: '反馈提交过于频繁',
        message: '每小时最多提交10次反馈'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    loginLimiter,
    feedbackLimiter
}; 