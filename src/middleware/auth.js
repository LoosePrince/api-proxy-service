const bcrypt = require('bcryptjs');

const DEFAULT_DEVELOPMENT_PASSWORD_HASH = '$2a$12$kI4YXhSL5XAIn31ET5U8XeNloZoYJx/bQhzKtXe8J3Xcl6H97m9A2'; // changeme

function getRequiredAdminPasswordHash() {
    const configuredHash = process.env.ADMIN_PASSWORD_HASH;
    if (configuredHash) {
        return configuredHash;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('生产环境必须配置 ADMIN_PASSWORD_HASH');
    }

    return DEFAULT_DEVELOPMENT_PASSWORD_HASH;
}

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
    const adminPasswordHash = getRequiredAdminPasswordHash();
    
    if (username !== adminUsername) {
        return false;
    }
    
    try {
        const isValid = await bcrypt.compare(password, adminPasswordHash);
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
    generateInitialPasswordHash,
    getRequiredAdminPasswordHash
}; 
