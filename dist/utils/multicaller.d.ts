import { BaseProvider } from '@ethersproject/providers';
export declare function call(provider: any, abi: any[], call: any[], options?: any): Promise<any>;
export declare function multicall(multiAddress: string, provider: any, abi: any[], calls: any[], options?: any): Promise<any>;
export declare class Multicaller {
    multiAddress: string;
    provider: BaseProvider;
    abi: any[];
    options: any;
    calls: any[];
    paths: any[];
    constructor(multiAddress: string, provider: BaseProvider, abi: any[], options?: any);
    call(path: any, address: any, fn: any, params?: any): Multicaller;
    execute(from?: any): Promise<any>;
}
