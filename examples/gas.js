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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var src_1 = require("../src");
var src_2 = require("../src");
var rndAddress = src_1.Blockchain.generateRandomAddress();
var receiver = src_1.Blockchain.generateRandomAddress();
await (0, src_1.opnet)('Compare OP_20 gas usage', function (vm) { return __awaiter(void 0, void 0, void 0, function () {
    function mintTokens() {
        return __awaiter(this, void 0, void 0, function () {
            var amountA, currentBalanceTokenA;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, token.resetStates()];
                    case 1:
                        _a.sent();
                        amountA = 11000000;
                        // Mint some token
                        return [4 /*yield*/, token.mint(receiver, amountA)];
                    case 2:
                        // Mint some token
                        _a.sent();
                        return [4 /*yield*/, token.balanceOfNoDecimals(receiver)];
                    case 3:
                        currentBalanceTokenA = _a.sent();
                        src_1.Assert.expect(currentBalanceTokenA).toEqual(amountA);
                        return [2 /*return*/];
                }
            });
        });
    }
    var token;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                src_1.Blockchain.msgSender = receiver;
                src_1.Blockchain.txOrigin = receiver; // "leftmost thing in the call chain"
                return [4 /*yield*/, vm.it('should instantiate an OP_20 token', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, src_1.Assert.expect(function () { return __awaiter(void 0, void 0, void 0, function () {
                                        var token;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    token = new src_2.OP20({
                                                        file: 'MyToken',
                                                        deployer: src_1.Blockchain.txOrigin,
                                                        address: rndAddress,
                                                        decimals: 18,
                                                    });
                                                    return [4 /*yield*/, token.init()];
                                                case 1:
                                                    _a.sent();
                                                    return [4 /*yield*/, token.deployContract()];
                                                case 2:
                                                    _a.sent();
                                                    token.dispose();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); }).toNotThrow()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                token = new src_2.OP20({
                    file: 'MyToken',
                    deployer: src_1.Blockchain.txOrigin,
                    address: rndAddress,
                    decimals: 18,
                });
                src_1.Blockchain.register(token);
                vm.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, src_1.Blockchain.init()];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                vm.afterAll(function () {
                    src_1.Blockchain.dispose();
                });
                return [4 /*yield*/, vm.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, src_1.Blockchain.init()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, mintTokens()];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _a.sent();
                return [4 /*yield*/, vm.it('should get the gas of a transfer', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var time, transfer, elapsed, currentGasUsed, savedGas;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    time = Date.now();
                                    return [4 /*yield*/, token.safeTransfer(receiver, rndAddress, 100n)];
                                case 1:
                                    transfer = _a.sent();
                                    elapsed = Date.now() - time;
                                    currentGasUsed = 673985327n;
                                    if (transfer.usedGas <= currentGasUsed) {
                                        savedGas = currentGasUsed - transfer.usedGas;
                                        vm.success("Gas used is less than or equal to the expected gas (".concat(savedGas, " gas saved) (").concat(transfer.usedGas, " <= ").concat(currentGasUsed, ")"));
                                    }
                                    else {
                                        vm.error("Gas used is more than the expected gas (".concat(transfer.usedGas, " > ").concat(currentGasUsed, ")"));
                                    }
                                    vm.info("Elapsed time: ".concat(elapsed, "ms"));
                                    src_1.Assert.equal(transfer.usedGas <= currentGasUsed, true);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
