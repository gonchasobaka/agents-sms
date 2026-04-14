import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";
export declare class OnlineSimProvider implements SmsProvider {
    name: string;
    private apiKey;
    private client;
    constructor(apiKey: string);
    /**
     * Buy a number. `service` must be the slug from getNumbersStats
     * (e.g. "telegram", "google", "whatsapp").
     * `country` is the phone country code as a string (e.g. "1", "49", "33")
     * or "any" to omit.
     */
    buyNumber(service: string, country: string): Promise<BuyResult>;
    getSms(numberId: string): Promise<SmsResult>;
    releaseNumber(numberId: string): Promise<void>;
    /**
     * Fetch available services via getNumbersStats.
     * This endpoint returns service slugs that getNum actually accepts.
     * `country` is a phone country code (e.g. "1", "49") or "any".
     */
    getServices(country?: string): Promise<ServicePrice[]>;
    getBalance(): Promise<number>;
}
