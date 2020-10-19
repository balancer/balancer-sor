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
const address_1 = require('@ethersproject/address');
const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';
// LEGACY FUNCTION - Keep Input/Output Format
function getPoolsWithTokens(tokenIn, tokenOut) {
    return __awaiter(this, void 0, void 0, function*() {
        // GraphQL is case-sensitive
        // Always use checksum addresses
        tokenIn = address_1.getAddress(tokenIn);
        tokenOut = address_1.getAddress(tokenOut);
        const query = `
      query ($tokens: [Bytes!]) {
          pools (first: 1000, where: {tokensList_contains: $tokens, publicSwap: true, active: true}) {
            id
            publicSwap
            swapFee
            totalWeight
            tokensList
            tokens {
              id
              address
              balance
              decimals
              symbol
              denormWeight
            }
          }
        }
    `;
        const variables = {
            tokens: [tokenIn, tokenOut],
        };
        const response = yield isomorphic_fetch_1.default(SUBGRAPH_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        });
        const { data } = yield response.json();
        return data;
    });
}
exports.getPoolsWithTokens = getPoolsWithTokens;
// LEGACY FUNCTION - Keep Input/Output Format
function getTokenPairs(token) {
    return __awaiter(this, void 0, void 0, function*() {
        // GraphQL is case-sensitive
        // Always use checksum addresses
        token = address_1.getAddress(token);
        const query = `
      query ($token: [Bytes!]) {
          pools (first: 1000, where: {tokensList_contains: $token, publicSwap: true, active: true}) {
            tokensList
          }
        }
    `;
        const variables = {
            token: [token],
        };
        const response = yield isomorphic_fetch_1.default(SUBGRAPH_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        });
        const { data } = yield response.json();
        return data;
    });
}
exports.getTokenPairs = getTokenPairs;
// Returns all public pools
function getAllPublicSwapPools(SubgraphUrl = '') {
    return __awaiter(this, void 0, void 0, function*() {
        const query = `
      {
          pools (first: 1000, where: {publicSwap: true, active: true}) {
            id
            swapFee
            totalWeight
            publicSwap
            tokens {
              id
              address
              balance
              decimals
              symbol
              denormWeight
            }
            tokensList
          }
      }
    `;
        const response = yield isomorphic_fetch_1.default(
            SubgraphUrl === '' ? SUBGRAPH_URL : SubgraphUrl,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                }),
            }
        );
        const { data } = yield response.json();
        return data;
    });
}
exports.getAllPublicSwapPools = getAllPublicSwapPools;
