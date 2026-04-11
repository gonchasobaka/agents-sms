import { SmsProvider, ServicePrice } from "../types";
import { FiveSimProvider } from "./fivesim";
import { SmsActivateProvider } from "./smsactivate";
import { OnlineSimProvider } from "./onlinesim";

export async function initProviders(): Promise<SmsProvider[]> {
  const candidates: SmsProvider[] = [];

  if (process.env.FIVESIM_API_KEY) {
    candidates.push(new FiveSimProvider(process.env.FIVESIM_API_KEY));
  }
  if (process.env.SMSACTIVATE_API_KEY) {
    candidates.push(new SmsActivateProvider(process.env.SMSACTIVATE_API_KEY));
  }
  if (process.env.ONLINESIM_API_KEY) {
    candidates.push(new OnlineSimProvider(process.env.ONLINESIM_API_KEY));
  }

  if (candidates.length === 0) {
    throw new Error("No SMS provider API keys configured. Set at least one in .env");
  }

  // Validate each provider by checking balance — filters out invalid API keys
  const validated: SmsProvider[] = [];
  const checks = await Promise.allSettled(
    candidates.map(async (p) => {
      const balance = await p.getBalance();
      return { provider: p, balance };
    })
  );

  for (const result of checks) {
    if (result.status === "fulfilled") {
      validated.push(result.value.provider);
      console.error(
        `[init] ${result.value.provider.name}: OK (balance: $${result.value.balance.toFixed(2)})`
      );
    } else {
      const name = candidates[checks.indexOf(result)]?.name || "unknown";
      console.error(`[init] ${name}: SKIPPED (${result.reason?.message || "auth failed"})`);
    }
  }

  if (validated.length === 0) {
    throw new Error("All provider API keys are invalid. Check your .env file.");
  }

  return validated;
}

export function getProviderByName(
  providers: SmsProvider[],
  name: string
): SmsProvider | undefined {
  return providers.find((p) => p.name === name);
}

export async function findCheapestProvider(
  providers: SmsProvider[],
  service: string,
  country: string
): Promise<{ provider: SmsProvider; price: number }[]> {
  const results = await Promise.allSettled(
    providers.map(async (p) => {
      const services = await p.getServices(country);
      const match = services.find((s) => s.service === service && s.count > 0);
      return match ? { provider: p, price: match.price_usd } : null;
    })
  );

  // Return all candidates sorted by price (cheapest first) for fallback
  const candidates: { provider: SmsProvider; price: number }[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      candidates.push(r.value);
    }
  }
  candidates.sort((a, b) => a.price - b.price);
  return candidates;
}
