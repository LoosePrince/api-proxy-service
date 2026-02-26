const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const saltRounds = 12;
const envPath = path.join(__dirname, '..', '.env');

// 生成随机SESSION_SECRET
function generateSessionSecret() {
    return crypto.randomBytes(32).toString('hex');
}

// 读取.env文件
function readEnvFile() {
    try {
        if (fs.existsSync(envPath)) {
            return fs.readFileSync(envPath, 'utf8');
        }
    } catch (error) {
        console.error('读取.env文件失败:', error.message);
    }
    return null;
}

// 更新.env文件中的配置项
function updateEnvFile(key, value) {
    let envContent = readEnvFile();
    
    if (!envContent) {
        console.error('未找到.env文件，请手动创建');
        return false;
    }
    
    // 使用正则表达式替换配置项
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(envContent)) {
        // 更新现有配置
        envContent = envContent.replace(regex, newLine);
    } else {
        // 添加新配置
        envContent += `\n${newLine}`;
    }
    
    try {
        fs.writeFileSync(envPath, envContent);
        return true;
    } catch (error) {
        console.error('写入.env文件失败:', error.message);
        return false;
    }
}

// 检查配置项是否存在且已设置
function isEnvConfigured(key) {
    const envContent = readEnvFile();
    if (!envContent) return false;
    
    const regex = new RegExp(`^${key}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (match) {
        const value = match[1].trim();
        // 检查是否有实际值（不是空字符串，也不是占位符）
        return value && 
               value !== '' && 
               !value.includes('your_') && 
               !value.includes('changeme') &&
               !value.includes('xxxxxxxx');
    }
    return false;
}

console.log('==============================================');
console.log('      API 中转服务 - 安全配置初始化工具');
console.log('==============================================\n');

// 检查并更新 SESSION_SECRET
console.log('📋 检查 SESSION_SECRET 配置...');
if (isEnvConfigured('SESSION_SECRET')) {
    console.log('   ✓ SESSION_SECRET 已配置\n');
} else {
    console.log('   ⚠ SESSION_SECRET 未配置或使用了默认值');
    const newSecret = generateSessionSecret();
    if (updateEnvFile('SESSION_SECRET', newSecret)) {
        console.log('   ✓ 已自动生成并更新 SESSION_SECRET\n');
    } else {
        console.log('   ✗ 更新 SESSION_SECRET 失败\n');
    }
}

// 检查并更新 ADMIN_PASSWORD_HASH
console.log('📋 检查 ADMIN_PASSWORD_HASH 配置...');
if (isEnvConfigured('ADMIN_PASSWORD_HASH')) {
    console.log('   ✓ ADMIN_PASSWORD_HASH 已配置');
    console.log('   如需更换密码，请继续操作\n');
} else {
    console.log('   ⚠ ADMIN_PASSWORD_HASH 未配置\n');
}

rl.question('请输入管理员密码（默认: changeme）: ', async (password) => {
    const pwd = password.trim() || 'changeme';
    
    try {
        console.log('\n⏳ 正在生成密码哈希...');
        const hash = await bcrypt.hash(pwd, saltRounds);
        
        console.log('\n----------------------------------------------');
        console.log('密码哈希生成成功！');
        console.log('----------------------------------------------');
        console.log(`\n原始密码: ${pwd}`);
        console.log(`\n哈希值:\n${hash}`);
        
        // 自动更新.env文件
        console.log('\n⏳ 正在更新 .env 文件...');
        if (updateEnvFile('ADMIN_PASSWORD_HASH', hash)) {
            console.log('✓ .env 文件已自动更新！');
        } else {
            console.log('\n⚠ 自动更新 .env 文件失败，请手动添加以下配置：');
            console.log('----------------------------------------------');
            console.log(`ADMIN_PASSWORD_HASH=${hash}`);
            console.log('----------------------------------------------');
        }
        
        // 验证哈希
        const isValid = await bcrypt.compare(pwd, hash);
        console.log(`\n验证测试: ${isValid ? '通过 ✓' : '失败 ✗'}`);
        
        // 显示当前配置状态
        console.log('\n==============================================');
        console.log('            当前安全配置状态');
        console.log('==============================================');
        console.log(`SESSION_SECRET:      ${isEnvConfigured('SESSION_SECRET') ? '✓ 已配置' : '✗ 未配置'}`);
        console.log(`ADMIN_PASSWORD_HASH: ${isEnvConfigured('ADMIN_PASSWORD_HASH') ? '✓ 已配置' : '✗ 未配置'}`);
        console.log('==============================================\n');
        
    } catch (error) {
        console.error('\n✗ 生成哈希时出错:', error);
    }
    
    rl.close();
});
