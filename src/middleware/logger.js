const { db } = require('../models/database');
const { recordAccessStats } = require('../utils/analytics');
const { recordFailure, getClientIP } = require('../utils/blacklist');

// 记录API调用日志
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

// 请求日志中间件（开发环境）
const requestLogger = (req, res, next) => {
    const url = req.url;
    const method = req.method;
    
    // 过滤掉不需要记录的请求
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
    
    // 只记录重要的请求（API调用、页面访问）
    const shouldLog = !skipPaths.some(path => url.includes(path)) && 
                     (url.startsWith('/api/') || 
                      url.startsWith('/admin/') || 
                      url.startsWith('/public/') ||
                      url === '/' ||
                      url === '/info' ||
                      url === '/health' ||
                      url.endsWith('.html'));
    
    if (shouldLog) {
        const timestamp = new Date().toISOString();
        const ip = getClientIP(req);
        console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    }
    
    next();
};

module.exports = {
    logApiCall,
    logError,
    requestLogger
}; 
