#!/bin/bash
# TodoBoard: start server + cloudflare tunnel

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
  echo "正在安装 cloudflared..."
  brew install cloudflared
fi

# Start the dev server in background
echo "启动 TodoBoard 服务器..."
cd "$(dirname "$0")"
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
sleep 3

# Start cloudflare quick tunnel
echo ""
echo "=============================="
echo "  启动公网隧道..."
echo "  等几秒，下面会出现一个 https://xxx.trycloudflare.com 的地址"
echo "  用手机浏览器打开那个地址就能用了"
echo "=============================="
echo ""
cloudflared tunnel --url http://localhost:3001

# Cleanup when stopped
kill $SERVER_PID 2>/dev/null
