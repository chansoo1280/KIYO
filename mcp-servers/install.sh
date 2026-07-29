#!/bin/bash
cd /Github/KIYO/mcp-servers
npm install
echo "MCP server installed. Add to Hermes config:"
echo 'mcp_servers:'
echo '  notion-kiyo:'
echo '    command: "node"'
echo '    args: ["/Github/KIYO/mcp-servers/index.js"]'
echo '    env:'
echo '      NOTION_API_KEY: "your-token"'
