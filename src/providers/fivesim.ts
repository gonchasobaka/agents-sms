import axios, { AxiosInstance } from "axios";
import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";

const BASE_URL = "https://5sim.net/v1";

export class FiveSimProvider implements SmsProvider {
  name = "5sim";
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30000,
    });
  }

  async buyNumber(service: string, country: string): Promise<BuyResult> {
    const c = country === "any" ? "any" : country;
    const { data } = await this.client.get(
      `/user/buy/activation/${c}/any/${service}`
    );
    return {
      number_id: String(data.id),
      phone_number: data.phone,
      provider: this.name,
      cost_usd: data.price,
    };
  }

  async getSms(numberId: string): Promise<SmsResult> {
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

  async releaseNumber(numberId: string): Promise<void> {
    await this.client.get(`/user/cancel/${numberId}`);
  }

  async getServices(country?: string): Promise<ServicePrice[]> {
    const c = country || "any";
    const { data } = await this.client.get(`/guest/products/${c}/any`);
    const results: ServicePrice[] = [];
    for (const [service, info] of Object.entries(data) as [string, any][]) {
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

  async getBalance(): Promise<number> {
    const { data } = await this.client.get("/user/profile");
    return data.balance;
  }
}
