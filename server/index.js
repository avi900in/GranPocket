var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
var execAsync = promisify(exec);
var pendingPermissions = new Map();
// 权限请求超时时间（5分钟）
var PERMISSION_TIMEOUT = 5 * 60 * 1000;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3000;
// Middleware
app.use(express.json());
// 缓存可用模型列表
var cachedModels = [];
var defaultModel = "claude-sonnet-4";
// 健康检查
app.get("/api/health", function (req, res) {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var response, apiKey, authToken, internetEnv, baseUrl, needsLogin_1, result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                response = {
                    isLoggedIn: false,
                    envConfigured: false,
                    cliConfigured: false,
                    envVars: {},
                };
                apiKey = process.env.CODEBUDDY_API_KEY;
                authToken = process.env.CODEBUDDY_AUTH_TOKEN;
                internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
                baseUrl = process.env.CODEBUDDY_BASE_URL;
                if (apiKey || authToken) {
                    response.envConfigured = true;
                    // 脱敏显示
                    if (apiKey) {
                        response.envVars.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
                        response.apiKey = response.envVars.apiKey;
                    }
                    if (authToken) {
                        response.envVars.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
                    }
                    if (internetEnv) {
                        response.envVars.internetEnv = internetEnv;
                    }
                    if (baseUrl) {
                        response.envVars.baseUrl = baseUrl;
                    }
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                needsLogin_1 = false;
                return [4 /*yield*/, unstable_v2_authenticate({
                        environment: 'external',
                        onAuthUrl: function (authState) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // 如果执行到这个回调，说明未登录
                                needsLogin_1 = true;
                                console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
                                // 将认证 URL 返回给前端（如果需要）
                                response.error = '未登录，请先登录 CodeBuddy CLI';
                                return [2 /*return*/];
                            });
                        }); }
                    })];
            case 2:
                result = _a.sent();
                // 如果没有触发 onAuthUrl 回调，说明已登录
                if (!needsLogin_1 && (result === null || result === void 0 ? void 0 : result.userinfo)) {
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    // 判断登录方式
                    if (response.envConfigured) {
                        response.method = 'env';
                    }
                    else {
                        response.method = 'cli';
                    }
                    console.log('[Check Login] 已登录用户:', result.userinfo.userName);
                }
                else if (!needsLogin_1) {
                    // result 存在但没有 userinfo，仍然认为已登录
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    response.method = response.envConfigured ? 'env' : 'cli';
                }
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error("[Check Login] SDK Error:", error_1);
                // 如果有环境变量配置，仍然认为是登录状态
                if (response.envConfigured) {
                    response.isLoggedIn = true;
                    response.method = 'env';
                }
                else {
                    response.error = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1);
                    response.method = 'none';
                }
                return [3 /*break*/, 4];
            case 4:
                res.json(response);
                return [2 /*return*/];
        }
    });
}); });
// 保存环境变量配置
app.post("/api/save-env-config", function (req, res) {
    var _a = req.body, apiKey = _a.apiKey, authToken = _a.authToken, internetEnv = _a.internetEnv, baseUrl = _a.baseUrl;
    if (!apiKey && !authToken) {
        return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
    }
    var configuredVars = [];
    // 设置环境变量（仅在当前进程有效）
    if (apiKey) {
        process.env.CODEBUDDY_API_KEY = apiKey;
        configuredVars.push('CODEBUDDY_API_KEY');
    }
    if (authToken) {
        process.env.CODEBUDDY_AUTH_TOKEN = authToken;
        configuredVars.push('CODEBUDDY_AUTH_TOKEN');
    }
    if (internetEnv) {
        process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
        configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
    }
    if (baseUrl) {
        process.env.CODEBUDDY_BASE_URL = baseUrl;
        configuredVars.push('CODEBUDDY_BASE_URL');
    }
    // 清除模型缓存，以便重新获取
    cachedModels = [];
    res.json({
        success: true,
        message: "\u5DF2\u8BBE\u7F6E: ".concat(configuredVars.join(', ')),
        note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
    });
});
// 获取可用模型列表
app.get("/api/models", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var session, models, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                if (!(cachedModels.length === 0)) return [3 /*break*/, 3];
                console.log("[Models] Creating session to fetch available models...");
                return [4 /*yield*/, unstable_v2_createSession({
                        cwd: process.cwd()
                    })];
            case 1:
                session = _a.sent();
                console.log("[Models] Session created, calling getAvailableModels()...");
                return [4 /*yield*/, session.getAvailableModels()];
            case 2:
                models = _a.sent();
                console.log("[Models] Got", models.length, "models");
                if (models && Array.isArray(models)) {
                    cachedModels = models;
                }
                _a.label = 3;
            case 3:
                res.json({
                    models: cachedModels.length > 0 ? cachedModels : [
                        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
                    ],
                    defaultModel: defaultModel
                });
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                console.error("[Models] Error:", error_2);
                res.json({
                    models: [
                        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
                        { modelId: "claude-opus-4", name: "Claude Opus 4" }
                    ],
                    defaultModel: defaultModel,
                    error: (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || String(error_2)
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ============= 会话 API =============
// 获取所有会话（包含消息数量）
app.get("/api/sessions", function (req, res) {
    try {
        var sessions = db.getAllSessions();
        var sessionsWithMessages = sessions.map(function (session) {
            var messages = db.getMessagesBySession(session.id);
            return __assign(__assign({}, session), { messageCount: messages.length });
        });
        res.json({ sessions: sessionsWithMessages });
    }
    catch (error) {
        console.error("[Sessions] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var session = db.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: "会话不存在" });
        }
        var messages = db.getMessagesBySession(sessionId);
        // 解析 tool_calls JSON
        var parsedMessages = messages.map(function (msg) { return (__assign(__assign({}, msg), { tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null })); });
        res.json({ session: session, messages: parsedMessages });
    }
    catch (error) {
        console.error("[Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
// 创建新会话
app.post("/api/sessions", function (req, res) {
    try {
        var _a = req.body, _b = _a.model, model = _b === void 0 ? defaultModel : _b, _c = _a.title, title = _c === void 0 ? "新对话" : _c;
        var now = new Date().toISOString();
        var session = db.createSession({
            id: uuidv4(),
            title: title,
            model: model,
            created_at: now,
            updated_at: now
        });
        res.json({ session: session });
    }
    catch (error) {
        console.error("[Create Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "创建会话失败" });
    }
});
// 更新会话
app.patch("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var _a = req.body, title = _a.title, model = _a.model;
        var success = db.updateSession(sessionId, { title: title, model: model });
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Update Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "更新会话失败" });
    }
});
// 删除会话
app.delete("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var success = db.deleteSession(sessionId);
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Delete Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "删除会话失败" });
    }
});
// ============= 聊天 API =============
// 权限响应 API
app.post("/api/permission-response", function (req, res) {
    var _a = req.body, requestId = _a.requestId, behavior = _a.behavior, message = _a.message;
    console.log("[Permission] Response received: requestId=".concat(requestId, ", behavior=").concat(behavior));
    var pending = pendingPermissions.get(requestId);
    if (!pending) {
        console.log("[Permission] Request not found: ".concat(requestId));
        return res.status(404).json({ error: "权限请求不存在或已超时" });
    }
    // 清除请求
    pendingPermissions.delete(requestId);
    if (behavior === 'allow') {
        pending.resolve({
            behavior: 'allow',
            updatedInput: pending.input
        });
    }
    else {
        pending.resolve({
            behavior: 'deny',
            message: message || '用户拒绝了此操作'
        });
    }
    res.json({ success: true });
});
// 发送消息并获取流式响应
app.post("/api/chat", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, message, model, systemPrompt, cwd, permissionMode, session, now, selectedModel, sdkSessionId, userMessageId, assistantMessageId, defaultSystemPrompt, workingDir, canUseTool, stream, fullResponse, toolCalls, newSdkSessionId, currentToolId, _loop_1, _b, stream_1, stream_1_1, e_1_1, messages, error_3, errorMessage;
    var _c, e_1, _d, _e;
    var _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, message = _a.message, model = _a.model, systemPrompt = _a.systemPrompt, cwd = _a.cwd, permissionMode = _a.permissionMode;
                // 请求日志
                console.log("\n[Chat] ========== \u65B0\u8BF7\u6C42 ==========");
                console.log("[Chat] SessionId: ".concat(sessionId));
                console.log("[Chat] Model: ".concat(model));
                console.log("[Chat] Message: ".concat(message === null || message === void 0 ? void 0 : message.slice(0, 100)).concat((message === null || message === void 0 ? void 0 : message.length) > 100 ? '...' : ''));
                console.log("[Chat] CWD: ".concat(cwd || 'default'));
                if (!message) {
                    console.log("[Chat] \u9519\u8BEF: \u6D88\u606F\u4E3A\u7A7A");
                    return [2 /*return*/, res.status(400).json({ error: "消息不能为空" })];
                }
                session = sessionId ? db.getSession(sessionId) : null;
                now = new Date().toISOString();
                if (!session) {
                    // 创建新会话
                    console.log("[Chat] \u521B\u5EFA\u65B0\u4F1A\u8BDD");
                    session = db.createSession({
                        id: sessionId || uuidv4(),
                        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
                        model: model || defaultModel,
                        sdk_session_id: null, // 稍后从 SDK 获取
                        created_at: now,
                        updated_at: now
                    });
                }
                else {
                    console.log("[Chat] \u4F7F\u7528\u73B0\u6709\u4F1A\u8BDD, SDK Session: ".concat(session.sdk_session_id || 'none'));
                }
                selectedModel = model || session.model;
                sdkSessionId = session.sdk_session_id;
                userMessageId = uuidv4();
                assistantMessageId = uuidv4();
                // 保存用户消息到数据库
                try {
                    db.createMessage({
                        id: userMessageId,
                        session_id: session.id,
                        role: 'user',
                        content: message,
                        model: null,
                        created_at: now,
                        tool_calls: null
                    });
                    console.log("[Chat] \u7528\u6237\u6D88\u606F\u5DF2\u4FDD\u5B58: ".concat(userMessageId));
                }
                catch (dbError) {
                    console.error("[Chat] \u4FDD\u5B58\u7528\u6237\u6D88\u606F\u5931\u8D25:", dbError);
                    return [2 /*return*/, res.status(500).json({ error: "保存消息失败", detail: dbError === null || dbError === void 0 ? void 0 : dbError.message })];
                }
                // 设置 SSE 头
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                defaultSystemPrompt = "你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。";
                workingDir = cwd || process.cwd();
                _g.label = 1;
            case 1:
                _g.trys.push([1, 14, , 15]);
                console.log("[Chat] \u8C03\u7528 SDK query...");
                console.log("[Chat] - Model: ".concat(selectedModel));
                console.log("[Chat] - Resume: ".concat(sdkSessionId || 'none'));
                console.log("[Chat] - CWD: ".concat(workingDir));
                console.log("[Chat] - PermissionMode: ".concat(permissionMode || 'default'));
                canUseTool = function (toolName, input, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var requestId, permissionRequest;
                    return __generator(this, function (_a) {
                        console.log("[Permission] Tool request: ".concat(toolName));
                        console.log("[Permission] Input:", JSON.stringify(input, null, 2));
                        // bypassPermissions 模式直接放行
                        if (permissionMode === 'bypassPermissions') {
                            console.log("[Permission] Bypassing permissions for ".concat(toolName));
                            return [2 /*return*/, { behavior: 'allow', updatedInput: input }];
                        }
                        requestId = uuidv4();
                        permissionRequest = {
                            requestId: requestId,
                            toolUseId: options.toolUseID,
                            toolName: toolName,
                            input: input,
                            sessionId: session.id,
                            timestamp: Date.now()
                        };
                        // 发送权限请求到前端
                        res.write("data: ".concat(JSON.stringify(__assign({ type: "permission_request" }, permissionRequest)), "\n\n"));
                        // 创建 Promise 等待用户响应
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                var pending = {
                                    resolve: resolve,
                                    reject: reject,
                                    toolName: toolName,
                                    input: input,
                                    sessionId: session.id,
                                    timestamp: Date.now()
                                };
                                pendingPermissions.set(requestId, pending);
                                // 设置超时
                                setTimeout(function () {
                                    if (pendingPermissions.has(requestId)) {
                                        pendingPermissions.delete(requestId);
                                        console.log("[Permission] Request timeout: ".concat(requestId));
                                        resolve({
                                            behavior: 'deny',
                                            message: '权限请求超时'
                                        });
                                    }
                                }, PERMISSION_TIMEOUT);
                            })];
                    });
                }); };
                stream = query({
                    prompt: message,
                    options: __assign({ cwd: workingDir, model: selectedModel, maxTurns: 10, systemPrompt: systemPrompt || defaultSystemPrompt, permissionMode: permissionMode || 'default', canUseTool: canUseTool }, (sdkSessionId ? { resume: sdkSessionId } : {}) // 使用 resume 恢复对话
                    )
                });
                fullResponse = "";
                toolCalls = [];
                newSdkSessionId = null;
                // 发送会话ID和消息ID
                res.write("data: ".concat(JSON.stringify({
                    type: "init",
                    sessionId: session.id,
                    userMessageId: userMessageId,
                    assistantMessageId: assistantMessageId,
                    model: selectedModel
                }), "\n\n"));
                currentToolId = null;
                _g.label = 2;
            case 2:
                _g.trys.push([2, 7, 8, 13]);
                _loop_1 = function () {
                    _e = stream_1_1.value;
                    _b = false;
                    var msg = _e;
                    console.log("[Stream] Message type:", msg.type, msg);
                    // 处理 system 消息，获取 SDK 的 session_id
                    if (msg.type === "system" && msg.subtype === "init") {
                        newSdkSessionId = msg.session_id;
                        console.log("[Stream] Got SDK session_id: ".concat(newSdkSessionId));
                        // 保存 SDK session_id 到数据库（如果是新的）
                        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
                            db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
                            console.log("[Stream] Saved SDK session_id to database");
                        }
                    }
                    else if (msg.type === "assistant") {
                        var content = msg.message.content;
                        if (typeof content === "string") {
                            fullResponse += content;
                            res.write("data: ".concat(JSON.stringify({ type: "text", content: content }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (var _i = 0, content_1 = content; _i < content_1.length; _i++) {
                                var block = content_1[_i];
                                if (block.type === "text") {
                                    fullResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({ type: "text", content: block.text }), "\n\n"));
                                }
                                else if (block.type === "tool_use") {
                                    currentToolId = block.id || uuidv4();
                                    var toolInput = block.input || {};
                                    console.log("[Stream] Tool use: id=".concat(currentToolId, ", name=").concat(block.name));
                                    console.log("[Stream] Tool input:", JSON.stringify(toolInput, null, 2));
                                    var toolCall = {
                                        id: currentToolId,
                                        name: block.name,
                                        input: toolInput,
                                        status: "running"
                                    };
                                    toolCalls.push(toolCall);
                                    res.write("data: ".concat(JSON.stringify({
                                        type: "tool",
                                        id: toolCall.id,
                                        name: toolCall.name,
                                        input: toolCall.input,
                                        status: toolCall.status
                                    }), "\n\n"));
                                }
                            }
                        }
                    }
                    else if (msg.type === "tool_result") {
                        // 处理工具结果（独立的消息类型）
                        var msgAny = msg;
                        var toolId_1 = msgAny.tool_use_id || currentToolId;
                        var isError = msgAny.is_error || false;
                        var content = msgAny.content;
                        console.log("[Stream] Tool result: tool_use_id=".concat(toolId_1, ", is_error=").concat(isError));
                        console.log("[Stream] Tool result content type:", typeof content);
                        console.log("[Stream] Tool result content:", typeof content === 'string' ? content.slice(0, 500) : (_f = JSON.stringify(content, null, 2)) === null || _f === void 0 ? void 0 : _f.slice(0, 500));
                        var tool = toolCalls.find(function (t) { return t.id === toolId_1; }) || toolCalls[toolCalls.length - 1];
                        if (tool) {
                            tool.status = isError ? "error" : "completed";
                            tool.isError = isError;
                            tool.result = typeof content === 'string'
                                ? content
                                : JSON.stringify(content);
                            res.write("data: ".concat(JSON.stringify({
                                type: "tool_result",
                                toolId: tool.id,
                                content: tool.result,
                                isError: isError
                            }), "\n\n"));
                        }
                        currentToolId = null;
                    }
                    else if (msg.type === "result") {
                        // 完成时确保所有工具都标记为完成
                        toolCalls.forEach(function (tool) {
                            if (tool.status === "running") {
                                tool.status = "completed";
                                res.write("data: ".concat(JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" }), "\n\n"));
                            }
                        });
                        res.write("data: ".concat(JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost }), "\n\n"));
                    }
                };
                _b = true, stream_1 = __asyncValues(stream);
                _g.label = 3;
            case 3: return [4 /*yield*/, stream_1.next()];
            case 4:
                if (!(stream_1_1 = _g.sent(), _c = stream_1_1.done, !_c)) return [3 /*break*/, 6];
                _loop_1();
                _g.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_1_1 = _g.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 13];
            case 8:
                _g.trys.push([8, , 11, 12]);
                if (!(!_b && !_c && (_d = stream_1.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _d.call(stream_1)];
            case 9:
                _g.sent();
                _g.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                // 保存助手消息到数据库
                db.createMessage({
                    id: assistantMessageId,
                    session_id: session.id,
                    role: 'assistant',
                    content: fullResponse,
                    model: selectedModel,
                    created_at: new Date().toISOString(),
                    tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
                });
                messages = db.getMessagesBySession(session.id);
                if (messages.length <= 2) {
                    db.updateSession(session.id, {
                        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
                        model: selectedModel
                    });
                }
                console.log("[Chat] \u8BF7\u6C42\u5B8C\u6210 \u2713");
                res.end();
                return [3 /*break*/, 15];
            case 14:
                error_3 = _g.sent();
                console.error("\n[Chat] ========== \u9519\u8BEF ==========");
                console.error("[Chat] Error Name:", error_3 === null || error_3 === void 0 ? void 0 : error_3.name);
                console.error("[Chat] Error Message:", error_3 === null || error_3 === void 0 ? void 0 : error_3.message);
                console.error("[Chat] Error Code:", error_3 === null || error_3 === void 0 ? void 0 : error_3.code);
                console.error("[Chat] Error Stack:", error_3 === null || error_3 === void 0 ? void 0 : error_3.stack);
                console.error("[Chat] Full Error:", JSON.stringify(error_3, null, 2));
                errorMessage = (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || "处理请求时发生错误";
                res.write("data: ".concat(JSON.stringify({ type: "error", message: errorMessage }), "\n\n"));
                res.end();
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); });
// 启动服务器
app.listen(PORT, function () {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                            \u2551\n\u2551     \u25C9 API \u670D\u52A1\u5668\u5DF2\u542F\u52A8                      \u2551\n\u2551                                            \u2551\n\u2551     \u5730\u5740: http://localhost:".concat(PORT, "            \u2551\n\u2551     \u6570\u636E\u5E93: SQLite (data/chat.db)          \u2551\n\u2551                                            \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n  "));
});
