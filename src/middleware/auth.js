const bcrypt = require('bcrypt');

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

// 登录验证
const validateLogin = async (username, password) => {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';
    
    console.log('登录验证:', { username, adminUsername, passwordProvided: !!password });
    
    if (username !== adminUsername) {
        console.log('用户名不匹配');
        return false;
    }
    
    // 首先尝试明文比较（开发环境）
    if (password === adminPassword) {
        console.log('明文密码验证成功');
        return true;
    }
    
    // 如果明文比较失败，尝试bcrypt比较（生产环境）
    try {
        const isValid = await bcrypt.compare(password, adminPassword);
        console.log('bcrypt验证结果:', isValid);
        return isValid;
    } catch (error) {
        console.log('bcrypt验证失败:', error.message);
        return false;
    }
};

// 生成密码hash（用于初始化）
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

module.exports = {
    authenticateAdmin,
    validateLogin,
    hashPassword
}; 