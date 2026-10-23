@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 24 ou superior e abra este arquivo novamente.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=24?0:1)"
if errorlevel 1 (
  echo Esta ferramenta exige Node.js 24 ou superior.
  pause
  exit /b 1
)
if not exist "node_modules\@modelcontextprotocol\server\package.json" (
  echo Instalando dependencias da ferramenta...
  call npm.cmd ci --ignore-scripts
  if errorlevel 1 (
    echo Instalacao nao concluida. Consulte o README.md.
    pause
    exit /b 1
  )
)
node src\cli.js wizard %*
if errorlevel 1 pause
