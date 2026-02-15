"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.TestContractRuntime = void 0;
var transaction_1 = require("@btc-vision/transaction");
var src_1 = require("../../../../../src");
var TestContractRuntime = /** @class */ (function (_super) {
    __extends(TestContractRuntime, _super);
    function TestContractRuntime(deployer, address, gasLimit) {
        if (gasLimit === void 0) { gasLimit = 150000000000n; }
        var _this = _super.call(this, {
            address: address,
            deployer: deployer,
            gasLimit: gasLimit,
        }) || this;
        _this.sha256Selector = _this.getSelector('sha256(bytes)');
        _this.verifySignatureSelector = _this.getSelector('verifySignature(bytes)');
        _this.verifySignatureSchnorrSelector = _this.getSelector('verifySignatureSchnorr(bytes)');
        _this.ripemd160Selector = _this.getSelector('ripemd160(bytes)');
        _this.storeSelector = _this.getSelector('store(bytes32,bytes32)');
        _this.loadSelector = _this.getSelector('load(bytes32)');
        _this.tStoreSelector = _this.getSelector('tStore(bytes32,bytes32)');
        _this.tLoadSelector = _this.getSelector('tLoad(bytes32)');
        _this.accountTypeSelector = _this.getSelector('accountType(address)');
        _this.blockHashSelector = _this.getSelector('blockHash(uint64)');
        _this.callThenGrowMemorySelector = _this.getSelector('callThenGrowMemory(uint32)');
        _this.growMemoryThenRecursiveCallSelector = _this.getSelector('growMemoryThenRecursiveCall(uint32,uint32)');
        _this.growMemorySelector = _this.getSelector('growMemory(uint32)');
        _this.recursiveCallSelector = _this.getSelector('recursiveCall(uint32)');
        _this.modifyStateThenCallFunctionModifyingStateThatRevertsSelector = _this.getSelector('modifyStateThenCallFunctionModifyingStateThatReverts(bytes32,bytes32,bytes32)');
        _this.modifyStateThenRevertSelector = _this.getSelector('modifyStateThenRevert(bytes32,bytes32)');
        _this.callThenModifyStateSelector = _this.getSelector('callThenModifyState(bytes32,bytes32)');
        _this.modifyStateSelector = _this.getSelector('modifyState(bytes32,bytes32)');
        _this.chainIdSelector = _this.getSelector('chainId()');
        _this.protocolIdSelector = _this.getSelector('protocolId()');
        return _this;
    }
    TestContractRuntime.prototype.sha256Call = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.sha256Selector);
                        calldata.writeBytesWithLength(value);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.verifySignature = function (value, sender, origin) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.verifySignatureSelector);
                        calldata.writeBytesWithLength(value);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                                sender: sender,
                                txOrigin: origin,
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, {
                                result: reader.readBoolean(),
                                gas: response.usedGas,
                            }];
                }
            });
        });
    };
    TestContractRuntime.prototype.verifySignatureSchnorr = function (value, sender, origin) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.verifySignatureSchnorrSelector);
                        calldata.writeBytesWithLength(value);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                                sender: sender,
                                txOrigin: origin,
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, {
                                result: reader.readBoolean(),
                                gas: response.usedGas,
                            }];
                }
            });
        });
    };
    TestContractRuntime.prototype.ripemd160Call = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.ripemd160Selector);
                        calldata.writeBytesWithLength(value);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(20)];
                }
            });
        });
    };
    TestContractRuntime.prototype.storeCall = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(68);
                        calldata.writeSelector(this.storeSelector);
                        calldata.writeBytes(key);
                        calldata.writeBytes(value);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/, value];
                }
            });
        });
    };
    TestContractRuntime.prototype.loadCall = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(68);
                        calldata.writeSelector(this.loadSelector);
                        calldata.writeBytes(key);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.tStoreCall = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(68);
                        calldata.writeSelector(this.tStoreSelector);
                        calldata.writeBytes(key);
                        calldata.writeBytes(value);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/, value];
                }
            });
        });
    };
    TestContractRuntime.prototype.tLoadCall = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(68);
                        calldata.writeSelector(this.tLoadSelector);
                        calldata.writeBytes(key);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.accountTypeCall = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(36);
                        calldata.writeSelector(this.accountTypeSelector);
                        calldata.writeAddress(address);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readU32()];
                }
            });
        });
    };
    TestContractRuntime.prototype.blockHashCall = function (blockId) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter(12);
                        calldata.writeSelector(this.blockHashSelector);
                        calldata.writeU64(blockId);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.callThenGrowMemory = function (pages) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.callThenGrowMemorySelector);
                        calldata.writeU32(pages);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBoolean()];
                }
            });
        });
    };
    TestContractRuntime.prototype.growMemoryThenRecursiveCall = function (pages, numberOfCalls) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.growMemoryThenRecursiveCallSelector);
                        calldata.writeU32(pages);
                        calldata.writeU32(numberOfCalls);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    TestContractRuntime.prototype.growMemory = function (pages) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.growMemorySelector);
                        calldata.writeU32(pages);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBoolean()];
                }
            });
        });
    };
    TestContractRuntime.prototype.recursiveCall = function (numberOfCalls) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.recursiveCallSelector);
                        calldata.writeU32(numberOfCalls);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    TestContractRuntime.prototype.modifyStateThenCallFunctionModifyingStateThatReverts = function (storageKey, firstStorageValue, secondStorageValue) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.modifyStateThenCallFunctionModifyingStateThatRevertsSelector);
                        calldata.writeBytes(storageKey);
                        calldata.writeBytes(firstStorageValue);
                        calldata.writeBytes(secondStorageValue);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.modifyStateThenRevert = function (storageKey, storageValue) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.modifyStateThenRevertSelector);
                        calldata.writeBytes(storageKey);
                        calldata.writeBytes(storageValue);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    TestContractRuntime.prototype.callThenModifyState = function (storageKey, storageValue) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.callThenModifyStateSelector);
                        calldata.writeBytes(storageKey);
                        calldata.writeBytes(storageValue);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.modifyState = function (storageKey, storageValue) {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.modifyStateSelector);
                        calldata.writeBytes(storageKey);
                        calldata.writeBytes(storageValue);
                        return [4 /*yield*/, this.execute({
                                calldata: calldata.getBuffer(),
                            })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    TestContractRuntime.prototype.chainId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.chainIdSelector);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.protocolId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var calldata, response, reader;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        calldata = new transaction_1.BinaryWriter();
                        calldata.writeSelector(this.protocolIdSelector);
                        return [4 /*yield*/, this.execute({ calldata: calldata.getBuffer() })];
                    case 1:
                        response = _a.sent();
                        this.handleResponse(response);
                        reader = new transaction_1.BinaryReader(response.response);
                        return [2 /*return*/, reader.readBytes(32)];
                }
            });
        });
    };
    TestContractRuntime.prototype.handleError = function (error) {
        return new Error("(in test contract: ".concat(this.address, ") OP_NET: ").concat(error.message));
    };
    TestContractRuntime.prototype.defineRequiredBytecodes = function () {
        src_1.BytecodeManager.loadBytecode('./test/e2e/contracts/test-contract/contract/build/TestContract.wasm', this.address);
    };
    TestContractRuntime.prototype.getSelector = function (signature) {
        return Number("0x".concat(this.abiCoder.encodeSelector(signature)));
    };
    TestContractRuntime.prototype.handleResponse = function (response) {
        if (response.error)
            throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
    };
    return TestContractRuntime;
}(src_1.ContractRuntime));
exports.TestContractRuntime = TestContractRuntime;
