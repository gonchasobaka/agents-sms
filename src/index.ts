import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

import { SmsProvider } from "./types";
import { initProviders, getProviderByName, findCheapestProvider } from "./providers";

let providers: SmsProvider[] = [];

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "mcp-sms-server", version: "1.0.0" });

  // ==========================================================
  // Tool: buy_number
  // ==========================================================
  server.tool(
    "buy_number",
    "Buy a virtual phone number for receiving SMS from a specific service. Automatically picks the cheapest provider.",
    {
      service: z.string().describe("Service name (e.g. telegram, whatsapp, google, github)"),
      country: z.string().default("any").describe("Country code or 'any'"),
      provider: z
        .string()
        .optional()
        .describe("Force specific provider: 5sim, sms-activate, onlinesim"),
    },
    async ({ service, country, provider: preferredProvider }) => {
      let candidates: { provider: SmsProvider; price: number }[] = [];

      if (preferredProvider) {
        const p = getProviderByName(providers, preferredProvider);
        if (!p) {
          return {
            content: [
              {
                type: "text" as const,
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
      } else {
        candidates = await findCheapestProvider(providers, service, country);
        if (candidates.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Service '${service}' not available in country '${country}' from any provider.`,
                }),
              },
            ],
          };
        }
      }

      const errors: string[] = [];
      for (const { provider: selectedProvider, price: providerCost } of candidates) {
        try {
          const result = await selectedProvider.buyNumber(service, country);
          const actualCost = result.cost_usd > 0 ? result.cost_usd : providerCost;

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  number_id: result.number_id,
                  phone_number: result.phone_number,
                  provider: selectedProvider.name,
                  price_usd: actualCost,
                }),
              },
            ],
          };
        } catch (err: any) {
          errors.push(`${selectedProvider.name}: ${err.message}`);
          continue;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "All providers failed", details: errors }),
          },
        ],
      };
    }
  );

  // ==========================================================
  // Tool: get_sms
  // ==========================================================
  server.tool(
    "get_sms",
    "Check for incoming SMS on a purchased number. Poll this until you receive the code.",
    {
      number_id: z.string().describe("Number ID from buy_number"),
      provider: z.string().describe("Provider name from buy_number response"),
    },
    async ({ number_id, provider: providerName }) => {
      const p = getProviderByName(providers, providerName);
      if (!p) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Provider '${providerName}' not found` }),
            },
          ],
        };
      }

      const result = await p.getSms(number_id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // ==========================================================
  // Tool: release_number
  // ==========================================================
  server.tool(
    "release_number",
    "Cancel/release a purchased number if SMS was not received.",
    {
      number_id: z.string().describe("Number ID to release"),
      provider: z.string().describe("Provider name"),
    },
    async ({ number_id, provider: providerName }) => {
      const p = getProviderByName(providers, providerName);
      if (!p) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Provider '${providerName}' not found` }),
            },
          ],
        };
      }

      await p.releaseNumber(number_id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, message: "Number released" }),
          },
        ],
      };
    }
  );

  // ==========================================================
  // Tool: list_services
  // ==========================================================
  server.tool(
    "list_services",
    "List available SMS services with prices across all providers. Shows the cheapest option for each service.",
    {
      country: z.string().default("any").describe("Country filter"),
      search: z.string().optional().describe("Search/filter service name"),
    },
    async ({ country, search }) => {
      const allServices = await Promise.allSettled(
        providers.map((p) => p.getServices(country))
      );

      const serviceMap = new Map<
        string,
        { service: string; price_usd: number; provider: string; count: number }
      >();

      for (let i = 0; i < allServices.length; i++) {
        const result = allServices[i];
        if (result.status !== "fulfilled") continue;
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
            type: "text" as const,
            text: JSON.stringify({ services, total: serviceMap.size }),
          },
        ],
      };
    }
  );

  // ==========================================================
  // Tool: get_provider_balance
  // ==========================================================
  server.tool(
    "get_provider_balance",
    "Check balance on your SMS provider accounts.",
    {},
    async () => {
      const balances = await Promise.allSettled(
        providers.map(async (p) => ({ provider: p.name, balance_usd: await p.getBalance() }))
      );

      const result = balances.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { provider: providers[i]?.name, error: (r as any).reason?.message }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  return server;
}

// ==========================================================
// Start server
// ==========================================================

function createExpressApp() {
  const app = express();

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
    if (req.path === "/messages") return next();
    express.json()(req, res, next);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", providers: providers.map((p) => p.name) });
  });

  const sseTransports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      sseTransports.set(transport.sessionId, transport);
      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
      transport.onclose = () => sseTransports.delete(transport.sessionId);
    } catch (err: any) {
      console.error("[sse] Error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId || !sseTransports.has(sessionId)) {
      res.status(400).send("Invalid session");
      return;
    }
    const transport = sseTransports.get(sessionId)!;
    await transport.handlePostMessage(req, res);
  });

  return app;
}

async function main() {
  providers = await initProviders();
  const mode = process.env.TRANSPORT || "stdio";

  if (mode === "sse" || mode === "http") {
    const port = parseInt(process.env.PORT || "3000");
    const app = createExpressApp();
    app.listen(port, () => {
      console.log(`MCP SMS Server (OSS) running on http://localhost:${port}`);
      console.log(`Providers: ${providers.map((p) => p.name).join(", ")}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
    console.error("MCP SMS Server (OSS) started (stdio mode)");
    console.error(`Providers: ${providers.map((p) => p.name).join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
