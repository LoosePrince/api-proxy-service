// 检查请求大小
const checkRequestSize = (maxSizeMB = 1) => {
    return (req, res, next) => {
        const maxSize = maxSizeMB * 1024 * 1024; // 转换为字节
        
        if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
            return res.status(413).json({
                error: '请求体过大',
                message: `请求大小不能超过 ${maxSizeMB}MB`
            });
        }
        
        next();
    };
};

// 检查URL黑名单
const urlBlacklist = [
    'file://',
    'ftp://',
    'gopher://',
    'ldap://',
    'dict://'
];

const isUrlBlacklisted = (url) => {
    const lowerUrl = url.toLowerCase();
    return urlBlacklist.some(blocked => lowerUrl.startsWith(blocked));
};

// 敏感信息过滤
const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i
];

const filterSensitiveHeaders = (headers) => {
    const filtered = { ...headers };
    
    Object.keys(filtered).forEach(key => {
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
            filtered[key] = '[FILTERED]';
        }
    });
    
    return filtered;
};

// 生成随机字符串
const generateRandomString = (length = 32) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
};

// IP地址验证
const isValidIP = (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// 清理和验证用户输入
const sanitizeAndValidate = (input, type = 'string') => {
    if (input === null || input === undefined) {
        return null;
    }
    
    let sanitized = input;
    
    if (typeof input === 'string') {
        // 移除潜在的恶意字符
        sanitized = input
            .replace(/[<>\"'%;()&+]/g, '')
            .trim();
        
        if (type === 'url') {
            try {
                new URL(sanitized);
            } catch (e) {
                throw new Error('无效的URL格式');
            }
        }
    }
    
    return sanitized;
};

// CORS安全检查
const corsSecurityCheck = (origin) => {
    // 如果没有设置允许的源，则拒绝所有跨域请求
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['*'];
    
    if (allowedOrigins.includes('*')) {
        return true;
    }
    
    return allowedOrigins.includes(origin);
};

module.exports = {
    checkRequestSize,
    isUrlBlacklisted,
    filterSensitiveHeaders,
    generateRandomString,
    isValidIP,
    sanitizeAndValidate,
    corsSecurityCheck
}; 