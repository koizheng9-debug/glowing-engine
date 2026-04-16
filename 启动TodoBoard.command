#!/bin/bash
cd "$(dirname "$0")"

# Install cloudflared if needed
if ! command -v cloudflared &> /dev/null; then
  if command -v brew &> /dev/null; then
    echo "正在安装 cloudflared..."
    brew install cloudflared
  else
    echo "请先安装 Homebrew: https://brew.sh"
    echo "按回车键退出..."
    read
    exit 1
  fi
fi

# Start server
echo "启动 TodoBoard..."
npm run dev:server &
SERVER_PID=$!
sleep 2

# Start tunnel
echo ""
echo "========================================"
echo "  隧道启动中，等几秒..."
echo "  下面会出现一个 https://xxx.trycloudflare.com 地址"
echo "  手机浏览器打开那个地址就能用"
echo "  关闭这个窗口即可停止服务"
echo "========================================"
echo ""
cloudflared tunnel --url http://localhost:3001

kill $SERVER_PID 2>/dev/null
