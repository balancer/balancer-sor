'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var SwapTypes;
(function (SwapTypes) {
    SwapTypes[(SwapTypes['SwapExactIn'] = 0)] = 'SwapExactIn';
    SwapTypes[(SwapTypes['SwapExactOut'] = 1)] = 'SwapExactOut';
})((SwapTypes = exports.SwapTypes || (exports.SwapTypes = {})));
var PoolTypes;
(function (PoolTypes) {
    PoolTypes[(PoolTypes['Weighted'] = 0)] = 'Weighted';
    PoolTypes[(PoolTypes['Stable'] = 1)] = 'Stable';
    PoolTypes[(PoolTypes['Element'] = 2)] = 'Element';
    PoolTypes[(PoolTypes['MetaStable'] = 3)] = 'MetaStable';
    PoolTypes[(PoolTypes['Linear'] = 4)] = 'Linear';
})((PoolTypes = exports.PoolTypes || (exports.PoolTypes = {})));
var SwapPairType;
(function (SwapPairType) {
    SwapPairType[(SwapPairType['Direct'] = 0)] = 'Direct';
    SwapPairType[(SwapPairType['HopIn'] = 1)] = 'HopIn';
    SwapPairType[(SwapPairType['HopOut'] = 2)] = 'HopOut';
})((SwapPairType = exports.SwapPairType || (exports.SwapPairType = {})));
var PairTypes;
(function (PairTypes) {
    PairTypes[(PairTypes['BptToToken'] = 0)] = 'BptToToken';
    PairTypes[(PairTypes['TokenToBpt'] = 1)] = 'TokenToBpt';
    PairTypes[(PairTypes['TokenToToken'] = 2)] = 'TokenToToken';
})((PairTypes = exports.PairTypes || (exports.PairTypes = {})));
var PoolFilter;
(function (PoolFilter) {
    PoolFilter['All'] = 'All';
    PoolFilter['Weighted'] = 'Weighted';
    PoolFilter['Stable'] = 'Stable';
    PoolFilter['MetaStable'] = 'MetaStable';
    PoolFilter['LBP'] = 'LiquidityBootstrapping';
})((PoolFilter = exports.PoolFilter || (exports.PoolFilter = {})));
