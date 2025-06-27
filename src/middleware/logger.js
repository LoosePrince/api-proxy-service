const { db } = require('../models/database');

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
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        const responseStatus = res.statusCode;
        
        // 异步记录到数据库
        db.run(
            `INSERT INTO api_logs (method, target_url, ip_address, user_agent, response_status, response_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [method, targetUrl, ipAddress, userAgent, responseStatus, responseTime],
            (err) => {
                if (err) {
                    console.error('记录API调用日志失败:', err);
                }
            }
        );
        
        // 调用原始的end方法
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

// 记录错误日志
const logError = (err, req, res, next) => {
    console.error('服务器错误:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
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
        const ip = req.ip || req.connection.remoteAddress;
        console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    }
    
    next();
};

module.exports = {
    logApiCall,
    logError,
    requestLogger
}; 