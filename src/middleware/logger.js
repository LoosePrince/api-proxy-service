const { db } = require('../models/database');
const { recordAccessStats } = require('../utils/analytics');
const { recordFailure, getClientIP } = require('../utils/blacklist');

// 静态资源路径前缀/后缀，用于过滤非核心请求
const skipPaths = [
    '/css/',
    '/js/',
    '/favicon.ico',
    '/bootstrap',
    '.css',
    '.js',
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot'
];

// 判断是否为核心业务请求
const isCoreRequest = (url) => {
    return url.startsWith('/api/') ||
           url.startsWith('/admin/') ||
           url.startsWith('/public/') ||
           url === '/' ||
           url === '/info' ||
           url === '/health' ||
           url.endsWith('.html');
};

// HTTP 请求日志中间件（统一用于开发/生产）
// 输出风格：报错 / 警告 / 主动信息 + 核心 API 调用
const httpLogger = (req, res, next) => {
    const startTime = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const ip = getClientIP(req);

        const core = isCoreRequest(url);
        const isStatic = skipPaths.some(path => url.includes(path));

        // 只记录：
        // 1. 核心请求（不管成功或失败）
        // 2. 非核心请求中的错误/警告（status >= 400）
        if (!core && !(!isStatic && status >= 400)) {
            return;
        }

        let level = 'INFO';
        if (status >= 500) {
            level = 'ERROR';
        } else if (status >= 400) {
            level = 'WARN';
        }

        const timestamp = new Date().toISOString();
        console.log(
            `[${timestamp}] [${level}] ${method} ${url} ${status} - ${duration}ms - ${ip}`
        );
    });

    next();
};

// 记录API调用日志（写入数据库 + 统计 + 自动黑名单）
const logApiCall = (req, res, next) => {
    const startTime = Date.now();
    
    // 保存原始的res.end方法
    const originalEnd = res.end;
    
    // 重写res.end方法以记录响应时间和状态
    res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;
        const method = req.method;
        const targetUrl = req.query.url || 'unknown';
        const ipAddress = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const responseStatus = res.statusCode;
        
        // 异步记录到数据库
        db.run(
            `INSERT INTO api_logs (method, target_url, ip_address, user_agent, response_status, response_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [method, targetUrl, ipAddress, userAgent, responseStatus, responseTime],
            (err) => {
                if (err) {
                    // 静默处理日志错误，避免影响主流程
                }
            }
        );
        
        // 记录访问统计
        recordAccessStats(req, responseStatus, responseTime).catch(() => {
            // 静默处理统计错误
        });
        
        // 记录失败请求（用于自动黑名单）
        if (responseStatus >= 400) {
            recordFailure(ipAddress, `HTTP ${responseStatus}`).catch(() => {
                // 静默处理
            });
        }
        
        // 调用原始的end方法
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

// 记录错误日志
const logError = (err, req, res, next) => {
    const ip = getClientIP(req);
    
    // 记录失败请求
    recordFailure(ip, err.message || '服务器错误').catch(() => {});
    
    // 继续传递错误给下一个错误处理中间件
    next(err);
};

// 兼容旧的 requestLogger 导出，内部复用 httpLogger
const requestLogger = httpLogger;

module.exports = {
    httpLogger,
    logApiCall,
    logError,
    requestLogger
}; 
