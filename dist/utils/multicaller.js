"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const contracts_1 = require("@ethersproject/contracts");
const abi_1 = require("@ethersproject/abi");
function call(provider, abi, call, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const contract = new contracts_1.Contract(call[0], abi, provider);
        try {
            const params = call[2] || [];
            return yield contract[call[1]](...params, options || {});
        }
        catch (e) {
            return Promise.reject(e);
        }
    });
}
exports.call = call;
function multicall(multiAddress, provider, abi, calls, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const multicallAbi = require('../abi/Multicall.json');
        const multi = new contracts_1.Contract(multiAddress, multicallAbi, provider);
        const itf = new abi_1.Interface(abi);
        try {
            const [, res] = yield multi.aggregate(calls.map(call => [
                call[0].toLowerCase(),
                itf.encodeFunctionData(call[1], call[2]),
            ]), options || {});
            return res.map((call, i) => itf.decodeFunctionResult(calls[i][1], call));
        }
        catch (e) {
            return Promise.reject(e);
        }
    });
}
exports.multicall = multicall;
class Multicaller {
    constructor(multiAddress, provider, abi, options) {
        this.options = {};
        this.calls = [];
        this.paths = [];
        this.multiAddress = multiAddress;
        this.provider = provider;
        this.abi = abi;
        this.options = options || {};
    }
    call(path, address, fn, params) {
        this.calls.push([address, fn, params]);
        this.paths.push(path);
        return this;
    }
    execute(from) {
        return __awaiter(this, void 0, void 0, function* () {
            const obj = from || {};
            const result = yield multicall(this.multiAddress, this.provider, this.abi, this.calls, this.options);
            result.forEach((r, i) => lodash_1.default.set(obj, this.paths[i], r.length > 1 ? r : r[0]));
            this.calls = [];
            this.paths = [];
            return obj;
        });
    }
}
exports.Multicaller = Multicaller;
