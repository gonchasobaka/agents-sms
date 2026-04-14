import { SmsProvider } from "../types";
export declare function initProviders(): Promise<SmsProvider[]>;
export declare function getProviderByName(providers: SmsProvider[], name: string): SmsProvider | undefined;
export declare function findCheapestProvider(providers: SmsProvider[], service: string, country: string): Promise<{
    provider: SmsProvider;
    price: number;
}[]>;
