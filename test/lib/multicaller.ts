import set from 'lodash.set';
import { Fragment, JsonFragment, Interface, Result } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { Provider } from '@ethersproject/providers';

export class Multicaller {
    private multiAddress: string;
    private provider: Provider;
    private interface: Interface;
    public options: any = {};
    private calls: [string, string, any][] = [];
    private paths: any[] = [];

    constructor(
        multiAddress: string,
        provider: Provider,
        abi: string | Array<Fragment | JsonFragment | string>,
        options = {}
    ) {
        this.multiAddress = multiAddress;
        this.provider = provider;
        this.interface = new Interface(abi);
        this.options = options;
    }

    call(
        path: string,
        address: string,
        functionName: string,
        params?: any[]
    ): Multicaller {
        this.calls.push([address, functionName, params]);
        this.paths.push(path);
        return this;
    }

    async execute(
        from: Record<string, unknown> = {}
    ): Promise<Record<string, unknown>> {
        const obj = from;
        const results = await this.executeMulticall();
        results.forEach((result, i) =>
            set(obj, this.paths[i], result.length > 1 ? result : result[0])
        );
        this.calls = [];
        this.paths = [];
        return obj;
    }

    private async executeMulticall(): Promise<Result[]> {
        const multi = new Contract(
            this.multiAddress,
            [
                'function aggregate(tuple[](address target, bytes callData) memory calls) public view returns (uint256 blockNumber, bytes[] memory returnData)',
            ],
            this.provider
        );

        const [, res] = await multi.aggregate(
            this.calls.map(([address, functionName, params]) => [
                address,
                this.interface.encodeFunctionData(functionName, params),
            ]),
            this.options
        );

        return res.map((result, i) =>
            this.interface.decodeFunctionResult(this.calls[i][1], result)
        );
    }
}
