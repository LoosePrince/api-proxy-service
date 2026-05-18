const net = require('net');

// URL验证
const isValidUrl = (string) => {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
};

// 邮箱验证
const isValidEmail = (email) => {
    if (!email) return true; // 邮箱是可选的
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// 验证HTTP方法
const isValidHttpMethod = (method) => {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    return allowedMethods.includes(method.toUpperCase());
};

// 验证反馈数据
const validateFeedback = (data) => {
    const errors = [];
    
    if (!data.message || data.message.trim().length === 0) {
        errors.push('反馈内容不能为空');
    }
    
    if (data.message && data.message.length > 2000) {
        errors.push('反馈内容不能超过2000个字符');
    }
    
    if (data.name && data.name.length > 100) {
        errors.push('姓名不能超过100个字符');
    }
    
    if (data.email && !isValidEmail(data.email)) {
        errors.push('邮箱格式不正确');
    }
    
    if (data.email && data.email.length > 255) {
        errors.push('邮箱地址过长');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// 验证举报数据
const validateReport = (data) => {
    const errors = [];
    
    if (!data.target_url || data.target_url.trim().length === 0) {
        errors.push('被举报的URL不能为空');
    }
    
    if (data.target_url && !isValidUrl(data.target_url)) {
        errors.push('URL格式不正确');
    }
    
    if (!data.reason || data.reason.trim().length === 0) {
        errors.push('举报原因不能为空');
    }
    
    const validReasons = ['spam', 'illegal', 'abuse', 'copyright', 'other'];
    if (data.reason && !validReasons.includes(data.reason)) {
        errors.push('举报原因无效');
    }
    
    if (data.description && data.description.length > 1000) {
        errors.push('描述不能超过1000个字符');
    }
    
    if (data.reporter_email && !isValidEmail(data.reporter_email)) {
        errors.push('举报人邮箱格式不正确');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

const isPrivateHostname = (hostname) => {
    const normalized = hostname.toLowerCase();
    const ipv6Host = normalized.replace(/^\[|\]$/g, '');

    if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
        return true;
    }

    if (net.isIP(ipv6Host) === 4) {
        const parts = ipv6Host.split('.').map(Number);
        return parts[0] === 10 ||
            parts[0] === 127 ||
            (parts[0] === 169 && parts[1] === 254) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            parts[0] === 0;
    }

    if (net.isIP(ipv6Host) === 6) {
        return ipv6Host === '::1' ||
            ipv6Host === '::' ||
            ipv6Host.startsWith('fc') ||
            ipv6Host.startsWith('fd') ||
            ipv6Host.startsWith('fe80:');
    }

    return false;
};

// 验证代理请求
const validateProxyRequest = (data) => {
    const errors = [];
    
    if (!data.url || data.url.trim().length === 0) {
        errors.push('目标URL不能为空');
    }
    
    if (data.url && !isValidUrl(data.url)) {
        errors.push('URL格式不正确');
    }
    
    // 检查是否为本地地址或内网地址
    if (data.url) {
        try {
            const url = new URL(data.url);
            if (isPrivateHostname(url.hostname)) {
                errors.push('不允许访问本地或内网地址');
            }
        } catch (e) {
            errors.push('URL格式不正确');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// 清理HTML标签（防XSS）
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
};

module.exports = {
    isValidUrl,
    isValidEmail,
    isValidHttpMethod,
    isPrivateHostname,
    validateFeedback,
    validateReport,
    validateProxyRequest,
    sanitizeInput
}; 