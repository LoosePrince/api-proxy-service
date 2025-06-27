// 主页JavaScript功能

document.addEventListener('DOMContentLoaded', function() {
    // 初始化
    initializeTestForm();
    initializeSmoothScrolling();
    initializeNavbarActive();
});

// 初始化API测试表单
function initializeTestForm() {
    const testForm = document.getElementById('testForm');
    const testResult = document.getElementById('testResult');
    const testMethod = document.getElementById('testMethod');
    const requestBodyContainer = document.getElementById('requestBodyContainer');
    
    if (!testForm) return;
    
    // 监听方法变化，显示/隐藏请求体输入框
    if (testMethod && requestBodyContainer) {
        testMethod.addEventListener('change', function() {
            const method = this.value;
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                requestBodyContainer.style.display = 'block';
            } else {
                requestBodyContainer.style.display = 'none';
            }
        });
    }
    
    testForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const url = document.getElementById('testUrl').value;
        const method = document.getElementById('testMethod').value;
        const bodyText = document.getElementById('testBody')?.value;
        const submitBtn = testForm.querySelector('button[type="submit"]');
        
        // 显示加载状态
        showLoading(submitBtn, testResult);
        
        try {
            // 构建请求URL
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            
            // 构建请求配置
            const requestConfig = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // 为POST、PUT等方法添加请求体
            if (['POST', 'PUT', 'PATCH'].includes(method) && bodyText) {
                try {
                    // 验证JSON格式
                    JSON.parse(bodyText);
                    requestConfig.body = bodyText;
                } catch (jsonError) {
                    throw new Error('请求体必须是有效的JSON格式');
                }
            }
            
            // 发送测试请求
            const startTime = Date.now();
            const response = await fetch(proxyUrl, requestConfig);
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // 获取响应数据
            let responseData;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }
            
            // 显示结果
            showTestResult(testResult, {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                responseTime: responseTime,
                data: responseData,
                headers: Object.fromEntries(response.headers.entries())
            });
            
        } catch (error) {
            showTestResult(testResult, {
                success: false,
                error: error.message
            });
        } finally {
            hideLoading(submitBtn);
        }
    });
}

// 显示加载状态
function showLoading(button, resultContainer) {
    const originalText = button.innerHTML;
    button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        请求中...
    `;
    button.disabled = true;
    button.dataset.originalText = originalText;
    
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="test-result loading">
                <i class="bi bi-clock"></i> 正在发送请求，请稍候...
            </div>
        `;
    }
}

// 隐藏加载状态
function hideLoading(button) {
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
}

// 显示测试结果
function showTestResult(container, result) {
    if (!container) return;
    
    let html = '';
    
    if (result.success) {
        html = `
            <div class="test-result success">
                <strong>✅ 请求成功</strong><br>
                <strong>状态码:</strong> ${result.status} ${result.statusText}<br>
                <strong>响应时间:</strong> ${result.responseTime}ms<br>
                <strong>响应数据:</strong><br>
                ${JSON.stringify(result.data, null, 2)}
            </div>
        `;
    } else {
        html = `
            <div class="test-result error">
                <strong>❌ 请求失败</strong><br>
                ${result.status ? `<strong>状态码:</strong> ${result.status} ${result.statusText}<br>` : ''}
                <strong>错误信息:</strong> ${result.error || '未知错误'}<br>
                ${result.data ? `<strong>错误详情:</strong><br>${JSON.stringify(result.data, null, 2)}` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.classList.add('fade-in');
}

// 初始化平滑滚动
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// 初始化导航栏激活状态
function initializeNavbarActive() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link[href^="#"]');
    
    function updateActiveNavLink() {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === current) {
                link.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveNavLink);
}

// 获取设备信息
function getDeviceInfo() {
    return {
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine,
        timestamp: Date.now()
    };
}

// 通用表单提交函数
function submitForm(formId, endpoint, successMessage = '提交成功！') {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // 添加设备信息
        data.deviceInfo = getDeviceInfo();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // 显示加载状态
        showLoading(submitBtn);
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showAlert('success', successMessage);
                form.reset();
            } else {
                const errors = result.details ? result.details.join('<br>') : result.error;
                showAlert('danger', `提交失败：${errors}`);
            }
            
        } catch (error) {
            showAlert('danger', `网络错误：${error.message}`);
        } finally {
            hideLoading(submitBtn);
        }
    });
}

// 显示警告信息
function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    alertContainer.innerHTML = alertHtml;
    
    // 自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
}

// 创建警告容器
function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.className = 'fixed-top p-3';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none';
    
    // 让警告框可以点击
    container.addEventListener('click', function() {
        this.style.pointerEvents = 'auto';
    });
    
    document.body.appendChild(container);
    return container;
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 复制到剪贴板
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('success', '已复制到剪贴板');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// 备用复制方法
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showAlert('success', '已复制到剪贴板');
        } else {
            showAlert('warning', '复制失败，请手动复制');
        }
    } catch (err) {
        showAlert('warning', '复制失败，请手动复制');
    }
    
    document.body.removeChild(textArea);
}

// 导出全局函数
window.submitForm = submitForm;
window.showAlert = showAlert;
window.formatDateTime = formatDateTime;
window.copyToClipboard = copyToClipboard; 