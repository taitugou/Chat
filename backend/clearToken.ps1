# 清除旧token并重新登录

Write-Host "=== 清除旧token并重新登录 ===" -ForegroundColor Green
Write-Host ""

# 1. 清除localStorage中的旧token
Write-Host "1. 清除localStorage中的旧token..." -ForegroundColor Yellow
Write-Host "   请在浏览器控制台执行以下命令：" -ForegroundColor Cyan
Write-Host "   localStorage.removeItem('token');" -ForegroundColor White
Write-Host "   localStorage.removeItem('user');" -ForegroundColor White
Write-Host ""

# 2. 重新登录
Write-Host "2. 然后重新登录系统" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== 问题原因 ===" -ForegroundColor Green
Write-Host "前端使用的是localStorage中缓存的旧token，" -ForegroundColor White
Write-Host "这个旧token对应的用户可能已经不存在或状态异常。" -ForegroundColor White
Write-Host ""

Write-Host "=== 解决方案 ===" -ForegroundColor Green
Write-Host "1. 打开浏览器开发者工具（F12）" -ForegroundColor White
Write-Host "2. 切换到Console标签" -ForegroundColor White
Write-Host "3. 执行以下命令清除旧token：" -ForegroundColor White
Write-Host "   localStorage.removeItem('token');" -ForegroundColor Cyan
Write-Host "   localStorage.removeItem('user');" -ForegroundColor Cyan
Write-Host "4. 刷新页面" -ForegroundColor White
Write-Host "5. 重新登录" -ForegroundColor White
Write-Host ""

Write-Host "=== 测试 ===" -ForegroundColor Green
Write-Host "清除token后，前端会要求重新登录，" -ForegroundColor White
Write-Host "登录成功后，积分页面应该可以正常显示数据。" -ForegroundColor White
Write-Host ""
