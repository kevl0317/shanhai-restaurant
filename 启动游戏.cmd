@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install Node.js and try again.
  pause
  popd
  exit /b 1
)
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 (
  echo Please update Node.js to version 20 or newer.
  pause
  popd
  exit /b 1
)
node scripts\serve.mjs --open %*
set "gameExit=%ERRORLEVEL%"
if not "%gameExit%"=="0" pause
popd
exit /b %gameExit%
