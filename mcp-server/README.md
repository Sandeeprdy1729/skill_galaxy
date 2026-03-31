# SkillGalaxy MCP Server v2.0

> **One toggle.** Connect Claude to 10,000+ curated skill files — with Code Mode, Progressive Disclosure, Composable Workflows, Generative UI, Security Scanning, and Binary Ingestion.

✅ **Status: Verified working** — all 9 tools tested and responding.

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives Claude direct access to the entire SkillGalaxy skills library. Instead of manually downloading `.md` files, Claude can search, browse, compose, visualise, and orchestrate skills on demand.

## What's New in v2.0

| Feature | Description |
|---------|-------------|
| **Code Mode** | Execute multi-step skill pipelines server-side, reducing context tokens by ~37% |
| **Progressive Disclosure** | 3-level loading: L1 metadata → L2 full body → L3 deep docs with related skills |
| **Composable Workflows** | Chain skills into workflows with reflection and self-improvement |
| **Generative UI** | Generate Mermaid diagrams, comparison tables, learning paths, and dashboards |
| **Security Scanning** | Input sanitisation (SSN, credit card, injection blocking), rate limiting, audit logging |
| **Binary Ingestion** | Process PDFs, images, CSVs, and spreadsheets natively within MCP tools |

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

That's it! Claude now has access to all 10,000+ skills.

## Tools Reference

Once connected, Claude has **9 tools** available:

### Progressive Disclosure (3-Level Loading)

| Tool | Level | Description |
|------|-------|-------------|
| `search_skills` | L1 | Search by keyword/category/difficulty — returns metadata only |
| `get_skill` | L2 | Load the full markdown body of a specific skill |
| `get_skill_deep` | L3 | Full body + related skills + cross-references |
| `get_skill_summary` | L1 | Structured metadata table without markdown |
| `list_categories` | — | Browse all 16 categories with counts |

### Advanced Tools

| Tool | Description |
|------|-------------|
| `execute_skill_code` | **Code Mode** — Run JavaScript pipelines server-side using `api.*` calls |
| `compose_skills` | Chain skills into workflows with optional reflection step |
| `generate_visual` | Create Mermaid diagrams, tables, learning paths, dashboards |
| `ingest_file` | Process PDFs, CSVs, XLSX, images, and text files |

### Example Conversations

**You:** "Find me skills related to cloud security"
**Claude:** *(uses search_skills L1)* → Shows matching skills with metadata only

**You:** "Load the full Kubernetes skill"
**Claude:** *(uses get_skill L2)* → Returns the complete markdown skill file

**You:** "Show me a learning path for the AI category"
**Claude:** *(uses generate_visual)* → Produces a Mermaid flowchart with difficulty progression

**You:** "Compare argocd-deployment with aws-rds"
**Claude:** *(uses generate_visual comparison_table)* → Side-by-side comparison table

**You:** "Run a pipeline: find the top 5 security skills by demand and extract their tools"
**Claude:** *(uses execute_skill_code)* → Executes server-side, returns structured results

### Code Mode API Reference

The `execute_skill_code` tool runs JavaScript server-side with these functions:

```javascript
api.search(query, {category?, difficulty?, limit?})  // Search skills
api.getSkill(id)                                      // Get full skill content
api.getSkills([id1, id2, ...])                        // Get multiple skills
api.categories()                                      // List all categories
api.related(id, limit?)                               // Find related skills
api.countBy(field)                                    // Aggregate by field
api.query(filterFn, mapFn)                            // Filter and map all skills
```

Example:
```javascript
const top = api.search('kubernetes', {category: 'cloud', limit: 5});
const tools = top.flatMap(s => api.getSkill(s.id)?.tools || []);
return { count: top.length, allTools: [...new Set(tools)] };
```

## Skills Library

10,000+ skills across 16 domains:

- **AI & ML** — LLM Engineering, MLOps, AI Safety, Computer Vision, NLP, Agentic AI...
- **Cybersecurity** — Cloud Security, Penetration Testing, Threat Modeling, AI Governance...
- **Data Engineering** — Pipeline Design, Data Modeling, Stream Processing...
- **Cloud & Infra** — Kubernetes, Terraform, AWS/GCP Architecture, ArgoCD...
- **Development** — System Design, API Design, MCP Server Development, SaaS Integration...
- **Business** — Salesforce, HubSpot, Revenue Operations, MarTech, ERP...
- **Writing** — Technical Writing, Blog Writing, Documentation...
- And 9 more categories...

## Architecture

```
┌──────────────────┐       stdio (JSON-RPC)       ┌──────────────────────────┐
│   Claude Desktop │ ◄──────────────────────────► │  SkillGalaxy MCP v2.0    │
│                  │                               │                          │
│  search_skills   │  ──── L1 metadata ────────► │  Security Layer           │
│  get_skill       │  ◄─── L2 full body ───────  │  ├─ Input sanitisation    │
│  get_skill_deep  │  ◄─── L3 deep docs ───────  │  ├─ Rate limiting         │
│  execute_code    │  ──── server-side exec ───► │  └─ Audit logging          │
│  compose_skills  │  ──── workflow chain ─────► │                          │
│  generate_visual │  ◄─── Mermaid/tables ─────  │  10,000+ skills           │
│  ingest_file     │  ──── binary parse ───────► │  16 categories            │
└──────────────────┘                               └──────────────────────────┘
```

## Verify It Works

### 1. Smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js
```

You should see `"serverInfo":{"name":"skillgalaxy","version":"2.0.0"}`.

### 2. Test tools/list

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'; sleep 0.2; echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'; sleep 0.2; echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; sleep 0.3; } | node index.js
```

Should list all 9 tools.

### 3. Test Code Mode

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'; sleep 0.2; echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'; sleep 0.2; echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute_skill_code","arguments":{"code":"return api.categories().slice(0,3);"}}}'; sleep 0.3; } | node index.js
```

### 4. Verify in Claude Desktop

After adding the config and restarting Claude Desktop, look for the **🔨 hammer icon** — it should list all 9 SkillGalaxy tools.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module skills-data.js` | Run `npm run build-skills` first |
| No hammer icon in Claude Desktop | Double-check the absolute path in config and restart Claude |
| Permission error | Run `chmod +x index.js` |
| Server not responding to tool calls | Use `sleep` delays between messages (see test command above) |

## Streamable HTTP Transport

For remote clients, web agents, or multi-tenant deployments, use the HTTP transport instead of stdio:

```bash
npm run start:http                      # http://localhost:3100/mcp
PORT=8080 npm run start:http            # custom port
MCP_API_KEY=your-secret npm run start:http  # enable bearer auth
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Send JSON-RPC messages (initialize, tool calls) |
| `/mcp` | GET | SSE stream for server-initiated messages |
| `/mcp` | DELETE | Close a session |
| `/health` | GET | Server status, skill count, active sessions |
| `/audit` | GET | Last 100 audit log entries |

### Session Flow

```bash
# 1. Initialize — get session ID from response header
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"client","version":"1.0"}}}'
# Response includes: mcp-session-id header

# 2. Confirm initialized
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <your-session-id>" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. Call tools
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <your-session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_skills","arguments":{"query":"kubernetes","limit":3}}}'
```

### Bearer Auth

Set `MCP_API_KEY` to require authentication. All `/mcp` requests must include:

```
Authorization: Bearer <your-api-key>
```

Unauthenticated requests receive `401 Unauthorized` with a `WWW-Authenticate` header.

## Development

```bash
# Rebuild skills data after editing js/db.js
npm run build-skills
```

## License

Apache 2.0
