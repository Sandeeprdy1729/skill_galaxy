#!/usr/bin/env node
/**
 * SkillGalaxy — One-Click Claude Desktop Setup
 *
 * Automatically detects your OS, finds the Claude Desktop config file,
 * and adds the SkillGalaxy MCP server — no manual editing needed.
 *
 * Usage:
 *   node setup.js            # Auto-detect and configure
 *   node setup.js --check    # Check current status
 *   node setup.js --remove   # Remove SkillGalaxy from Claude Desktop
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/* ── Helpers ─────────────────────────────────────── */
const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN  = '\x1b[36m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';

function log(msg)     { console.log(msg); }
function success(msg) { log(`${GREEN}✔${RESET} ${msg}`); }
function warn(msg)    { log(`${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg)    { log(`${RED}✖${RESET} ${msg}`); }
function info(msg)    { log(`${CYAN}ℹ${RESET} ${msg}`); }

/* ── Detect config path per OS ───────────────────── */
function getConfigPath() {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      return join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function getPlatformName() {
  switch (platform()) {
    case 'darwin': return 'macOS';
    case 'win32':  return 'Windows';
    case 'linux':  return 'Linux';
    default:       return platform();
  }
}

/* ── Main logic ──────────────────────────────────── */
async function run() {
  const args     = process.argv.slice(2);
  const isCheck  = args.includes('--check');
  const isRemove = args.includes('--remove');

  log('');
  log(`${BOLD}🔌 SkillGalaxy — Claude Desktop Setup${RESET}`);
  log(`${DIM}${'─'.repeat(42)}${RESET}`);
  log('');

  const configPath   = getConfigPath();
  const mcpIndexPath = resolve(__dirname, 'index.js');

  info(`Platform:    ${getPlatformName()}`);
  info(`Config path: ${configPath}`);
  info(`MCP server:  ${mcpIndexPath}`);
  log('');

  // Verify the MCP server index.js exists
  if (!existsSync(mcpIndexPath)) {
    fail(`MCP server not found at ${mcpIndexPath}`);
    fail('Run this script from the mcp-server/ directory.');
    process.exit(1);
  }

  // Check if skills-data.js exists (needs build)
  const skillsDataPath = resolve(__dirname, 'skills-data.js');
  if (!existsSync(skillsDataPath)) {
    warn('skills-data.js not found — running build-skills first…');
    const { execSync } = (await import('child_process'));
    try {
      execSync('npm run build-skills', { cwd: __dirname, stdio: 'inherit' });
      success('Skills data built successfully.');
    } catch (_e) {
      fail('Failed to build skills data. Run: npm run build-skills');
      process.exit(1);
    }
  }

  // ── CHECK MODE ──
  if (isCheck) {
    if (!existsSync(configPath)) {
      info('Claude Desktop config file does not exist yet.');
      info('Claude Desktop may not be installed, or has not been configured.');
      return;
    }
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (config.mcpServers?.skillgalaxy) {
        success('SkillGalaxy MCP is configured in Claude Desktop!');
        log(`  ${DIM}Command: ${config.mcpServers.skillgalaxy.command}${RESET}`);
        log(`  ${DIM}Args:    ${JSON.stringify(config.mcpServers.skillgalaxy.args)}${RESET}`);
      } else {
        info('SkillGalaxy MCP is NOT configured in Claude Desktop.');
        info('Run: node setup.js');
      }
    } catch (e) {
      fail(`Error reading config: ${e.message}`);
    }
    return;
  }

  // ── REMOVE MODE ──
  if (isRemove) {
    if (!existsSync(configPath)) {
      info('No config file found — nothing to remove.');
      return;
    }
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (!config.mcpServers?.skillgalaxy) {
        info('SkillGalaxy MCP is not in the config — nothing to remove.');
        return;
      }
      delete config.mcpServers.skillgalaxy;
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      success('Removed SkillGalaxy MCP from Claude Desktop config.');
      warn('Restart Claude Desktop to apply changes.');
    } catch (e) {
      fail(`Error: ${e.message}`);
    }
    return;
  }

  // ── INSTALL MODE ──
  let config = { mcpServers: {} };

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      warn('Existing config file was invalid JSON — creating fresh config.');
      config = { mcpServers: {} };
    }
  } else {
    // Create directory if it doesn't exist
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      info(`Created config directory: ${configDir}`);
    }
  }

  // Check if already configured
  if (config.mcpServers.skillgalaxy) {
    const existing = config.mcpServers.skillgalaxy;
    if (existing.args?.[0] === mcpIndexPath) {
      success('SkillGalaxy MCP is already configured — you\'re all set!');
      log('');
      info('Restart Claude Desktop if you haven\'t already.');
      return;
    }
    warn('Updating existing SkillGalaxy MCP config with correct path…');
  }

  // Write the config
  config.mcpServers.skillgalaxy = {
    command: 'node',
    args: [mcpIndexPath],
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  log('');
  success(`${BOLD}SkillGalaxy MCP added to Claude Desktop!${RESET}`);
  log('');
  log(`  ${GREEN}●${RESET} Claude can now search 10,000+ skills on demand`);
  log(`  ${GREEN}●${RESET} Tools: search_skills, get_skill, list_categories`);
  log(`  ${GREEN}●${RESET} No manual downloads needed`);
  log('');
  warn(`${BOLD}Restart Claude Desktop${RESET} to activate the connection.`);
  log('');
}

// Support top-level await for dynamic import
(async () => {
  try {
    await run();
  } catch (e) {
    fail(`Unexpected error: ${e.message}`);
    process.exit(1);
  }
})();
