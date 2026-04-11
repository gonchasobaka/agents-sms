<div align="center">

<br/>

```
 ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 █  SMS VERIFICATION  ·  FOR AI AGENTS  █
 ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

# agents-sms · MCP Server

**Your agent buys a number. Receives the code. Continues. No human needed.**

[![MCP](https://img.shields.io/badge/MCP-compatible-6366f1?style=flat-square)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![Providers](https://img.shields.io/badge/providers-5sim%20·%20sms--activate%20·%20onlinesim-0ea5e9?style=flat-square)](#providers)

<br/>

### → [**Use the hosted version — no setup, pay with crypto**](https://mcp-sms-nu.vercel.app) ←

*Top up balance, add one line to your config, done.*

<br/>

</div>

---

## What happens when your agent has this tool

```
Agent: "I need to verify a GitHub account"

→ buy_number({ service: "github", country: "any" })
← { phone: "+14155552671", number_id: "abc123", price_usd: 0.15 }

  [agent enters phone on GitHub...]

→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "waiting" }

  // 9 seconds later

→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "received", code: "847291" }

  [agent enters code. Account created. ✓]
```

No clicking. No waiting. No human in the loop.

---

## Hosted version — zero setup

> **[mcp-sms-nu.vercel.app](https://mcp-sms-nu.vercel.app)**

1. Top up balance with crypto (USDT, TON, BTC, ETH — via CryptoBot, no KYC)
2. Get your API key by email
3. Add to your MCP config:

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

That's it. Works in Claude Desktop, Cursor, Windsurf — any MCP client.

**Prices:** from $0.10 per SMS. Pay as you go. No subscription.

---

## Tools

| Tool | What it does |
|------|-------------|
| `buy_number` | Buy a virtual number for any service. Returns phone number + ID |
| `get_sms` | Poll for incoming SMS. Returns code when received |
| `release_number` | Cancel unused number |
| `list_services` | Browse available services + prices |
| `get_provider_balance` | Check your provider account balance |

---

## Use cases

**Bulk account creation** — agent registers N accounts overnight, handles every SMS step automatically

**CI/CD testing** — test your SMS verification flow in a pipeline without a real phone

**Research & automation** — any workflow that needs phone verification, fully autonomous

**Personal agents** — build Claude workflows that can sign up for services on your behalf

---

## Self-hosting

If you want to run your own instance with your own provider keys:

```bash
git clone https://github.com/gonchasobaka/agents-sms
cd agents-sms
npm install && npm run build
cp .env.example .env   # add your provider API keys
```

**Config file** (`claude_desktop_config.json`):
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

### Providers

Add at least one API key to `.env`. Multiple = automatic cheapest-first selection.

| Provider | Sign up | Notes |
|----------|---------|-------|
| [5sim.net](https://5sim.net) | Free | Best coverage, clean API |
| [sms-activate.org](https://sms-activate.org) | Free | Largest selection |
| [onlinesim.io](https://onlinesim.io) | Free | Good EU coverage |

---

<div align="center">

**Built for the agentic era.**

[Hosted version](https://mcp-sms-nu.vercel.app) · [Issues](https://github.com/gonchasobaka/agents-sms/issues)

</div>
