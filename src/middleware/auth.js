const bcrypt = require('bcryptjs');

// 验证管理员认证
const authenticateAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    
    res.status(401).json({ 
        error: '未授权访问',
        message: '请先登录管理员账户' 
    });
};

// 登录验证 - 强制使用bcrypt
const validateLogin = async (username, password) => {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    
    if (username !== adminUsername) {
        return false;
    }
    
    // 如果没有配置密码哈希，使用默认密码的哈希
    const hashToCompare = adminPasswordHash || '$2a$10$YourDefaultHashHere';
    
    try {
        const isValid = await bcrypt.compare(password, hashToCompare);
        return isValid;
    } catch (error) {
        return false;
    }
};

// 生成密码hash（用于初始化）
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

// 初始化时生成默认密码哈希的辅助函数
const generateInitialPasswordHash = async () => {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = await hashPassword(defaultPassword);
    console.log('=================================================');
    console.log('请设置以下环境变量作为管理员密码哈希：');
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    console.log('=================================================');
    return hash;
};

module.exports = {
    authenticateAdmin,
    validateLogin,
    hashPassword,
    generateInitialPasswordHash
}; 
