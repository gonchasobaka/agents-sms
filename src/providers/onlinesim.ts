import axios, { AxiosInstance } from "axios";
import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";

const BASE_URL = "https://onlinesim.io/api";

const AUTH_ERRORS = ["ERROR_WRONG_KEY", "ERROR_NO_KEY", "ACCOUNT_BLOCKED"];

function assertResponse(data: any): void {
  if (typeof data.response === "string" && AUTH_ERRORS.includes(data.response)) {
    throw new Error(`onlinesim auth error: ${data.response}`);
  }
}

export class OnlineSimProvider implements SmsProvider {
  name = "onlinesim";
  private apiKey: string;
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  /**
   * Buy a number. `service` must be the slug from getNumbersStats
   * (e.g. "telegram", "google", "whatsapp").
   * `country` is the phone country code as a string (e.g. "1", "49", "33")
   * or "any" to omit.
   */
  async buyNumber(service: string, country: string): Promise<BuyResult> {
    const params: Record<string, string | number> = {
      apikey: this.apiKey,
      service,
    };
    if (country && country !== "any") {
      params.country = parseInt(country, 10) || country;
    }

    const { data } = await this.client.get("/getNum.php", { params });
    assertResponse(data);

    if (data.response === "WARNING_LOW_BALANCE") {
      throw new Error("onlinesim: insufficient provider balance");
    }
    if (data.response === "UNDEFINED_COUNTRY") {
      throw new Error(
        `onlinesim: invalid country '${country}'. Use phone codes (1=USA, 49=Germany, 33=France)`
      );
    }
    if (data.response === "NO_NUMBER" || data.response === "NO_NUMBERS") {
      throw new Error(`onlinesim: no numbers available for ${service} in country ${country}`);
    }
    if (data.response === 1 || data.response === "1") {
      const tzid = String(data.tzid);

      // getNum returns only tzid — fetch phone number from getState
      let phoneNumber = "";
      let cost = 0;
      try {
        const { data: stateData } = await this.client.get("/getState.php", {
          params: { apikey: this.apiKey, tzid },
        });
        if (Array.isArray(stateData) && stateData.length > 0) {
          phoneNumber = stateData[0].number || "";
          cost = stateData[0].sum || 0;
        }
      } catch {
        // non-critical — number is bought, just couldn't fetch details yet
      }

      return {
        number_id: tzid,
        phone_number: phoneNumber,
        provider: this.name,
        cost_usd: cost || data.sum || 0,
      };
    }
    throw new Error(`onlinesim buyNumber: ${data.response || JSON.stringify(data)}`);
  }

  async getSms(numberId: string): Promise<SmsResult> {
    const { data } = await this.client.get("/getState.php", {
      params: {
        apikey: this.apiKey,
        tzid: numberId,
        message_to_code: 1,
      },
    });
    assertResponse(data);

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      if (item.response === "TZ_NUM_ANSWER") {
        return { status: "received", code: item.msg, full_text: item.msg };
      }
    }
    if (data.response === "TZ_OVER_EMPTY") {
      return { status: "cancelled" };
    }
    return { status: "waiting" };
  }

  async releaseNumber(numberId: string): Promise<void> {
    const { data } = await this.client.get("/setOperationRevise.php", {
      params: { apikey: this.apiKey, tzid: numberId },
    });
    assertResponse(data);
  }

  /**
   * Fetch available services via getNumbersStats.
   * This endpoint returns service slugs that getNum actually accepts.
   * `country` is a phone country code (e.g. "1", "49") or "any".
   */
  async getServices(country?: string): Promise<ServicePrice[]> {
    // If "any", query a default set of popular countries
    const countryCodes = country && country !== "any" ? [country] : ["1", "49", "44"];

    const results: ServicePrice[] = [];
    const seen = new Set<string>();

    for (const cc of countryCodes) {
      try {
        const { data } = await this.client.get("/getNumbersStats.php", {
          params: { apikey: this.apiKey, country: parseInt(cc, 10) },
        });
        assertResponse(data);

        const services = data.services || {};
        for (const [, info] of Object.entries(services) as [string, any][]) {
          const slug = info.slug as string;
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);

          results.push({
            service: slug,
            country: String(data.code || cc),
            price_usd: info.price || 0,
            provider: this.name,
            count: info.count || 0,
          });
        }
      } catch {
        // Country may not be available, skip
      }
    }
    return results;
  }

  async getBalance(): Promise<number> {
    const { data } = await this.client.get("/getBalance.php", {
      params: { apikey: this.apiKey },
    });
    assertResponse(data);
    return parseFloat(data.balance) || 0;
  }
}
