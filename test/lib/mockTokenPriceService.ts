import { TokenPriceService } from '../../src';

export class MockTokenPriceService implements TokenPriceService {
    constructor(private nativeAssetPriceInToken: string = '0') {}

    public setTokenPrice(nativeAssetPriceInToken: string): void {
        this.nativeAssetPriceInToken = nativeAssetPriceInToken;
    }

    public async getNativeAssetPriceInToken(): Promise<string> {
        return this.nativeAssetPriceInToken;
    }
}

export const mockTokenPriceService = new MockTokenPriceService();
