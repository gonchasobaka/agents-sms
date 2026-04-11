import axios, { AxiosInstance } from "axios";
import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";

const BASE_URL = "https://api.sms-activate.org/stubs/handler_api.php";
const BASE_URL_V2 = "https://api.sms-activate.org/v2";

export class SmsActivateProvider implements SmsProvider {
  name = "sms-activate";
  private apiKey: string;
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({ timeout: 30000 });
  }

  async buyNumber(service: string, country: string): Promise<BuyResult> {
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

  async getSms(numberId: string): Promise<SmsResult> {
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

  async releaseNumber(numberId: string): Promise<void> {
    await this.client.get(BASE_URL, {
      params: {
        api_key: this.apiKey,
        action: "setStatus",
        id: numberId,
        status: 8,
      },
    });
  }

  async getServices(country?: string): Promise<ServicePrice[]> {
    const countryCode = country && country !== "any" ? country : "0";
    const { data } = await this.client.get(BASE_URL, {
      params: {
        api_key: this.apiKey,
        action: "getPrices",
        country: countryCode,
      },
    });

    const results: ServicePrice[] = [];
    if (typeof data === "object") {
      for (const [, services] of Object.entries(data) as [string, any][]) {
        for (const [service, info] of Object.entries(services) as [
          string,
          any,
        ][]) {
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

  async getBalance(): Promise<number> {
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
