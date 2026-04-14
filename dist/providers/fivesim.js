"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiveSimProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = "https://5sim.net/v1";
class FiveSimProvider {
    name = "5sim";
    client;
    constructor(apiKey) {
        this.client = axios_1.default.create({
            baseURL: BASE_URL,
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 30000,
        });
    }
    async buyNumber(service, country) {
        const c = country === "any" ? "any" : country;
        const { data } = await this.client.get(`/user/buy/activation/${c}/any/${service}`);
        return {
            number_id: String(data.id),
            phone_number: data.phone,
            provider: this.name,
            cost_usd: data.price,
        };
    }
    async getSms(numberId) {
        const { data } = await this.client.get(`/user/check/${numberId}`);
        if (data.status === "RECEIVED" && data.sms && data.sms.length > 0) {
            const sms = data.sms[0];
            return {
                status: "received",
                code: sms.code,
                full_text: sms.text,
            };
        }
        if (data.status === "CANCELED") {
            return { status: "cancelled" };
        }
        return { status: "waiting" };
    }
    async releaseNumber(numberId) {
        await this.client.get(`/user/cancel/${numberId}`);
    }
    async getServices(country) {
        const c = country || "any";
        const { data } = await this.client.get(`/guest/products/${c}/any`);
        const results = [];
        for (const [service, info] of Object.entries(data)) {
            if (info.Price !== undefined) {
                results.push({
                    service,
                    country: c,
                    price_usd: info.Price,
                    provider: this.name,
                    count: info.Qty || 0,
                });
            }
        }
        return results;
    }
    async getBalance() {
        const { data } = await this.client.get("/user/profile");
        return data.balance;
    }
}
exports.FiveSimProvider = FiveSimProvider;
