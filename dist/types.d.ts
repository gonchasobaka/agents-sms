export interface BuyResult {
    number_id: string;
    phone_number: string;
    provider: string;
    cost_usd: number;
}
export interface SmsResult {
    status: "waiting" | "received" | "cancelled";
    code?: string;
    full_text?: string;
}
export interface ServicePrice {
    service: string;
    country: string;
    price_usd: number;
    provider: string;
    count: number;
}
export interface SmsProvider {
    name: string;
    buyNumber(service: string, country: string): Promise<BuyResult>;
    getSms(numberId: string): Promise<SmsResult>;
    releaseNumber(numberId: string): Promise<void>;
    getServices(country?: string): Promise<ServicePrice[]>;
    getBalance(): Promise<number>;
}
