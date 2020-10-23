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
const ethers_1 = require('ethers');
const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';
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
function getFilteredPools(tokenIn, tokenOut, SubgraphUrl = '') {
    return __awaiter(this, void 0, void 0, function*() {
        tokenIn = ethers_1.utils.getAddress(tokenIn);
        tokenOut = ethers_1.utils.getAddress(tokenOut);
        let query = `
      {
          poolIn: pools (first: 1000, where: { tokensList_contains: ["${tokenIn}"], publicSwap: true, active: true}) {
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
          },

          poolOut: pools (first: 1000, where: { tokensList_contains: ["${tokenOut}"], publicSwap: true, active: true}) {
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
        // Remove any duplicate pools
        let joined = data.poolIn.concat(data.poolOut);
        var exclusivePools = joined.reduce((accumalator, current) => {
            if (!accumalator.some(item => item.id === current.id)) {
                accumalator.push(current);
            }
            return accumalator;
        }, []);
        return { pools: exclusivePools };
    });
}
exports.getFilteredPools = getFilteredPools;
