'use strict';
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
var __importDefault =
    (this && this.__importDefault) ||
    function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
var __importStar =
    (this && this.__importStar) ||
    function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result['default'] = mod;
        return result;
    };
Object.defineProperty(exports, '__esModule', { value: true });
const isomorphic_fetch_1 = __importDefault(require('isomorphic-fetch'));
const bmath = __importStar(require('./bmath'));
class IPFS {
    get(ipfsHash, protocolType = 'ipfs') {
        const url = `https://${process.env.IPFS_NODE}/${protocolType}/${ipfsHash}`;
        return isomorphic_fetch_1.default(url).then(res => res.json());
    }
    getAllPublicSwapPools(IpfsHash, ProtocolType) {
        return __awaiter(this, void 0, void 0, function*() {
            let allPools = yield this.get(IpfsHash, ProtocolType);
            return allPools;
        });
    }
    getAllPublicSwapPoolsBigNumber(pools) {
        return __awaiter(this, void 0, void 0, function*() {
            let onChainPools = { pools: [] };
            for (let i = 0; i < pools.pools.length; i++) {
                let tokens = [];
                let p = {
                    id: pools.pools[i].id,
                    swapFee: bmath.scale(
                        bmath.bnum(pools.pools[i].swapFee),
                        18
                    ),
                    totalWeight: bmath.scale(
                        bmath.bnum(pools.pools[i].totalWeight),
                        18
                    ),
                    tokens: tokens,
                    tokensList: pools.pools[i].tokensList,
                };
                pools.pools[i].tokens.forEach(token => {
                    let decimals = Number(token.decimals);
                    p.tokens.push({
                        address: token.address,
                        balance: bmath.scale(
                            bmath.bnum(token.balance),
                            decimals
                        ),
                        decimals: decimals,
                        denormWeight: bmath.scale(
                            bmath.bnum(token.denormWeight),
                            18
                        ),
                    });
                });
                onChainPools.pools.push(p);
            }
            return onChainPools;
        });
    }
    getFilteredPools(TokenIn, TokenOut, IpfsHash, ProtocolType) {
        return __awaiter(this, void 0, void 0, function*() {
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            let allPools = yield this.get(IpfsHash, ProtocolType);
            let filteredPools = [];
            allPools.pools.forEach(pool => {
                if (pool.tokensList.includes(TokenIn)) {
                    filteredPools.push(pool);
                } else if (pool.tokensList.includes(TokenOut)) {
                    filteredPools.push(pool);
                }
            });
            return { pools: filteredPools };
        });
    }
    getPoolsWithToken(Token, IpfsHash, ProtocolType) {
        return __awaiter(this, void 0, void 0, function*() {
            Token = Token.toLowerCase();
            let allPools = yield this.get(IpfsHash, ProtocolType);
            let filteredPools = [];
            allPools.pools.forEach(pool => {
                if (pool.tokensList.includes(Token)) {
                    filteredPools.push(pool);
                }
            });
            return { pools: filteredPools };
        });
    }
}
exports.IPFS = IPFS;
