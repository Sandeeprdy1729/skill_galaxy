# SkillGalaxy MCP Server

> **One toggle.** Connect Claude to 200+ curated skill files instantly.

✅ **Status: Verified working** — all 4 tools tested and responding.

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives Claude direct access to the entire SkillGalaxy skills library. Instead of manually downloading `.md` files, Claude can search, browse, and retrieve skills on demand.

## Quick Setup (One Toggle)

### 1. Install dependencies

```bash
cd mcp-server
npm install
npm run build-skills   # converts the skills database
```

### 2. Add to Claude Desktop

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the SkillGalaxy server entry:

```json
{
  "mcpServers": {
    "skillgalaxy": {
      "command": "node",
      "args": ["/FULL/PATH/TO/skill_galaxy/mcp-server/index.js"]
    }
  }
}
```

> **Replace `/FULL/PATH/TO/` with the actual absolute path to your cloned repo.**

> **Tip:** If you already have other MCP servers configured, just add the `"skillgalaxy"` entry inside the existing `"mcpServers"` object.

### 3. Restart Claude Desktop

That's it! Claude now has access to all 200+ skills.

## What Claude Can Do

Once connected, Claude has 4 tools available:

| Tool | Description |
|------|-------------|
| `search_skills` | Search skills by keyword, category, or difficulty |
| `get_skill` | Retrieve the full `.md` skill file for any skill |
| `get_skill_summary` | Get a quick overview of a skill's metadata |
| `list_categories` | Browse all 16 skill categories with counts |

### Example Conversations

**You:** "Find me skills related to cloud security"
**Claude:** *(uses search_skills)* → Shows matching skills with scores and descriptions

**You:** "I need the full LLM Engineering skill"
**Claude:** *(uses get_skill)* → Returns the complete markdown skill file

**You:** "What skill categories are available?"
**Claude:** *(uses list_categories)* → Lists all 16 domains with skill counts

## Skills Library

208 skills across 16 domains:

- **AI & ML** — LLM Engineering, MLOps, AI Safety, Computer Vision, NLP...
- **Cybersecurity** — Cloud Security, Penetration Testing, Threat Modeling...
- **Data Engineering** — Pipeline Design, Data Modeling, Stream Processing...
- **Cloud & Infra** — Kubernetes, Terraform, AWS/GCP Architecture...
- **Development** — System Design, API Design, Performance Engineering...
- **Writing** — Technical Writing, Blog Writing, Documentation...
- **Business** — Product Strategy, Growth Engineering, A/B Testing...
- And 9 more categories...

## How It Works

```
┌──────────────────┐       stdio (JSON-RPC)       ┌──────────────────┐
│   Claude Desktop │ ◄──────────────────────────► │  SkillGalaxy MCP │
│                  │                               │     Server       │
│  "Find AI skills"│  ──── tools/call ──────────► │                  │
│                  │  ◄─── search results ──────  │  208 skills      │
│                  │                               │  16 categories   │
│  "Get that skill"│  ──── tools/call ──────────► │                  │
│                  │  ◄─── full .md content ────  │                  │
└──────────────────┘                               └──────────────────┘
```

The server communicates over **stdio** using the MCP JSON-RPC protocol. Claude Desktop launches it as a subprocess — no ports, no network, no auth needed.

## Verify It Works

### 1. Smoke test (initialize handshake)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js
```

You should see a JSON response with `"serverInfo":{"name":"skillgalaxy","version":"1.0.0"}`.

### 2. Test a tool call (search for skills)

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'; sleep 0.2; echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'; sleep 0.2; echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_skills","arguments":{"query":"cloud security","limit":3}}}'; sleep 0.3; } | node index.js
```

You should see search results with matching skills returned.

### 3. Verify in Claude Desktop

After adding the config and restarting Claude Desktop, look for the **🔨 hammer icon** in the chat input area — it should list the 4 SkillGalaxy tools. Try asking Claude *"Search for AI skills"*.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module skills-data.js` | Run `npm run build-skills` first |
| No hammer icon in Claude Desktop | Double-check the absolute path in config and restart Claude |
| Permission error | Run `chmod +x index.js` |
| Server not responding to tool calls | Use `sleep` delays between messages (see test command above) |

## Development

```bash
# Rebuild skills data after editing js/db.js
npm run build-skills
```

## License

Apache 2.0
