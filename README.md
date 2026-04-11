# mcp-sms-server

An MCP (Model Context Protocol) server that lets AI agents buy virtual phone numbers and receive SMS verification codes — autonomously.

**For Agents by Agents.**

## What it does

Your AI agent (Claude, GPT-4, any MCP-compatible client) can:
- Buy a virtual phone number for any service (Telegram, GitHub, WhatsApp, Google, etc.)
- Wait and receive the SMS verification code
- Release the number when done

No human needed. No clicking. Fully programmatic.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/mcp-sms-server
cd mcp-sms-server
npm install
cp .env.example .env
# Add your provider API key(s) to .env
npm run build
```

## Provider API keys

Get an API key from at least one provider and add it to `.env`:

| Provider | Sign up | Typical price |
|----------|---------|---------------|
| [5sim](https://5sim.net) | Free registration | $0.10–$0.50 |
| [SMS-Activate](https://sms-activate.org) | Free registration | $0.10–$1.00 |
| [OnlineSim](https://onlinesim.io) | Free registration | $0.10–$0.80 |

You can add multiple — the server automatically picks the cheapest available option.

## Add to Claude Desktop

```json
{
  "mcpServers": {
    "sms": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-sms-server/dist/index.js"]
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

## Add to Cursor / Windsurf

Same JSON format, added to your MCP settings in the IDE.

## Available tools

| Tool | Description |
|------|-------------|
| `buy_number` | Buy a virtual number for a service. Returns `number_id`, `phone_number`, `provider`, `price_usd` |
| `get_sms` | Check for incoming SMS. Poll until `status: "received"`. Returns `code` |
| `release_number` | Cancel/release a number if no SMS received |
| `list_services` | List all available services with prices |
| `get_provider_balance` | Check remaining balance on your provider accounts |

## Example agent session

```
Agent: "I need to verify a phone for GitHub"

→ buy_number({ service: "github", country: "any" })
← { phone: "+14155552671", number_id: "abc123", provider: "5sim", price_usd: 0.15 }

[Agent enters phone on GitHub...]

→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "waiting" }

// 8 seconds later...
→ get_sms({ number_id: "abc123", provider: "5sim" })
← { status: "received", code: "847291" }

[Agent enters code. Done.]
→ release_number({ number_id: "abc123", provider: "5sim" })
```

## Hosted version

Don't want to manage your own provider keys? Use the hosted version at **[mcp-sms.up.railway.app](https://mcp-sms.up.railway.app)** — top up with crypto, no setup needed.

## License

MIT
