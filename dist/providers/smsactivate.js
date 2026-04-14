"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsActivateProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = "https://api.sms-activate.org/stubs/handler_api.php";
const BASE_URL_V2 = "https://api.sms-activate.org/v2";
class SmsActivateProvider {
    name = "sms-activate";
    apiKey;
    client;
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = axios_1.default.create({ timeout: 30000 });
    }
    async buyNumber(service, country) {
        const countryCode = country === "any" ? "0" : country;
        const { data } = await this.client.get(BASE_URL, {
            params: {
                api_key: this.apiKey,
                action: "getNumber",
                service,
                country: countryCode,
            },
        });
        const response = typeof data === "string" ? data : String(data);
        if (response.startsWith("ACCESS_NUMBER")) {
            const parts = response.split(":");
            return {
                number_id: parts[1],
                phone_number: parts[2],
                provider: this.name,
                cost_usd: 0, // cost retrieved separately
            };
        }
        throw new Error(`sms-activate buyNumber failed: ${response}`);
    }
    async getSms(numberId) {
        const { data } = await this.client.get(BASE_URL, {
            params: {
                api_key: this.apiKey,
                action: "getStatus",
                id: numberId,
            },
        });
        const response = typeof data === "string" ? data : String(data);
        if (response.startsWith("STATUS_OK")) {
            const code = response.split(":")[1];
            return { status: "received", code, full_text: code };
        }
        if (response === "STATUS_CANCEL") {
            return { status: "cancelled" };
        }
        return { status: "waiting" };
    }
    async releaseNumber(numberId) {
        await this.client.get(BASE_URL, {
            params: {
                api_key: this.apiKey,
                action: "setStatus",
                id: numberId,
                status: 8,
            },
        });
    }
    async getServices(country) {
        const countryCode = country && country !== "any" ? country : "0";
        const { data } = await this.client.get(BASE_URL, {
            params: {
                api_key: this.apiKey,
                action: "getPrices",
                country: countryCode,
            },
        });
        const results = [];
        if (typeof data === "object") {
            for (const [, services] of Object.entries(data)) {
                for (const [service, info] of Object.entries(services)) {
                    results.push({
                        service,
                        country: countryCode,
                        price_usd: info.cost || 0,
                        provider: this.name,
                        count: info.count || 0,
                    });
                }
            }
        }
        return results;
    }
    async getBalance() {
        const { data } = await this.client.get(BASE_URL, {
            params: {
                api_key: this.apiKey,
                action: "getBalance",
            },
        });
        const response = typeof data === "string" ? data : String(data);
        if (response.startsWith("ACCESS_BALANCE")) {
            return parseFloat(response.split(":")[1]);
        }
        return 0;
    }
}
exports.SmsActivateProvider = SmsActivateProvider;
