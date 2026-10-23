@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   CIPHER VAULT - 一键推送到 GitHub
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 git，请先安装: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM ---- 确保 git 身份配置（项目级，不动全局） ----
git config user.name >nul 2>nul
if errorlevel 1 git config user.name "CIPHER VAULT"
git config user.email >nul 2>nul
if errorlevel 1 git config user.email "vault@local"

REM ---- 1. 初始化 + 提交 ----
if not exist ".git" (
    echo [1/3] 初始化 git 仓库...
    git init -q
    git branch -M main
) else (
    echo [1/3] 使用已有 git 仓库
)
git add -A
git diff --cached --quiet >nul 2>nul
if errorlevel 1 (
    git commit -q -m "CIPHER VAULT card key manager"
    echo       已提交最新改动
) else (
    echo       没有新改动，跳过提交
)

REM ---- 2. 输入仓库地址 ----
echo.
echo [2/3] 请输入你的 GitHub 仓库地址
echo       格式: https://github.com/用户名/仓库名.git
echo       先在 GitHub 网页建好空仓库（不要勾选初始化 README）
echo.
set "REPO="
set /p REPO="仓库地址: "
if "!REPO!"=="" (
    echo [错误] 未输入仓库地址
    pause
    exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    git remote add origin "!REPO!"
) else (
    git remote set-url origin "!REPO!"
)

REM ---- 3. 推送 ----
echo.
echo [3/3] 推送中... 首次推送会弹出 GitHub 登录窗口
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo ============================================
    echo   推送失败，排查清单：
    echo ============================================
    echo   1. 仓库地址输错 - 确认是你自己的仓库
    echo   2. 登录窗口密码处要填 Personal Access Token
    echo      （不是账号密码！）
    echo      GitHub - Settings - Developer settings -
    echo      Tokens classic - Generate - 勾选 repo
    echo   3. 远端仓库非空 - 建仓库时取消勾选
    echo      "Add a README file"
    echo   4. 网络/代理问题 - 稍后重试
    echo ============================================
    pause
    exit /b 1
)

echo.
echo ============================================
echo   推送成功！
echo ============================================
echo.
echo 开启 GitHub Pages（二选一）：
echo.
echo   手动方式（1 分钟）：
echo     1. 浏览器打开你的仓库页面
echo     2. Settings - Pages
echo     3. Source 选 Deploy from a branch
echo     4. Branch 选 main，Folder 选 / root，Save
echo     5. 等 1-2 分钟，访问
echo        https://用户名.github.io/仓库名/
echo.

where gh >nul 2>nul
if not errorlevel 1 (
    choice /c YN /m "检测到 GitHub CLI，是否自动开启 Pages"
    if not errorlevel 2 (
        gh api "repos/{owner}/{repo}/pages" -X POST -f "source[branch]=main" -f "source[path]=/" >nul 2>nul
        if not errorlevel 1 (
            echo.
            for /f "tokens=*" %%u in ('gh api "repos/{owner}/{repo}/pages" --jq ".html_url" 2^>nul') do echo Pages 已开启，网站地址: %%u
        ) else (
            echo 自动开启失败（可能已开启过），请用手动方式
        )
    )
)

echo.
pause
