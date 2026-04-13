import axios, { AxiosInstance } from "axios";
import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";

const BASE_URL = "https://onlinesim.io/api";

const AUTH_ERRORS = ["ERROR_WRONG_KEY", "ERROR_NO_KEY", "ACCOUNT_BLOCKED"];

// ISO 3166-1 alpha-2 → phone country code
const ISO_TO_PHONE: Record<string, number> = {
  af:93, al:355, dz:213, ad:376, ao:244, ar:54, am:374, au:61, at:43,
  az:994, bh:973, bd:880, by:375, be:32, bj:229, bt:975, bo:591, ba:387,
  bw:267, br:55, bg:359, bf:226, bi:257, kh:855, cm:237, ca:1, cf:236,
  td:235, cl:56, cn:86, co:57, cg:242, cd:243, cr:506, hr:385, cu:53,
  cy:357, cz:420, dk:45, dj:253, do:1, ec:593, eg:20, sv:503, gq:240,
  er:291, ee:372, et:251, fj:679, fi:358, fr:33, ga:241, ge:995, de:49,
  gh:233, gr:30, gt:502, gn:224, gw:245, gy:592, ht:509, hn:504, hk:852,
  hu:36, is:354, in:91, id:62, ir:98, iq:964, ie:353, il:972, it:39,
  jm:1, jp:81, jo:962, kz:7, ke:254, kp:850, kr:82, kw:965, kg:996,
  la:856, lv:371, lb:961, ls:266, lr:231, ly:218, li:423, lt:370, lu:352,
  mo:853, mk:389, mg:261, mw:265, my:60, mv:960, ml:223, mt:356, mr:222,
  mu:230, mx:52, md:373, mc:377, mn:976, me:382, ma:212, mz:258, mm:95,
  na:264, np:977, nl:31, nz:64, ni:505, ne:227, ng:234, no:47, om:968,
  pk:92, ps:970, pa:507, pg:675, py:595, pe:51, ph:63, pl:48, pt:351,
  qa:974, ro:40, ru:7, rw:250, sa:966, sn:221, rs:381, sl:232, sg:65,
  sk:421, si:386, so:252, za:27, es:34, lk:94, sd:249, sr:597, sz:268,
  se:46, ch:41, sy:963, tw:886, tj:992, tz:255, th:66, tg:228, to:676,
  tn:216, tr:90, tm:993, ug:256, ua:380, ae:971, gb:44, us:1, uy:598,
  uz:998, ve:58, vn:84, ye:967, zm:260, zw:263, xk:383,
};

// Country name (english, lowercase) → phone code for convenience
const NAME_TO_PHONE: Record<string, number> = {
  russia:7, usa:1, "united states":1, uk:44, "united kingdom":44,
  germany:49, france:33, spain:34, italy:39, china:86, india:91,
  brazil:55, ukraine:380, poland:48, netherlands:31, sweden:46,
  norway:47, denmark:45, finland:358, estonia:372, latvia:371,
  lithuania:370, turkey:90, israel:972, "saudi arabia":966,
  "united arab emirates":971, australia:61, canada:1, japan:81,
  "south korea":82, indonesia:62, vietnam:84, thailand:66,
  philippines:63, pakistan:92, bangladesh:880, mexico:52, argentina:54,
  colombia:57, chile:56, peru:51, egypt:20, nigeria:234, kenya:254,
  "south africa":27, ghana:233,
};

/**
 * Convert any country input to OnlineSim phone code.
 * Accepts: numeric string ("372"), ISO-2 ("ee"), country name ("estonia"), "any".
 * Returns undefined for "any"/unknown.
 */
function toPhoneCode(country: string): number | undefined {
  if (!country || country === "any") return undefined;
  const lower = country.toLowerCase().trim();
  // Already numeric
  const num = parseInt(country, 10);
  if (!isNaN(num) && String(num) === country.trim()) return num;
  // ISO-2 lookup
  if (ISO_TO_PHONE[lower]) return ISO_TO_PHONE[lower];
  // Name lookup
  if (NAME_TO_PHONE[lower]) return NAME_TO_PHONE[lower];
  // Fallback: try parsing anyway
  return isNaN(num) ? undefined : num;
}

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
    const phoneCode = toPhoneCode(country);
    if (phoneCode !== undefined) {
      params.country = phoneCode;
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
    // Resolve to phone codes; for "any" query a popular set
    let phoneCodes: number[];
    if (!country || country === "any") {
      phoneCodes = [1, 7, 49, 44, 33, 91, 86, 55];
    } else {
      const code = toPhoneCode(country);
      phoneCodes = code !== undefined ? [code] : [1, 7, 49, 44];
    }

    const results: ServicePrice[] = [];
    const seen = new Set<string>();

    for (const code of phoneCodes) {
      try {
        const { data } = await this.client.get("/getNumbersStats.php", {
          params: { apikey: this.apiKey, country: code },
        });
        assertResponse(data);

        const services = data.services || {};
        for (const [, info] of Object.entries(services) as [string, any][]) {
          const slug = info.slug as string;
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);

          results.push({
            service: slug,
            country: String(data.code || code),
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
