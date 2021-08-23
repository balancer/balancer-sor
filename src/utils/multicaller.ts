import _ from 'lodash';
import { BaseProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { Interface } from '@ethersproject/abi';

export async function call(
    provider: any,
    abi: any[],
    call: any[],
    options = {}
): Promise<any> {
    const contract = new Contract(call[0], abi, provider);
    try {
        const params = call[2] || [];
        return await contract[call[1]](...params, options);
    } catch (e) {
        return Promise.reject(e);
    }
}

export async function multicall(
    multiAddress: string,
    provider: any,
    abi: any[],
    calls: [string, string, any[]][],
    options = {}
) {
    const multi = new Contract(
        multiAddress,
        [
            'function aggregate(tuple(address target, bytes callData) memory calls) public returns (uint256 blockNumber, bytes[] memory returnData)',
        ],
        provider
    );
    const itf = new Interface(abi);
    try {
        const [, res] = await multi.aggregate(
            calls.map(call => [
                call[0].toLowerCase(),
                itf.encodeFunctionData(call[1], call[2]),
            ]),
            options
        );
        return res.map((call, i) =>
            itf.decodeFunctionResult(calls[i][1], call)
        );
    } catch (e) {
        return Promise.reject(e);
    }
}

export class Multicaller {
    public multiAddress: string;
    public provider: BaseProvider;
    public abi: any[];
    public options: any = {};
    public calls: [string, string, any][] = [];
    public paths: any[] = [];

    constructor(
        multiAddress: string,
        provider: BaseProvider,
        abi: any[],
        options = {}
    ) {
        this.multiAddress = multiAddress;
        this.provider = provider;
        this.abi = abi;
        this.options = options;
    }

    call(
        path: string,
        address: string,
        fn: string,
        params?: any[]
    ): Multicaller {
        this.calls.push([address, fn, params]);
        this.paths.push(path);
        return this;
    }

    async execute(from?: any): Promise<any> {
        const obj = from || {};
        const result = await multicall(
            this.multiAddress,
            this.provider,
            this.abi,
            this.calls,
            this.options
        );
        result.forEach((r, i) =>
            _.set(obj, this.paths[i], r.length > 1 ? r : r[0])
        );
        this.calls = [];
        this.paths = [];
        return obj;
    }
}
