import { SmsProvider, BuyResult, SmsResult, ServicePrice } from "../types";
export declare class FiveSimProvider implements SmsProvider {
    name: string;
    private client;
    constructor(apiKey: string);
    buyNumber(service: string, country: string): Promise<BuyResult>;
    getSms(numberId: string): Promise<SmsResult>;
    releaseNumber(numberId: string): Promise<void>;
    getServices(country?: string): Promise<ServicePrice[]>;
    getBalance(): Promise<number>;
}
