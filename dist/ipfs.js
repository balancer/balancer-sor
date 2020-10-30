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
Object.defineProperty(exports, '__esModule', { value: true });
const isomorphic_fetch_1 = __importDefault(require('isomorphic-fetch'));
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
