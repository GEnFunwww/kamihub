@echo off
chcp 65001 >nul
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

if not exist ".git" (
    echo [1/4] 初始化 git 仓库...
    git init
    git config user.name "CIPHER VAULT"
    git config user.email "vault@local"
    git add .
    git commit -m "CIPHER VAULT 卡密管理系统"
) else (
    echo [1/4] 检测到已有 git 仓库，提交最新改动...
    git add .
    git diff --cached --quiet || git commit -m "update"
)

echo.
echo [2/4] 请输入你的 GitHub 仓库地址
echo       格式如: https://github.com/用户名/仓库名.git
echo.
set /p REPO="仓库地址: "

if "%REPO%"=="" (
    echo [错误] 未输入仓库地址
    pause
    exit /b 1
)

echo.
echo [3/4] 关联远程仓库...
git branch -M main
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    git remote add origin "%REPO%"
) else (
    git remote set-url origin "%REPO%"
)

echo.
echo [4/4] 推送中（首次推送请在弹出的窗口登录 GitHub）...
git push -u origin main
if errorlevel 1 (
    echo.
    echo [错误] 推送失败。常见原因:
    echo   1. 仓库地址填错
    echo   2. 密码处需要填 Personal Access Token 而不是登录密码
    echo      GitHub - Settings - Developer settings - Tokens - 生成勾选 repo 权限
    echo   3. 仓库已存在文件且未允许覆盖 - 可先加 --force 或清空远端仓库
    pause
    exit /b 1
)

echo.
echo ============================================
echo   推送成功！
echo ============================================
echo.
echo 最后一步 - 开启 GitHub Pages:
echo   1. 打开 https://github.com/你的用户名/仓库名/settings/pages
echo   2. Source 选 Deploy from a branch
echo   3. Branch 选 main，目录选 / (root)，保存
echo   4. 1-2 分钟后访问 https://你的用户名.github.io/仓库名/
echo.

where gh >nul 2>nul
if not errorlevel 1 (
    echo 检测到 GitHub CLI，尝试自动开启 Pages...
    for /f "tokens=*" %%a in ('gh api user --jq ".login" 2^>nul') do set GHUSER=%%a
    for /f "tokens=*" %%b in ('git remote get-url origin ^| sed "s/.*github.com[:^/]*\/\([^.]*\).*/\1/"') do set REPONAME=%%b
    gh api "repos/!GHUSER!/!REPONAME!/pages" -X POST -f "source[branch]=main" -f "source[path]=/" >nul 2>nul
    if not errorlevel 1 (
        echo Pages 已开启！稍后访问: https://!GHUSER!.github.io/!REPONAME!/
    ) else (
        echo 自动开启失败，请按上面手动步骤开启（或仓库里已开启）
    )
)

echo.
pause
