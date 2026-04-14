<div align="center">

<br/>

<h1>📱 agents-sms</h1>

<p><strong>MCP server that gives AI agents the ability to buy phone numbers and receive SMS codes — fully autonomously.</strong></p>

<p>
  <a href="https://mcp-sms-nu.vercel.app"><img src="https://img.shields.io/badge/☁️_Hosted_Version-Free_to_try-6366f1?style=for-the-badge" alt="Hosted"/></a>
  &nbsp;
  <a href="#self-hosting"><img src="https://img.shields.io/badge/Self--host-MIT_License-22c55e?style=for-the-badge" alt="Self-host"/></a>
  &nbsp;
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Compatible-0ea5e9?style=for-the-badge" alt="MCP"/></a>
  &nbsp;
  <a href="https://discord.gg/FeUCmPdd"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/></a>
</p>

<br/>

> **For agents** — no API key juggling, no phone, no human in the loop.<br/>
> **For humans** — one config line and your agent handles SMS verification forever.

<br/>

</div>

---

## How it works

Your agent calls three tools. That's the whole flow:

```
buy_number   →   get_sms   →   release_number
```

**Live example:**

```
→ buy_number({ service: "github", country: "any" })
← { phone: "+14155552671", number_id: "abc123", provider: "5sim", price_usd: 0.15 }

  [agent submits phone on GitHub]

→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "waiting" }

  // ~10 seconds pass

→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "received", code: "847291" }

  [agent enters code → account verified ✓]
```

No human needed. No phone needed. Works while you sleep.

---

## ☁️ Hosted version — easiest way to start

<div align="center">

### **[mcp-sms-nu.vercel.app](https://mcp-sms-nu.vercel.app)**

*Top up with crypto → get API key → add to config → done*

</div>

**Three steps:**

**1.** Top up balance at [mcp-sms-nu.vercel.app](https://mcp-sms-nu.vercel.app) — USDT, TON, BTC, ETH via CryptoBot. No KYC. Any amount.

**2.** Add to your MCP config:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "sms": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp-sms-server-production.up.railway.app/sse"]
    }
  }
}
```

**Cursor / Windsurf** (`.cursor/mcp.json` or `.windsurf/mcp.json`):
```json
{
  "mcpServers": {
    "sms": {
      "url": "https://mcp-sms-server-production.up.railway.app/sse"
    }
  }
}
```

**3.** Ask your agent to buy a number. It just works.

**Pricing:** from ~$0.10 per SMS. Pay as you go, no subscription. Prices reflect real-time provider rates.

---

## 🛠 Tools

| Tool | Description |
|------|-------------|
| `buy_number` | Buy a virtual number for any service (Telegram, GitHub, WhatsApp, Google…) |
| `get_sms` | Poll for incoming SMS — returns code when received |
| `release_number` | Cancel a number and get a refund if no SMS arrived |
| `list_services` | Browse all available services with live prices |
| `get_provider_balance` | *(self-hosted only)* Check your provider account balance |

---

## 💡 What agents use this for

- **Bulk account creation** — register N accounts overnight, agent handles every verification step
- **CI/CD pipelines** — test your own SMS flow without a real SIM card
- **Research automation** — access platforms that require phone verification
- **Personal workflows** — let Claude sign up for services on your behalf

---

## Self-hosting

Want full control? Run it with your own provider API keys.

```bash
git clone https://github.com/gonchasobaka/agents-sms
cd agents-sms
npm install && npm run build
cp .env.example .env
# fill in your provider keys
```

**MCP config (local):**
```json
{
  "mcpServers": {
    "sms": {
      "command": "node",
      "args": ["/absolute/path/to/agents-sms/dist/index.js"]
    }
  }
}
```

**Supported providers** — add at least one API key to `.env`:

| Provider | Sign up |
|----------|---------|
| [5sim.net](https://5sim.net) | Free registration |
| [sms-activate.org](https://sms-activate.org) | Free registration |
| [onlinesim.io](https://onlinesim.io) | Free registration |

Multiple providers = automatic cheapest-first selection with fallback.

---

## Works with

Claude Desktop · Cursor · Windsurf · any MCP-compatible client

---

<div align="center">

**Built for the agentic era.**

[🌐 Hosted version](https://mcp-sms-nu.vercel.app) · [💬 Discord](https://discord.gg/FeUCmPdd) · [🐛 Issues](https://github.com/gonchasobaka/agents-sms/issues)

</div>
