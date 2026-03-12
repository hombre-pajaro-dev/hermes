"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosWorld = void 0;
const cucumber_1 = require("@cucumber/cucumber");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../src/app");
class PosWorld extends cucumber_1.World {
    agent;
    response;
    context = {};
    constructor(options) {
        super(options);
        this.agent = (0, supertest_1.default)((0, app_1.createApp)());
    }
}
exports.PosWorld = PosWorld;
(0, cucumber_1.setWorldConstructor)(PosWorld);
