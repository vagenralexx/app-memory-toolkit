#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo 'Instale Node.js 24 ou superior.'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
if [ ! -f node_modules/@modelcontextprotocol/server/package.json ]; then
  npm ci --ignore-scripts
fi
exec node src/cli.js wizard "$@"
