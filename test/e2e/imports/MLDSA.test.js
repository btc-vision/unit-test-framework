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
var transaction_1 = require("@btc-vision/transaction");
var src_1 = require("../../../src");
var TestContractRuntime_1 = require("../contracts/test-contract/runtime/TestContractRuntime");
await (0, src_1.opnet)('Hash tests', function (vm) { return __awaiter(void 0, void 0, void 0, function () {
    var contract, deployerAddress, contractAddress;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                deployerAddress = src_1.Blockchain.generateRandomAddress();
                contractAddress = src_1.Blockchain.generateRandomAddress();
                vm.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                src_1.Blockchain.dispose();
                                src_1.Blockchain.clearContracts();
                                return [4 /*yield*/, src_1.Blockchain.init()];
                            case 1:
                                _a.sent();
                                contract = new TestContractRuntime_1.TestContractRuntime(deployerAddress, contractAddress);
                                src_1.Blockchain.register(contract);
                                return [4 /*yield*/, contract.init()];
                            case 2:
                                _a.sent();
                                src_1.Blockchain.txOrigin = deployerAddress;
                                src_1.Blockchain.msgSender = deployerAddress;
                                return [2 /*return*/];
                        }
                    });
                }); });
                vm.afterEach(function () {
                    contract.dispose();
                    src_1.Blockchain.dispose();
                });
                return [4 /*yield*/, vm.it('Should sign and verify MLDSA message', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var wallet, message, signature, result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    wallet = src_1.Blockchain.generateRandomWallet();
                                    vm.info("Using wallet address: ".concat(wallet.address.toHex(), " | Public Key: ").concat(wallet.quantumPublicKeyHex));
                                    message = new transaction_1.BinaryWriter();
                                    message.writeString('Hello, world! This is a test message for MLDSA signing.');
                                    signature = transaction_1.MessageSigner.signMLDSAMessage(wallet.mldsaKeypair, message.getBuffer());
                                    vm.info("Generated MLDSA signature: ".concat(Buffer.from(signature.signature).toString('hex'), " | Security Level: ").concat(signature.securityLevel));
                                    return [4 /*yield*/, contract.verifySignature(signature.signature, wallet.address, wallet.address)];
                                case 1:
                                    result = _a.sent();
                                    vm.success("Gas used: ".concat(result.gas));
                                    src_1.Assert.expect(result.result).toEqual(true);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                return [4 /*yield*/, vm.it('Should sign and verify schnorr message', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var wallet, message, messageBuffer, signature, valid, result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    wallet = src_1.Blockchain.generateRandomWallet();
                                    vm.info("Using wallet address: ".concat(wallet.address.toHex(), " | Public Key: ").concat(wallet.quantumPublicKeyHex));
                                    message = new transaction_1.BinaryWriter();
                                    message.writeString('Hello, world! This is a test message for Schnorr signing.');
                                    messageBuffer = message.getBuffer();
                                    signature = transaction_1.MessageSigner.tweakAndSignMessage(wallet.keypair, messageBuffer, src_1.Blockchain.network);
                                    valid = transaction_1.MessageSigner.tweakAndVerifySignature(wallet.keypair.publicKey, messageBuffer, signature.signature);
                                    vm.info("Local verification result: ".concat(valid));
                                    src_1.Assert.expect(valid).toEqual(true);
                                    return [4 /*yield*/, contract.verifySignatureSchnorr(signature.signature, wallet.address, wallet.address)];
                                case 1:
                                    result = _a.sent();
                                    vm.success("Gas used: ".concat(result.gas));
                                    src_1.Assert.expect(result.result).toEqual(true);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function areBytesEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    return arr1.every(function (value, index) { return value === arr2[index]; });
}
