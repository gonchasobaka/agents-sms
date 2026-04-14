"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
dotenv_1.default.config();
const providers_1 = require("./providers");
let providers = [];
function createMcpServer() {
    const server = new mcp_js_1.McpServer({ name: "mcp-sms-server", version: "1.0.0" });
    // ==========================================================
    // Tool: buy_number
    // ==========================================================
    server.tool("buy_number", "Buy a virtual phone number for receiving SMS from a specific service. Automatically picks the cheapest provider.", {
        service: zod_1.z.string().describe("Service name (e.g. telegram, whatsapp, google, github)"),
        country: zod_1.z.string().default("any").describe("Country code or 'any'"),
        provider: zod_1.z
            .string()
            .optional()
            .describe("Force specific provider: 5sim, sms-activate, onlinesim"),
    }, async ({ service, country, provider: preferredProvider }) => {
        let candidates = [];
        if (preferredProvider) {
            const p = (0, providers_1.getProviderByName)(providers, preferredProvider);
            if (!p) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: `Provider '${preferredProvider}' not found. Available: ${providers.map((p) => p.name).join(", ")}`,
                            }),
                        },
                    ],
                };
            }
            const services = await p.getServices(country);
            const match = services.find((s) => s.service === service);
            candidates = [{ provider: p, price: match?.price_usd ?? 0 }];
        }
        else {
            candidates = await (0, providers_1.findCheapestProvider)(providers, service, country);
            if (candidates.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: `Service '${service}' not available in country '${country}' from any provider.`,
                            }),
                        },
                    ],
                };
            }
        }
        const errors = [];
        for (const { provider: selectedProvider, price: providerCost } of candidates) {
            try {
                const result = await selectedProvider.buyNumber(service, country);
                const actualCost = result.cost_usd > 0 ? result.cost_usd : providerCost;
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                number_id: result.number_id,
                                phone_number: result.phone_number,
                                provider: selectedProvider.name,
                                price_usd: actualCost,
                            }),
                        },
                    ],
                };
            }
            catch (err) {
                errors.push(`${selectedProvider.name}: ${err.message}`);
                continue;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: "All providers failed", details: errors }),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: get_sms
    // ==========================================================
    server.tool("get_sms", "Check for incoming SMS on a purchased number. Poll this until you receive the code.", {
        number_id: zod_1.z.string().describe("Number ID from buy_number"),
        provider: zod_1.z.string().describe("Provider name from buy_number response"),
    }, async ({ number_id, provider: providerName }) => {
        const p = (0, providers_1.getProviderByName)(providers, providerName);
        if (!p) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: `Provider '${providerName}' not found` }),
                    },
                ],
            };
        }
        const result = await p.getSms(number_id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: release_number
    // ==========================================================
    server.tool("release_number", "Cancel/release a purchased number if SMS was not received.", {
        number_id: zod_1.z.string().describe("Number ID to release"),
        provider: zod_1.z.string().describe("Provider name"),
    }, async ({ number_id, provider: providerName }) => {
        const p = (0, providers_1.getProviderByName)(providers, providerName);
        if (!p) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: `Provider '${providerName}' not found` }),
                    },
                ],
            };
        }
        await p.releaseNumber(number_id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ success: true, message: "Number released" }),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: list_services
    // ==========================================================
    server.tool("list_services", "List available SMS services with prices across all providers. Shows the cheapest option for each service.", {
        country: zod_1.z.string().default("any").describe("Country filter"),
        search: zod_1.z.string().optional().describe("Search/filter service name"),
    }, async ({ country, search }) => {
        const allServices = await Promise.allSettled(providers.map((p) => p.getServices(country)));
        const serviceMap = new Map();
        for (let i = 0; i < allServices.length; i++) {
            const result = allServices[i];
            if (result.status !== "fulfilled")
                continue;
            for (const svc of result.value) {
                if (search && !svc.service.toLowerCase().includes(search.toLowerCase())) {
                    continue;
                }
                const existing = serviceMap.get(svc.service);
                if (!existing || svc.price_usd < existing.price_usd) {
                    serviceMap.set(svc.service, {
                        service: svc.service,
                        price_usd: svc.price_usd,
                        provider: svc.provider,
                        count: svc.count,
                    });
                }
            }
        }
        const services = Array.from(serviceMap.values())
            .sort((a, b) => a.service.localeCompare(b.service))
            .slice(0, 50);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ services, total: serviceMap.size }),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: get_provider_balance
    // ==========================================================
    server.tool("get_provider_balance", "Check balance on your SMS provider accounts.", {}, async () => {
        const balances = await Promise.allSettled(providers.map(async (p) => ({ provider: p.name, balance_usd: await p.getBalance() })));
        const result = balances.map((r, i) => r.status === "fulfilled"
            ? r.value
            : { provider: providers[i]?.name, error: r.reason?.message });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: get_balance
    // ==========================================================
    server.tool("get_balance", "Check your current MCP SMS Server account balance. Call this before starting tasks to make sure you have enough funds. If balance is low, use create_invoice to top up.", {}, async () => {
        const apiUrl = process.env.BACKEND_API_URL;
        const apiKey = process.env.MCP_SMS_API_KEY;
        if (!apiUrl || !apiKey) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            error: "BACKEND_API_URL and MCP_SMS_API_KEY must be set in .env",
                        }),
                    },
                ],
            };
        }
        const res = await fetch(`${apiUrl}/balance`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: `API error: ${res.status}` }),
                    },
                ],
            };
        }
        const data = await res.json();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        balance_usd: data.balance_usd,
                        low_balance: data.balance_usd < 1.0,
                        message: data.balance_usd < 1.0
                            ? "Balance is low. Use create_invoice() to top up."
                            : `Balance OK: $${data.balance_usd}`,
                    }),
                },
            ],
        };
    });
    // ==========================================================
    // Tool: create_invoice
    // ==========================================================
    server.tool("create_invoice", "Create a crypto payment invoice to top up your MCP SMS Server balance. Returns a payment URL — open it in a browser or send it to a human. Supports USDT, TON, BTC, ETH via CryptoBot. No KYC.", {
        amount_usd: zod_1.z
            .number()
            .min(1)
            .max(500)
            .describe("Amount to top up in USD (min $1, max $500)"),
        currency: zod_1.z
            .enum(["USDT", "TON", "BTC", "ETH"])
            .default("USDT")
            .describe("Crypto currency to pay with"),
    }, async ({ amount_usd, currency }) => {
        const cryptobotToken = process.env.CRYPTOBOT_TOKEN;
        if (!cryptobotToken) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: "CRYPTOBOT_TOKEN not set in .env" }),
                    },
                ],
            };
        }
        const res = await fetch("https://pay.crypt.bot/api/createInvoice", {
            method: "POST",
            headers: {
                "Crypto-Pay-API-Token": cryptobotToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                asset: currency,
                amount: amount_usd.toFixed(2),
                description: `MCP SMS Server balance top-up — $${amount_usd}`,
                expires_in: 3600,
            }),
        });
        const data = await res.json();
        if (!data.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: "CryptoBot error", details: data.error }),
                    },
                ],
            };
        }
        const invoice = data.result;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        pay_url: invoice.pay_url,
                        amount_usd,
                        currency,
                        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                        instructions: `Open this URL to pay: ${invoice.pay_url} — balance will update automatically after payment.`,
                    }),
                },
            ],
        };
    });
    return server;
}
// ==========================================================
// Start server
// ==========================================================
function createExpressApp() {
    const app = (0, express_1.default)();
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
        }
        next();
    });
    app.use((req, res, next) => {
        if (req.path === "/messages")
            return next();
        express_1.default.json()(req, res, next);
    });
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", providers: providers.map((p) => p.name) });
    });
    const sseTransports = new Map();
    app.get("/sse", async (req, res) => {
        try {
            const transport = new sse_js_1.SSEServerTransport("/messages", res);
            sseTransports.set(transport.sessionId, transport);
            const mcpServer = createMcpServer();
            await mcpServer.connect(transport);
            transport.onclose = () => sseTransports.delete(transport.sessionId);
        }
        catch (err) {
            console.error("[sse] Error:", err.message);
            if (!res.headersSent)
                res.status(500).json({ error: err.message });
        }
    });
    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId || !sseTransports.has(sessionId)) {
            res.status(400).send("Invalid session");
            return;
        }
        const transport = sseTransports.get(sessionId);
        await transport.handlePostMessage(req, res);
    });
    return app;
}
async function main() {
    providers = await (0, providers_1.initProviders)();
    const mode = process.env.TRANSPORT || "stdio";
    if (mode === "sse" || mode === "http") {
        const port = parseInt(process.env.PORT || "3000");
        const app = createExpressApp();
        app.listen(port, () => {
            console.log(`MCP SMS Server (OSS) running on http://localhost:${port}`);
            console.log(`Providers: ${providers.map((p) => p.name).join(", ")}`);
        });
    }
    else {
        const transport = new stdio_js_1.StdioServerTransport();
        await createMcpServer().connect(transport);
        console.error("MCP SMS Server (OSS) started (stdio mode)");
        console.error(`Providers: ${providers.map((p) => p.name).join(", ")}`);
    }
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
