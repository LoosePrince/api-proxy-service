const assert = require('assert');
const { isPrivateHostname, validateProxyRequest, isValidHttpMethod } = require('../src/utils/validator');
const { isUrlBlacklisted } = require('../src/utils/security');
const { validateLogin } = require('../src/middleware/auth');

async function run() {
    assert.strictEqual(isValidHttpMethod('GET'), true);
    assert.strictEqual(isValidHttpMethod('TRACE'), false);

    assert.strictEqual(isPrivateHostname('localhost'), true);
    assert.strictEqual(isPrivateHostname('127.0.0.1'), true);
    assert.strictEqual(isPrivateHostname('10.0.0.1'), true);
    assert.strictEqual(isPrivateHostname('172.16.0.1'), true);
    assert.strictEqual(isPrivateHostname('172.32.0.1'), false);
    assert.strictEqual(isPrivateHostname('192.168.1.1'), true);
    assert.strictEqual(isPrivateHostname('169.254.1.1'), true);
    assert.strictEqual(isPrivateHostname('::1'), true);
    assert.strictEqual(isPrivateHostname('api.example.com'), false);

    assert.strictEqual(validateProxyRequest({ url: 'https://api.example.com/data' }).isValid, true);
    assert.strictEqual(validateProxyRequest({ url: 'http://127.0.0.1/admin' }).isValid, false);
    assert.strictEqual(validateProxyRequest({ url: 'http://172.20.0.1/admin' }).isValid, false);
    assert.strictEqual(validateProxyRequest({ url: 'ftp://example.com/file' }).isValid, false);

    assert.strictEqual(isUrlBlacklisted('file:///etc/passwd'), true);
    assert.strictEqual(isUrlBlacklisted('http://localhost:3000/health'), true);
    assert.strictEqual(isUrlBlacklisted('https://api.example.com/data'), false);

    const previousNodeEnv = process.env.NODE_ENV;
    const previousHash = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.NODE_ENV = 'development';
    assert.strictEqual(await validateLogin('admin', 'changeme'), true);
    assert.strictEqual(await validateLogin('admin', 'wrong-password'), false);
    process.env.NODE_ENV = previousNodeEnv;
    if (previousHash === undefined) {
        delete process.env.ADMIN_PASSWORD_HASH;
    } else {
        process.env.ADMIN_PASSWORD_HASH = previousHash;
    }

    console.log('基础检查通过');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});