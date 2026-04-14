"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initProviders = initProviders;
exports.getProviderByName = getProviderByName;
exports.findCheapestProvider = findCheapestProvider;
const fivesim_1 = require("./fivesim");
const smsactivate_1 = require("./smsactivate");
const onlinesim_1 = require("./onlinesim");
async function initProviders() {
    const candidates = [];
    if (process.env.FIVESIM_API_KEY) {
        candidates.push(new fivesim_1.FiveSimProvider(process.env.FIVESIM_API_KEY));
    }
    if (process.env.SMSACTIVATE_API_KEY) {
        candidates.push(new smsactivate_1.SmsActivateProvider(process.env.SMSACTIVATE_API_KEY));
    }
    if (process.env.ONLINESIM_API_KEY) {
        candidates.push(new onlinesim_1.OnlineSimProvider(process.env.ONLINESIM_API_KEY));
    }
    if (candidates.length === 0) {
        throw new Error("No SMS provider API keys configured. Set at least one in .env");
    }
    // Validate each provider by checking balance — filters out invalid API keys
    const validated = [];
    const checks = await Promise.allSettled(candidates.map(async (p) => {
        const balance = await p.getBalance();
        return { provider: p, balance };
    }));
    for (const result of checks) {
        if (result.status === "fulfilled") {
            validated.push(result.value.provider);
            console.error(`[init] ${result.value.provider.name}: OK (balance: $${result.value.balance.toFixed(2)})`);
        }
        else {
            const name = candidates[checks.indexOf(result)]?.name || "unknown";
            console.error(`[init] ${name}: SKIPPED (${result.reason?.message || "auth failed"})`);
        }
    }
    if (validated.length === 0) {
        throw new Error("All provider API keys are invalid. Check your .env file.");
    }
    return validated;
}
function getProviderByName(providers, name) {
    return providers.find((p) => p.name === name);
}
async function findCheapestProvider(providers, service, country) {
    const results = await Promise.allSettled(providers.map(async (p) => {
        const services = await p.getServices(country);
        const match = services.find((s) => s.service === service && s.count > 0);
        return match ? { provider: p, price: match.price_usd } : null;
    }));
    // Return all candidates sorted by price (cheapest first) for fallback
    const candidates = [];
    for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
            candidates.push(r.value);
        }
    }
    candidates.sort((a, b) => a.price - b.price);
    return candidates;
}
