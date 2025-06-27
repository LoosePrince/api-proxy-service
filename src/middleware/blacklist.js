const { checkBlacklist } = require('../utils/blacklist');

// 黑名单检查中间件 - 用于表单提交
const checkBlacklistForForms = async (req, res, next) => {
    try {
        const result = await checkBlacklist(req);
        
        if (result.isBlacklisted) {
            console.log(`🚫 黑名单用户尝试提交表单: ${req.ip}, 原因: ${result.reason}`);
            
            // 假装成功，但实际不保存
            return res.json({
                success: true,
                message: '提交成功，我们会尽快处理！',
                id: Math.floor(Math.random() * 10000) // 假的ID
            });
        }
        
        next();
    } catch (error) {
        console.error('黑名单检查失败:', error);
        // 出错时继续执行，不影响正常用户
        next();
    }
};

// 黑名单检查中间件 - 用于API中转
const checkBlacklistForAPI = async (req, res, next) => {
    try {
        const result = await checkBlacklist(req);
        
        if (result.isBlacklisted) {
            console.log(`🚫 黑名单用户尝试使用API: ${req.ip}, 原因: ${result.reason}`);
            
            // 模拟超时响应
            setTimeout(() => {
                res.status(408).json({
                    error: '请求超时',
                    message: '目标服务器响应超时，请稍后重试',
                    timestamp: new Date().toISOString()
                });
            }, 5000 + Math.random() * 5000); // 5-10秒随机延迟
            
            return; // 不调用next()
        }
        
        next();
    } catch (error) {
        console.error('黑名单检查失败:', error);
        // 出错时继续执行，不影响正常用户
        next();
    }
};

// 记录可疑行为的中间件
const logSuspiciousActivity = async (req, res, next) => {
    try {
        const { checkBlacklist, getClientIP } = require('../utils/blacklist');
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        
        // 检查是否有可疑行为模式
        const suspiciousPatterns = [
            /bot|crawler|spider|scraper/i,
            /automation|selenium|puppeteer/i,
            /hack|exploit|attack/i
        ];
        
        const isSuspicious = suspiciousPatterns.some(pattern => 
            pattern.test(userAgent) || pattern.test(req.path)
        );
        
        if (isSuspicious) {
            console.log(`⚠️ 检测到可疑活动: IP=${ip}, UA=${userAgent.substring(0, 100)}, Path=${req.path}`);
        }
        
        next();
    } catch (error) {
        console.error('可疑活动记录失败:', error);
        next();
    }
};

module.exports = {
    checkBlacklistForForms,
    checkBlacklistForAPI,
    logSuspiciousActivity
}; 