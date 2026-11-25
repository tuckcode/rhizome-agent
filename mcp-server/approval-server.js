#!/usr/bin/env node
/**
 * Approval-only MCP server for the Claude Code engine (ADR-0191 step 4).
 *
 * Rhizome starts this as the `rhizome_approval` server and names its one
 * tool in `--permission-prompt-tool`. It is never listed in `--tools`, so
 * the model cannot call it. It exposes no vault tools.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { APPROVE_TOOL, denyReply, handleApprove, permissionToolResult } from './approval-bridge.js'

const server = new Server(
  { name: 'rhizome-approval', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [APPROVE_TOOL] }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  if (name !== APPROVE_TOOL.name) {
    return permissionToolResult(denyReply(`Unknown tool: ${name}`), {})
  }
  return handleApprove(args)
})

function exit() {
  process.exit(0)
}

process.stdin.once('end', exit)
process.stdin.once('close', exit)
process.once('SIGINT', exit)
process.once('SIGTERM', exit)

server.connect(new StdioServerTransport()).catch(() => process.exit(1))
