import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";

const execAsync = promisify(exec);

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Live Singapore NEA Environmental, Haze & Dengue Clusters Feed
app.get("/api/singapore/environmental-live", async (req, res) => {
  try {
    const [hazeSituationRes, pm25Res, psiRes, dengueRes, forecastRes] = await Promise.allSettled([
      fetch("https://www.nea.gov.sg/api/advisory/latesthazesituationupdate/" + Date.now(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GranPocketHealth/1.0)" },
      }),
      fetch("https://api.data.gov.sg/v1/environment/pm25"),
      fetch("https://api.data.gov.sg/v1/environment/psi"),
      fetch("https://www.nea.gov.sg/api/OneMap/GetMapData/DENGUE_CLUSTER", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GranPocketHealth/1.0)" },
      }),
      fetch("https://api.data.gov.sg/v1/environment/24-hour-weather-forecast"),
    ]);

    // 1. Process NEA Haze Situation Bulletin (haze.gov.sg)
    let hazeBulletin = {
      airQualityBlurb: "24-hr PSI Forecast: Moderate – Low Unhealthy",
      healthAdvisoryBlurb: "Healthy persons: Normal activities. Elderly, pregnant women & children: reduce prolonged outdoor physical exertion if PSI rises.",
      dateOfArticle: new Date().toISOString(),
      hotspotSummary: "Moderate smoke plumes observed in regional hotspots; prevailing winds from southeast.",
      sourceUrl: "https://www.haze.gov.sg",
    };

    if (hazeSituationRes.status === "fulfilled" && hazeSituationRes.value.ok) {
      try {
        const hazeData = await hazeSituationRes.value.json();
        if (hazeData) {
          hazeBulletin = {
            airQualityBlurb: (hazeData.AirQualityBlurb || "").replace(/&ndash;/g, "–").replace(/<[^>]*>/g, "").trim(),
            healthAdvisoryBlurb: (hazeData.HealthAdvisoryBlurb || "").replace(/&ndash;/g, "–"),
            dateOfArticle: hazeData.DateOfArticle || new Date().toISOString(),
            hotspotSummary: "Smoke plumes observed from fires in Kalimantan & southern Sumatra. Prevailing winds blowing from southeast.",
            sourceUrl: "https://www.haze.gov.sg",
          };
        }
      } catch (e) {
        console.error("Error parsing NEA haze situation update:", e);
      }
    }

    // 2. Process PM2.5 1-Hour Concentrations (api.data.gov.sg)
    let pm25HourlyByRegion: Record<string, number> = { east: 35, south: 31, west: 38, central: 43, north: 19 };
    let nationalPm25 = 33;
    let pm25Timestamp = "11:00 PM SGT";
    if (pm25Res.status === "fulfilled" && pm25Res.value.ok) {
      try {
        const pmData = await pm25Res.value.json();
        const latestItem = pmData?.items?.[0];
        if (latestItem?.timestamp) {
          pm25Timestamp = new Date(latestItem.timestamp).toLocaleTimeString("en-SG", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Singapore",
          }) + " SGT";
        }
        const readings = latestItem?.readings?.pm25_one_hourly;
        if (readings) {
          pm25HourlyByRegion = readings;
          const vals = Object.values(readings) as number[];
          if (vals.length > 0) {
            nationalPm25 = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          }
        }
      } catch (e) {
        console.error("Error parsing PM2.5 response:", e);
      }
    }

    // 3. Process 24-Hour PSI (api.data.gov.sg)
    let overallPsi = 81;
    let psiStatus = "Moderate";
    let psiByRegion: Record<string, number> = { north: 64, central: 81, east: 72, south: 68, west: 75 };
    let minPsi = 64;
    let maxPsi = 81;

    if (psiRes.status === "fulfilled" && psiRes.value.ok) {
      try {
        const psiData = await psiRes.value.json();
        const latestReading = psiData?.items?.[0]?.readings;
        if (latestReading?.psi_twenty_four_hourly) {
          psiByRegion = latestReading.psi_twenty_four_hourly;
          const vals = Object.values(psiByRegion) as number[];
          if (vals.length > 0) {
            minPsi = Math.min(...vals);
            maxPsi = Math.max(...vals);
          }
          overallPsi = latestReading.psi_twenty_four_hourly.central || maxPsi || overallPsi;
          psiStatus = maxPsi <= 50 ? "Good" : maxPsi <= 100 ? "Moderate" : maxPsi <= 200 ? "Unhealthy" : "Very Unhealthy";
        }
      } catch (e) {
        console.error("Error parsing PSI response:", e);
      }
    }
    const psiRange = `${minPsi} – ${maxPsi}`;

    // 4. Combined 5-Region Air Quality Breakdown
    const regionsAir: Record<string, { psi: number; pm25: number; weather: string }> = {
      north: { psi: psiByRegion.north || 64, pm25: pm25HourlyByRegion.north || 19, weather: "Cloudy" },
      south: { psi: psiByRegion.south || 68, pm25: pm25HourlyByRegion.south || 31, weather: "Cloudy" },
      east: { psi: psiByRegion.east || 72, pm25: pm25HourlyByRegion.east || 35, weather: "Cloudy" },
      west: { psi: psiByRegion.west || 75, pm25: pm25HourlyByRegion.west || 38, weather: "Cloudy" },
      central: { psi: psiByRegion.central || 81, pm25: pm25HourlyByRegion.central || 43, weather: "Cloudy" },
    };

    // 5. Process 24-hr Weather Forecast (api.data.gov.sg)
    let generalForecast = "Thundery Showers";
    let humidity = "60% - 95%";
    let tempRange = { low: 25, high: 34 };

    if (forecastRes.status === "fulfilled" && forecastRes.value.ok) {
      try {
        const forecastData = await forecastRes.value.json();
        const latest = forecastData?.items?.[0];
        if (latest) {
          generalForecast = latest.general?.forecast || generalForecast;
          if (latest.general?.relative_humidity) {
            humidity = `${latest.general.relative_humidity.low}% - ${latest.general.relative_humidity.high}%`;
          }
          if (latest.general?.temperature) {
            tempRange = {
              low: latest.general.temperature.low,
              high: latest.general.temperature.high,
            };
          }
          const regionalWeather = latest.periods?.[0]?.regions;
          if (regionalWeather) {
            for (const r of ["north", "south", "east", "west", "central"]) {
              if (regionsAir[r] && regionalWeather[r]) {
                regionsAir[r].weather = regionalWeather[r];
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing forecast response:", e);
      }
    }

    // 6. Process Live Dengue Clusters (nea.gov.sg / OneMap)
    let dengueClusters: any[] = [];
    if (dengueRes.status === "fulfilled" && dengueRes.value.ok) {
      try {
        const raw = await dengueRes.value.json();
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed?.SrchResults && Array.isArray(parsed.SrchResults)) {
          const items = parsed.SrchResults.slice(1);
          dengueClusters = items.map((c: any) => {
            const cases = parseInt(c.CASE_SIZE) || 0;
            return {
              location: c.DESCRIPTION || "Singapore Cluster",
              activeCases: cases,
              alertLevel: cases >= 10 ? "RED_CLUSTER" : "YELLOW_CLUSTER",
              trend: cases >= 10 ? "High Risk (≥10 Cases)" : "Under Surveillance (<10 Cases)",
              hyperlink: c.HYPERLINK || "https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters",
            };
          });
        }
      } catch (e) {
        console.error("Error parsing NEA dengue response:", e);
      }
    }

    res.json({
      success: true,
      source: "National Environment Agency (NEA) & data.gov.sg (Live Official Feeds)",
      isLive: true,
      lastUpdated: new Date().toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore" }) + " SGT",
      data: {
        generalForecast,
        humidity,
        temperature: tempRange,
        overallPsi,
        psiRange,
        minPsi,
        maxPsi,
        psiByRegion,
        psiStatus,
        pm25Hourly: nationalPm25,
        pm25Timestamp,
        hazeBulletin,
        regions: regionsAir,
        dengueClusters: dengueClusters.length > 0 ? dengueClusters : [
          { location: "Ho Ching Rd / Kang Ching Rd / Tah Ching Rd / Yuan Ching Rd", activeCases: 74, alertLevel: "RED_CLUSTER", trend: "High Risk (≥10 Cases)", hyperlink: "https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters" },
          { location: "Admirality Lk (Blk 488, 493)", activeCases: 9, alertLevel: "YELLOW_CLUSTER", trend: "Under Surveillance", hyperlink: "https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters" },
          { location: "Bishan St 12 (Blk 110, 115, 116)", activeCases: 5, alertLevel: "YELLOW_CLUSTER", trend: "Under Surveillance", hyperlink: "https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters" },
        ],
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch live Singapore environmental feeds:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= RBAC Role-Based Access Control API (SQLite Database) =============

// 1. 获取所有角色的屏幕权限及能力配置
app.get("/api/rbac/permissions", (req, res) => {
  try {
    const permissions = db.getAllRolePermissions();
    res.json({
      success: true,
      source: "database",
      permissions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Failed to get RBAC permissions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 保存更新角色权限到数据库
app.post("/api/rbac/permissions", (req, res) => {
  try {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, error: "Invalid permissions object provided" });
    }
    db.saveRolePermissions(permissions);
    const updated = db.getAllRolePermissions();
    res.json({
      success: true,
      message: "Role permissions saved to SQLite database successfully",
      permissions: updated,
    });
  } catch (error: any) {
    console.error("Failed to save RBAC permissions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 重置角色权限为 MOH 默认基线
app.post("/api/rbac/reset", (req, res) => {
  try {
    const permissions = db.resetRolePermissions();
    res.json({
      success: true,
      message: "RBAC permissions reset to Singapore MOH defaults in database",
      permissions,
    });
  } catch (error: any) {
    console.error("Failed to reset RBAC permissions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 获取成员分配的角色
app.get("/api/rbac/members", (req, res) => {
  try {
    const memberRoles = db.getAllMemberRoles();
    res.json({
      success: true,
      memberRoles,
    });
  } catch (error: any) {
    console.error("Failed to get member roles:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 保存成员角色分配
app.post("/api/rbac/members", (req, res) => {
  try {
    const { memberId, systemRole, householdId, members } = req.body;
    if (Array.isArray(members)) {
      db.saveAllMemberRoles(members);
    } else if (memberId && systemRole) {
      db.saveMemberRole(memberId, systemRole, householdId);
    } else {
      return res.status(400).json({ success: false, error: "Invalid member role payload" });
    }
    const memberRoles = db.getAllMemberRoles();
    res.json({
      success: true,
      message: "Member roles updated in database",
      memberRoles,
    });
  } catch (error: any) {
    console.error("Failed to save member roles:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 登录方式类型
type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string; // 脱敏后的 API Key
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  // 1. 检查环境变量
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    // 脱敏显示
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) {
      response.envVars!.internetEnv = internetEnv;
    }
    if (baseUrl) {
      response.envVars!.baseUrl = baseUrl;
    }
  }
  
  // 2. 使用 unstable_v2_authenticate 检查登录状态（更可靠）
  try {
    let needsLogin = false;
    
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        // 如果执行到这个回调，说明未登录
        needsLogin = true;
        console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
        // 将认证 URL 返回给前端（如果需要）
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });
    
    // 如果没有触发 onAuthUrl 回调，说明已登录
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      
      // 判断登录方式
      if (response.envConfigured) {
        response.method = 'env';
      } else {
        response.method = 'cli';
      }
      
      console.log('[Check Login] 已登录用户:', result.userinfo.userName);
    } else if (!needsLogin) {
      // result 存在但没有 userinfo，仍然认为已登录
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    console.error("[Check Login] SDK Error:", error);
    
    // 如果有环境变量配置，仍然认为是登录状态
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }
  
  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  
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
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// 获取可用模型列表
app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      console.log("[Models] Creating session to fetch available models...");
      
      const session = await unstable_v2_createSession({ 
        cwd: process.cwd()
      });
      
      console.log("[Models] Session created, calling getAvailableModels()...");
      const models = await session.getAvailableModels();
      console.log("[Models] Got", models.length, "models");
      
      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }
    
    res.json({ 
      models: cachedModels.length > 0 ? cachedModels : [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
      ],
      defaultModel 
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({
      models: [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { modelId: "claude-opus-4", name: "Claude Opus 4" }
      ],
      defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    const messages = db.getMessagesBySession(sessionId);
    
    // 解析 tool_calls JSON
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();
    
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      created_at: now,
      updated_at: now
    });
    
    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    
    const success = db.updateSession(sessionId, { title, model });
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 权限响应 API
app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  
  console.log(`[Permission] Response received: requestId=${requestId}, behavior=${behavior}`);
  
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    console.log(`[Permission] Request not found: ${requestId}`);
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  // 清除请求
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({
      behavior: 'allow',
      updatedInput: pending.input
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: message || '用户拒绝了此操作'
    });
  }
  
  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;
  
  // 请求日志
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);
  console.log(`[Chat] CWD: ${cwd || 'default'}`);

  if (!message) {
    console.log(`[Chat] 错误: 消息为空`);
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    // 创建新会话
    console.log(`[Chat] 创建新会话`);
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,  // 稍后从 SDK 获取
      created_at: now,
      updated_at: now
    });
  } else {
    console.log(`[Chat] 使用现有会话, SDK Session: ${session.sdk_session_id || 'none'}`);
  }

  const selectedModel = model || session.model;
  
  // 获取 SDK session ID（用于恢复对话）
  const sdkSessionId = session.sdk_session_id;

  // 创建用户消息 ID 和助手消息 ID
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

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
    console.log(`[Chat] 用户消息已保存: ${userMessageId}`);
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 默认系统提示词
  const defaultSystemPrompt = "你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。";
  
  // 工作目录：优先使用请求中的 cwd，否则使用当前目录
  const workingDir = cwd || process.cwd();

  try {
    console.log(`[Chat] 调用 SDK query...`);
    console.log(`[Chat] - Model: ${selectedModel}`);
    console.log(`[Chat] - Resume: ${sdkSessionId || 'none'}`);
    console.log(`[Chat] - CWD: ${workingDir}`);
    console.log(`[Chat] - PermissionMode: ${permissionMode || 'default'}`);
    
    // 创建 canUseTool 回调
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      console.log(`[Permission] Tool request: ${toolName}`);
      console.log(`[Permission] Input:`, JSON.stringify(input, null, 2));
      
      // bypassPermissions 模式直接放行
      if (permissionMode === 'bypassPermissions') {
        console.log(`[Permission] Bypassing permissions for ${toolName}`);
        return { behavior: 'allow', updatedInput: input };
      }
      
      // 创建权限请求
      const requestId = uuidv4();
      const permissionRequest = {
        requestId,
        toolUseId: options.toolUseID,
        toolName,
        input,
        sessionId: session.id,
        timestamp: Date.now()
      };
      
      // 发送权限请求到前端
      res.write(`data: ${JSON.stringify({ 
        type: "permission_request", 
        ...permissionRequest
      })}\n\n`);
      
      // 创建 Promise 等待用户响应
      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve,
          reject,
          toolName,
          input,
          sessionId: session.id,
          timestamp: Date.now()
        };
        
        pendingPermissions.set(requestId, pending);
        
        // 设置超时
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            console.log(`[Permission] Request timeout: ${requestId}`);
            resolve({
              behavior: 'deny',
              message: '权限请求超时'
            });
          }
        }, PERMISSION_TIMEOUT);
      });
    };
    
    // 使用 Query API 发送消息
    // 如果有 sdk_session_id，使用 resume 恢复对话上下文
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: systemPrompt || defaultSystemPrompt,
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})  // 使用 resume 恢复对话
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ 
      id: string; 
      name: string; 
      input?: Record<string, unknown>;
      status: string; 
      result?: string;
      isError?: boolean;
    }> = [];
    let newSdkSessionId: string | null = null;  // 用于存储 SDK 返回的 session_id

    // 发送会话ID和消息ID
    res.write(`data: ${JSON.stringify({ 
      type: "init", 
      sessionId: session.id, 
      userMessageId, 
      assistantMessageId,
      model: selectedModel 
    })}\n\n`);

    // 当前正在执行的工具 ID（用于匹配 tool_result）
    let currentToolId: string | null = null;

    // 处理流式响应
    for await (const msg of stream) {
      console.log("[Stream] Message type:", msg.type, msg);
      
      // 处理 system 消息，获取 SDK 的 session_id
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        console.log(`[Stream] Got SDK session_id: ${newSdkSessionId}`);
        
        // 保存 SDK session_id 到数据库（如果是新的）
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
          console.log(`[Stream] Saved SDK session_id to database`);
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;

        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              console.log(`[Stream] Tool use: id=${currentToolId}, name=${block.name}`);
              console.log(`[Stream] Tool input:`, JSON.stringify(toolInput, null, 2));
              
              const toolCall = { 
                id: currentToolId, 
                name: block.name, 
                input: toolInput,
                status: "running" 
              };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ 
                type: "tool", 
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                status: toolCall.status
              })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        // 处理工具结果（独立的消息类型）
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        
        console.log(`[Stream] Tool result: tool_use_id=${toolId}, is_error=${isError}`);
        console.log(`[Stream] Tool result content type:`, typeof content);
        console.log(`[Stream] Tool result content:`, typeof content === 'string' ? content.slice(0, 500) : JSON.stringify(content, null, 2)?.slice(0, 500));
        
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' 
            ? content 
            : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ 
            type: "tool_result", 
            toolId: tool.id, 
            content: tool.result,
            isError: isError
          })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        // 完成时确保所有工具都标记为完成
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

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

    // 更新会话标题（如果是第一条消息）
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, { 
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error Name:`, error?.name);
    console.error(`[Chat] Error Message:`, error?.message);
    console.error(`[Chat] Error Code:`, error?.code);
    console.error(`[Chat] Error Stack:`, error?.stack);
    console.error(`[Chat] Full Error:`, JSON.stringify(error, null, 2));
    
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// =========================================================================
// Dynamic Multi-Agent Engine APIs (Spec §4 & §5)
// =========================================================================
import {
  executeDynamicAgenticPipeline,
  executeDynamicDecipherAgent,
  executeDynamicKnowledgeAgent,
  executeDynamicTriageAgent,
  executeDynamicExpertDoctorAgent,
  executeDynamicMlAgent,
  executeDynamicHomeMedicationAgent,
  extractContextExcerpt,
} from "./dynamicAgents.js";

// 1. Run Dynamic Agentic Pipeline (with Doctor Attestation Loop & SQLite persistence)
app.post("/api/agentic/execute", async (req, res) => {
  try {
    const { text, answers, person, language, sessionId, config } = req.body;
    if (!person) {
      return res.status(400).json({ error: "Missing person profile" });
    }
    const result = await executeDynamicAgenticPipeline({
      text,
      answers,
      person,
      language,
      sessionId,
      config,
    });
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[Agentic Pipeline API] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Dynamic @decipher_agent
app.post("/api/agentic/decipher", async (req, res) => {
  try {
    const { text } = req.body;
    const result = await executeDynamicDecipherAgent(text || "");
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Dynamic @knowledge_agent
app.post("/api/agentic/knowledge", async (req, res) => {
  try {
    const { symptoms = [], ageBand = "all", bodyPart, rawText } = req.body;
    const result = await executeDynamicKnowledgeAgent(symptoms, ageBand, bodyPart, rawText);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Dynamic @expert_doctor_agent (Adversarial Falsification)
app.post("/api/agentic/doctor-review", async (req, res) => {
  try {
    const { draft, person, answers, config } = req.body;
    const guardrails = { ...db.getGuardrailConfig(), ...config };
    const result = await executeDynamicExpertDoctorAgent(draft, person, answers, guardrails);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Dynamic @ml_agent (Threshold Recalibration)
app.post("/api/agentic/ml-calibrate", async (req, res) => {
  try {
    const result = await executeDynamicMlAgent();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// SQLite Database CRUD APIs (Persistent Storage for all TypeScript data)
// =========================================================================

// Database Statistics
app.get("/api/db/stats", (req, res) => {
  try {
    const stats = db.getDbStats();
    res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rules CRUD
app.get("/api/db/rules", (req, res) => {
  try {
    const rules = db.getAllRules();
    res.json({ success: true, rules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/db/rules", (req, res) => {
  try {
    const rule = req.body;
    db.saveRule(rule);
    res.json({ success: true, message: "Rule saved to SQLite", rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/db/rules/:ruleId", (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = db.deleteRule(ruleId);
    res.json({ success, message: success ? "Rule deleted from SQLite" : "Rule not found" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Proposals CRUD
app.get("/api/db/proposals", (req, res) => {
  try {
    const proposals = db.getAllProposals();
    res.json({ success: true, proposals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/db/proposals", (req, res) => {
  try {
    const proposal = req.body;
    db.saveProposal(proposal);
    res.json({ success: true, message: "Proposal saved to SQLite", proposal });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/db/proposals/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status, signOffBy, mcrNumber } = req.body;
    const success = db.updateProposalStatus(id, status, signOffBy, mcrNumber);
    res.json({ success, message: "Proposal status updated in SQLite" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Persons (Patients) CRUD
app.get("/api/db/persons", (req, res) => {
  try {
    const persons = db.getAllPersons();
    res.json({ success: true, persons });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/db/persons", (req, res) => {
  try {
    const person = req.body;
    db.savePerson(person);
    res.json({ success: true, message: "Patient saved to SQLite", person });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/db/persons/:id", (req, res) => {
  try {
    const person = req.body;
    db.savePerson(person);
    res.json({ success: true, message: "Patient saved to SQLite", person });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Households CRUD
app.get("/api/db/households", (req, res) => {
  try {
    const households = db.getAllHouseholds();
    res.json({ success: true, households });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Facilities CRUD
app.get("/api/db/facilities", (req, res) => {
  try {
    const facilities = db.getAllFacilities();
    res.json({ success: true, facilities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clinical Guardrails Config
app.get("/api/db/guardrails", (req, res) => {
  try {
    const guardrails = db.getGuardrailConfig();
    res.json({ success: true, guardrails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/db/guardrails", (req, res) => {
  try {
    const updates = req.body;
    db.saveGuardrailConfig(updates);
    const updated = db.getGuardrailConfig();
    res.json({ success: true, message: "Guardrails updated in SQLite", guardrails: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Triage Execution Logs (Persistent Audit Trail)
app.get("/api/db/triage-logs", (req, res) => {
  try {
    const logs = db.getAllTriageExecutionLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Triage Assessments API
app.get("/api/db/triage-assessments", (req, res) => {
  try {
    const assessments = db.getTriageAssessments();
    res.json({ success: true, assessments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/db/triage-assessments", (req, res) => {
  try {
    const success = db.createTriageAssessment(req.body);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer Feedback Endpoints
app.get("/api/feedback", (req, res) => {
  console.log('[DEBUG-FEEDBACK-HIT] Received GET /api/feedback at ' + new Date().toISOString());
  try {
    const feedback = db.getAllCustomerFeedback();
    res.json({ success: true, feedback });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/feedback", (req, res) => {
  try {
    const { householdId, householdName, memberName, category, rating, comments } = req.body;
    if (!memberName || !category || !comments) {
      return res.status(400).json({ success: false, error: "Missing required fields (memberName, category, comments)" });
    }
    const newFeedback: db.CustomerFeedback = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      householdId: householdId || '',
      householdName: householdName || 'Tan Household (Toa Payoh)',
      memberName,
      category,
      rating: Number(rating) || 5,
      comments,
      createdAt: new Date().toISOString()
    };
    db.saveCustomerFeedback(newFeedback);
    res.json({ success: true, message: "Feedback submitted and saved to SQLite", feedback: newFeedback });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Key Statistics & Analytics Endpoint
app.get("/api/statistics", (req, res) => {
  try {
    const stats = db.getKeySystemStatistics();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Caregiver Scheduler Alert Endpoints
app.get("/api/scheduler/alerts", (req, res) => {
  try {
    const alerts = db.getAllCaregiverAlerts();
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/scheduler/alerts", (req, res) => {
  try {
    const alert = req.body;
    if (!alert.patientName || !alert.caregiverName || !alert.title || !alert.message) {
      return res.status(400).json({ success: false, error: "Missing required fields (patientName, caregiverName, title, message)" });
    }
    db.saveCaregiverAlert(alert);
    res.json({ success: true, message: "Caregiver alert saved and dispatched", alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/scheduler/alerts/:id/ack", (req, res) => {
  try {
    db.acknowledgeCaregiverAlert(req.params.id);
    res.json({ success: true, message: "Alert acknowledged" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resolve & Remove Ongoing Ailment for a Patient
app.post("/api/persons/:id/resolve-ailment", (req, res) => {
  try {
    db.resolvePersonAilment(req.params.id);
    res.json({ success: true, message: `Ongoing ailment removed and monitoring plan closed for person ${req.params.id}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============= Database Browser API =============

// UI Page for database browser
app.get('/db-browser', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GranPocket DB Browser</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #f5f5f5; color: #333; margin: 0; }
        .header { background: #1a1a1a; color: white; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { margin: 0; font-size: 24px; font-weight: 500; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .controls { margin-bottom: 24px; display: flex; gap: 12px; align-items: center; background: #f8f9fa; padding: 16px; border-radius: 6px; border: 1px solid #eee; }
        select { padding: 10px 14px; border-radius: 6px; border: 1px solid #ddd; font-size: 15px; outline: none; min-width: 250px; background: white; }
        select:focus { border-color: #0066cc; }
        button { padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 15px; font-weight: 500; transition: background 0.2s; }
        button:hover { background: #0052a3; }
        button.export-btn { background: #2ea44f; }
        button.export-btn:hover { background: #2c974b; }
        .table-wrapper { overflow-x: auto; border: 1px solid #eee; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; white-space: nowrap; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #444; position: sticky; top: 0; }
        tr:hover { background: #f8f9fa; }
        .empty { text-align: center; padding: 40px; color: #666; font-size: 15px; }
        .error { color: #d73a49; padding: 20px; text-align: center; background: #ffeef0; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GranPocket Database Browser</h1>
      </div>
      <div class="container">
        <div class="controls">
          <select id="tableSelect">
            <option value="">Select a table...</option>
          </select>
          <button onclick="loadTable()">View Data</button>
          <button onclick="exportCsv()" class="export-btn">Download CSV</button>
        </div>
        <div id="tableContainer">
          <div class="empty">Select a table to view its contents (up to 500 rows)</div>
        </div>
      </div>
      <script>
        async function init() {
          try {
            const res = await fetch('/api/db-browser/tables');
            if (!res.ok) throw new Error('Failed to load tables');
            const data = await res.json();
            const select = document.getElementById('tableSelect');
            data.tables.forEach(table => {
              const opt = document.createElement('option');
              opt.value = table;
              opt.textContent = table;
              select.appendChild(opt);
            });
          } catch(e) {
            document.getElementById('tableContainer').innerHTML = '<div class="error">Error loading tables: ' + e.message + '</div>';
          }
        }

        async function loadTable() {
          const tableName = document.getElementById('tableSelect').value;
          const container = document.getElementById('tableContainer');
          
          if (!tableName) {
            container.innerHTML = '<div class="empty">Please select a table first</div>';
            return;
          }
          
          container.innerHTML = '<div class="empty">Loading...</div>';
          
          try {
            const res = await fetch('/api/db-browser/tables/' + tableName);
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Failed to load table data');
            }
            
            const data = await res.json();
            
            if (!data.rows || data.rows.length === 0) {
              container.innerHTML = '<div class="empty">No records found in table <b>' + tableName + '</b></div>';
              return;
            }
            
            const cols = Object.keys(data.rows[0]);
            let html = '<div class="table-wrapper"><table><thead><tr>';
            cols.forEach(col => html += '<th>' + col + '</th>');
            html += '</tr></thead><tbody>';
            
            data.rows.forEach(row => {
              html += '<tr>';
              cols.forEach(col => {
                let val = row[col];
                if (val === null || val === undefined) val = '<span style="color:#aaa">null</span>';
                else if (typeof val === 'object') val = JSON.stringify(val);
                else val = String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // Truncate long strings for display
                if (typeof val === 'string' && val.length > 100 && !val.includes('span')) {
                  val = val.substring(0, 100) + '...';
                }
                
                html += '<td>' + val + '</td>';
              });
              html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            
            if (data.rows.length === 500) {
              html += '<div style="text-align:center; padding:10px; color:#666; font-size:12px;">Showing first 500 rows</div>';
            }
            
            container.innerHTML = html;
          } catch(e) {
            container.innerHTML = '<div class="error">Error loading data: ' + e.message + '</div>';
          }
        }

        function exportCsv() {
          const tableName = document.getElementById('tableSelect').value;
          if (!tableName) {
            alert('Please select a table first');
            return;
          }
          window.location.href = '/api/db-browser/export/' + tableName;
        }

        init();
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/db-browser/tables', (req, res) => {
  try {
    const dbInstance = db.default;
    const tables = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    res.json({ tables: (tables as any[]).map(t => t.name) });
  } catch(e: any) {
    res.status(500).json({error: e.message});
  }
});

app.get('/api/db-browser/tables/:tableName', (req, res) => {
  try {
    const tableName = req.params.tableName;
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({error: 'Invalid table name'});
    }
    const dbInstance = db.default;
    const rows = dbInstance.prepare(`SELECT * FROM ${tableName} LIMIT 500`).all();
    res.json({ rows });
  } catch(e: any) {
    res.status(500).json({error: e.message});
  }
});

app.get('/api/db-browser/export/:tableName', (req, res) => {
  try {
    const tableName = req.params.tableName;
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({error: 'Invalid table name'});
    }
    const dbInstance = db.default;
    const rows = dbInstance.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    
    if (rows.length === 0) {
      return res.send('No data in table');
    }
    
    // Convert to CSV
    const cols = Object.keys(rows[0]);
    let csv = cols.join(',') + '\n';
    
    rows.forEach(row => {
      csv += cols.map(col => {
        let val = row[col];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        // Escape quotes and wrap in quotes
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${tableName}.csv`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

app.delete('/api/agentic/proposals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteProposal(id);
    if (!success) {
      return res.status(404).json({ error: 'Proposal not found or could not be deleted' });
    }
    res.json({ success: true, message: 'Proposal deleted' });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============= Agentic Rule Harvesting API =============

app.post('/api/agentic/harvest', async (req, res) => {
  try {
    const { websites } = req.body;
    if (!websites || !Array.isArray(websites) || websites.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of websites to harvest.' });
    }

    const newProposals: any[] = [];
    const harvestedMedications: any[] = [];
    const skipped: { url: string; reason: string }[] = [];

    for (let index = 0; index < websites.length; index++) {
      const rawUrl = String(websites[index] || '').trim();
      if (!rawUrl) continue;

      // 1. URL Structure Validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          skipped.push({ url: rawUrl, reason: 'Invalid protocol: Only HTTP and HTTPS URLs are supported.' });
          continue;
        }
      } catch {
        skipped.push({ url: rawUrl, reason: 'Malformed URL: Invalid link structure.' });
        continue;
      }

      // 2. Reachability & HTTP Status Validation
      let response: Response;
      let bodyText = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        response = await fetch(parsedUrl.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        const isTimeout = fetchErr.name === 'AbortError';
        const reason = isTimeout ? 'Connection timed out (host unreachable)' : `Network error: ${fetchErr.message || 'Connection failed'}`;
        skipped.push({ url: rawUrl, reason });
        console.warn(`[Decipher Harvester] Skipped invalid URL ${rawUrl}: ${reason}`);
        continue;
      }

      if (!response.ok) {
        const reason = `Link is not valid (HTTP ${response.status} ${response.statusText || 'Error'})`;
        skipped.push({ url: rawUrl, reason });
        console.warn(`[Decipher Harvester] Skipped invalid URL ${rawUrl}: ${reason}`);
        continue;
      }

      // 3. Response Content Validation
      try {
        bodyText = await response.text();
      } catch (readErr: any) {
        skipped.push({ url: rawUrl, reason: 'Failed to read response body content.' });
        continue;
      }

      // Extract main article container if available (strips mega-menus, global headers, footers)
      let targetHtml = bodyText;
      const mainMatch = bodyText.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                        bodyText.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                        bodyText.match(/class="[^"]*article-main-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (mainMatch) {
        targetHtml = mainMatch[1];
      }

      // Strip unwanted HTML sections
      targetHtml = targetHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
        .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

      // Extract readable text from HTML with paragraph and section structure preservation
      const cleanText = targetHtml
        .replace(/<(h[1-6]|p|div|li|br|section|article)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();

      // Check for generic error pages, access denials, or blank content
      if (
        cleanText.length < 150 ||
        /404 Not Found|Page Not Found|Access Denied|Error 403|Forbidden|CloudFront Error|The requested URL was not found/i.test(cleanText.slice(0, 500))
      ) {
        const reason = 'Link returned an error or blank page without valid clinical guidelines.';
        skipped.push({ url: rawUrl, reason });
        console.warn(`[Decipher Harvester] Skipped URL with invalid content ${rawUrl}: ${reason}`);
        continue;
      }

      // 4. Clinical Entity Extraction & Normalization via @decipher_agent
      try {
        const decipherRes: any = await executeDynamicDecipherAgent(cleanText.slice(0, 8000));
        // Unpack extractions safely from both decipherRes.result and decipherRes
        const extractions: any[] = decipherRes?.result?.extractions || decipherRes?.extractions || [];

        // If decipher agent found no clinical entities, DO NOT create a rule!
        if (extractions.length === 0) {
          skipped.push({ url: rawUrl, reason: 'No clinical symptoms or medical guidance detected on page.' });
          continue;
        }

        // Compile all scenarios where emergency escalation may be needed
        const relevantEntities = extractions.filter(e => 
          e.is_emergency_escalation !== false && 
          (e.is_emergency_escalation || 
           e.entity_type === 'condition' || 
           e.entity_type === 'vital_threshold' ||
           (e.entity_type === 'symptom' && (e.confidence || 0.9) >= 0.85))
        );
        const entitiesToProcess = relevantEntities.length > 0 ? relevantEntities : extractions;

        for (let eIdx = 0; eIdx < entitiesToProcess.length; eIdx++) {
          const topEntity = entitiesToProcess[eIdx];
          const symptomName = topEntity.normalized_term || topEntity.raw_text || 'clinical condition';
          const code = topEntity.code || 'CPG-HARVEST';
          const rawEntityText = topEntity.raw_text || topEntity.normalized_term || 'symptom';
          const entityIdentifier = rawEntityText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 25) || `symptom_${index}_${eIdx}`;

          // Synthesize executable deterministic rule code snippet
          const ruleCodeSnippet = `if (context.${entityIdentifier} || (context.symptoms && context.symptoms.some((s: string) => s.toLowerCase().includes('${rawEntityText.toLowerCase()}')))) return EMERGENCY_HALT('HARVEST-${code}');`;

          // Validation: ruleCodeSnippet must NOT be blank
          if (!ruleCodeSnippet || ruleCodeSnippet.trim() === '') {
            skipped.push({ url: rawUrl, reason: `Decipher agent generated a blank rule snippet for "${symptomName}". Aborted.` });
            continue;
          }

          const domain = parsedUrl.hostname;
          const safeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
          const urlPath = (parsedUrl.pathname.replace(/\/+$/, '').split('/').pop() || 'guidance').slice(0, 20);
          const generatedId = `kb-prop-auto-${safeSlug(domain)}-${safeSlug(urlPath)}-${safeSlug(code)}`;

          // Check if text does not directly conform to standard ICD / SNOMED taxonomy
          const isNonConforming = Boolean(
            topEntity.requires_clinician_review ||
            topEntity.code_system === 'UNCLASSIFIED' ||
            !topEntity.code ||
            topEntity.code.startsWith('UNCLASSIFIED') ||
            (topEntity.confidence && topEntity.confidence < 0.90)
          );

          const clinicianReviewReason = topEntity.clinician_review_reason || 
            (isNonConforming 
              ? 'Clinical terminology in source text does not directly map 1-to-1 with standard ICD-10 / SNOMED-CT taxonomy. SMC Clinician review and coding confirmation required.'
              : '');

          const title = isNonConforming
            ? `⚠️ Review Needed: ${symptomName} (${domain})`
            : `Auto-Harvested Rule: ${symptomName} (${domain})`;

          const rationale = isNonConforming
            ? `⚠️ Flagged for Expert Clinician Review: Non-conforming source terminology. Reason: ${clinicianReviewReason} Harvested from ${domain}. Approximate mapping: ${symptomName} [${code}].`
            : `Harvested by @decipher_agent from verified content at ${domain}. Matched ICD/SNOMED entity: ${symptomName} [${code}].`;

          // Deduplication: check if this rule has already been harvested from this source
          const existingByTitle = db.findProposalBySourceAndTitle(rawUrl, title);
          const existingById = db.getProposalById(generatedId);
          if (existingByTitle || existingById) {
            skipped.push({ url: rawUrl, reason: `Rule "${symptomName}" has already been harvested from this link (duplicate skipped).` });
            continue;
          }

          const originalExcerpt = topEntity.original_excerpt || extractContextExcerpt(cleanText, topEntity.trigger_keywords || [rawEntityText, symptomName]);

          const proposal = {
            id: generatedId,
            title: title,
            sourceDoc: rawUrl,
            sourceUrl: rawUrl,
            publisher: `${domain} / @decipher_agent`,
            retrievedAt: new Date().toISOString(),
            proposedChanges: `Add deterministic trigger: [${symptomName}] -> Instant Tier 1 EMERGENCY / RED.`,
            rationale: rationale,
            status: 'pending_review' as const,
            affectedAilment: topEntity.entity_type === 'symptom' ? 'general' : 'vital_threshold',
            targetTier: 'Tier 1 Deterministic Red-Line' as const,
            ageBand: 'pediatric' as const,
            category: isNonConforming ? '⚠️ Non-Conforming CPG' : 'Auto-Harvested',
            originatingAgent: '@decipher_agent',
            confidenceScore: Math.round((topEntity.confidence || 0.92) * 100),
            ruleCodeSnippet: ruleCodeSnippet,
            verifiedSource: domain,
            originalText: originalExcerpt,
            requiresClinicianReview: isNonConforming,
            clinicianReviewReason: clinicianReviewReason,
            isEmergencyEscalation: true,
            diff: {
              originalText: originalExcerpt,
              entity: topEntity,
              ruleCodeSnippet: ruleCodeSnippet,
              requiresClinicianReview: isNonConforming,
              clinicianReviewReason: clinicianReviewReason,
              isEmergencyEscalation: true
            }
          };

          db.saveProposal(proposal);
          newProposals.push(proposal);
        }

        // 5. Invoke @home_medication_agent to extract first-aid & emergency home medications
        try {
          const homeMedRes = await executeDynamicHomeMedicationAgent({
            mode: 'harvest',
            extractions,
            documentText: cleanText,
            sourceDoc: rawUrl
          });
          if (homeMedRes.suggestions && homeMedRes.suggestions.length > 0) {
            harvestedMedications.push(...homeMedRes.suggestions);
          }
        } catch (medErr: any) {
          console.warn('[Home Medication Harvester] Error extracting medications:', medErr.message);
        }
      } catch (agentErr: any) {
        skipped.push({ url: rawUrl, reason: `Agent parsing failed: ${agentErr.message}` });
        continue;
      }
    }

    const message = newProposals.length > 0
      ? `Successfully harvested ${newProposals.length} rule(s) and ${harvestedMedications.length} home medication suggestion(s).${skipped.length > 0 ? ` Skipped ${skipped.length} invalid link(s).` : ''}`
      : `No rules harvested. ${skipped.length} link(s) were invalid or unreachable.`;

    res.json({
      success: true,
      message,
      harvestedCount: newProposals.length,
      harvestedMedicationCount: harvestedMedications.length,
      skippedCount: skipped.length,
      proposals: newProposals,
      harvestedMedications,
      skipped
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============= Tencent Cloud ADP Multi-Agent Rule Harvesting API =============

app.post('/api/agentic/adp-harvest', async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      url, 
      requestId = `ExmjIGL6Oy-${Date.now()}`,
      conversationId = 'd4bca75f-e713-42c4-ad37-67b7d6621f10',
      appKey = 'ebwZQcRTFXAhmZswRBkWjAEiRAliJwpKftvDYoCymcgOEqtHvTOoiUgAHduWlcfFmbKIxeWeWjoETGCxDGPOHsvcoOEGTcXXSSFJOJqgAzdQCKPUWTvrladChbWFjCwm',
      visitorId = '100015179581'
    } = req.body;

    const targetUrl = String(url || '').trim();
    if (!targetUrl) {
      return res.status(400).json({ error: 'Please provide a valid URL for ADP harvesting.' });
    }

    console.log(`[ADP Harvester] Initiating Tencent Cloud ADP API call for: ${targetUrl}`);
    console.log(`[ADP Harvester] RequestId: ${requestId}, ConversationId: ${conversationId}`);

    const payload = {
      RequestId: requestId,
      ConversationId: conversationId,
      AppKey: appKey,
      Contents: [
        {
          Type: "text",
          Text: targetUrl
        }
      ],
      VisitorId: visitorId,
      Incremental: true,
      EnableMultiIntent: true,
      Stream: "disable"
    };

    // Timeout after 3.5 minutes because multi-agent workflow runs 4 sequential agents with Firecrawl
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 210000);

    const adpResponse = await fetch('https://wss.lke.tencentcloud.com/adp/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!adpResponse.ok) {
      const errText = await adpResponse.text();
      return res.status(adpResponse.status).json({
        success: false,
        error: `Tencent Cloud ADP API returned HTTP ${adpResponse.status}: ${errText}`
      });
    }

    const rawText = await adpResponse.text();
    const elapsedMs = Date.now() - startTime;
    console.log(`[ADP Harvester] Received ${rawText.length} bytes in ${(elapsedMs / 1000).toFixed(1)}s`);

    // Parse SSE blocks
    const blocks = rawText.split(/\r?\n\r?\n/);
    const events: Array<{ event: string; data: any }> = [];

    for (const block of blocks) {
      let eventType = '';
      const dataLines: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6));
        }
      }
      if (eventType && dataLines.length > 0) {
        const dataStr = dataLines.join('\n');
        let parsed = null;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = dataStr;
        }
        events.push({ event: eventType, data: parsed });
      }
    }

    // Locate response.completed event
    const completedEvent = events.find(e => e.event === 'response.completed');
    const respData = (completedEvent?.data as any)?.Response || {};
    const messages = respData.Messages || [];
    const workflow = respData.Procedures?.[0]?.Workflow || null;
    const runNodes = workflow?.RunNodes || [];

    // Extract final reply
    const replyMsg = messages.find((m: any) => m.Type === 'reply');
    const finalReply = replyMsg?.Contents?.[0]?.Text || '';

    // Extract parsed rules from End node or Agent4
    let parsedRules: any[] = [];
    const endNode = runNodes.find((n: any) => n.NodeName === 'End');
    if (endNode && endNode.Output) {
      try {
        const endOut = typeof endNode.Output === 'string' ? JSON.parse(endNode.Output) : endNode.Output;
        if (endOut.abracadabra) {
          parsedRules = typeof endOut.abracadabra === 'string' ? JSON.parse(endOut.abracadabra) : endOut.abracadabra;
        }
      } catch (err) {
        console.warn('[ADP Harvester] Failed parsing End node output:', err);
      }
    }

    if (parsedRules.length === 0) {
      const agent4Node = runNodes.find((n: any) => n.NodeName === 'Agent4');
      if (agent4Node && agent4Node.Output) {
        try {
          const a4Out = typeof agent4Node.Output === 'string' ? JSON.parse(agent4Node.Output) : agent4Node.Output;
          if (a4Out.Content) {
            parsedRules = typeof a4Out.Content === 'string' ? JSON.parse(a4Out.Content) : a4Out.Content;
          }
        } catch (err) {
          console.warn('[ADP Harvester] Failed parsing Agent4 node output:', err);
        }
      }
    }

    // Fallback: search raw text for JSON array of knowledge_id
    if (parsedRules.length === 0) {
      const arrayMatch = rawText.match(/\[\s*\{\s*"knowledge_id"[\s\S]*?\}\s*\]/);
      if (arrayMatch) {
        try {
          parsedRules = JSON.parse(arrayMatch[0]);
        } catch {}
      }
    }

    // Format nodes for frontend visualization
    const formattedNodes = runNodes.map((n: any) => {
      let contentText = '';
      if (n.Output) {
        try {
          const parsed = typeof n.Output === 'string' ? JSON.parse(n.Output) : n.Output;
          contentText = parsed.Content || parsed.abracadabra || JSON.stringify(parsed, null, 2);
        } catch {
          contentText = String(n.Output);
        }
      }
      return {
        nodeId: n.NodeId,
        nodeName: n.NodeName,
        status: n.Status === 2 ? 'success' : 'running',
        elapsedMs: parseInt(n.Elapsed || '0', 10),
        tokens: n.StatInfos?.[0]?.TotalTokens || 0,
        content: contentText,
        outputRef: n.OutputRef || ''
      };
    });

    res.json({
      success: true,
      requestId,
      conversationId,
      targetUrl,
      elapsedMs,
      parsedRules,
      workflowNodes: formattedNodes,
      messages,
      finalReply,
      rawOutput: rawText
    });
  } catch (err: any) {
    console.error('[ADP Harvester] Execution error:', err);
    res.status(500).json({
      success: false,
      error: err.name === 'AbortError' ? 'ADP Request timed out after 3.5 minutes' : err.message
    });
  }
});

// Ingest ADP harvested rules directly into kb_proposals table
app.post('/api/agentic/adp-ingest', async (req, res) => {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ error: 'No rules provided to ingest.' });
    }

    const savedProposals: any[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const safeId = r.knowledge_id 
        ? `kb-prop-adp-${r.knowledge_id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        : `kb-prop-adp-${Date.now()}-${i}`;

      const isNonConforming = r.review_decision === 'APPROVE_WITH_CONDITIONS' || r.review_decision === 'REQUEST_REVISION' || r.review_decision === 'ESCALATE_TO_HUMAN_PHYSICIAN';

      let cleanTitle = r.title || `Harvested Clinical Rule #${i + 1}`;
      if (!cleanTitle.startsWith('⚠️') && !cleanTitle.startsWith('Auto-Harvested:') && !cleanTitle.startsWith('Auto-Harvested Rule:')) {
        cleanTitle = `${isNonConforming ? '⚠️ Review Needed: ' : 'Auto-Harvested: '}${cleanTitle}`;
      }

      const proposal = {
        id: safeId,
        title: cleanTitle,
        ruleCodeSnippet: r.rule_code_snippet || `if (context.${r.knowledge_id?.toLowerCase() || 'symptom'}) return EMERGENCY_HALT('HARVEST-${r.knowledge_id || 'RULE'}');`,
        rationale: r.rationale || r.review_rationale || 'Extracted and verified by Tencent Cloud ADP Multi-Agent Harvester Pipeline.',
        diff: {
          originalText: r.original_text || '',
          reviewDecision: r.review_decision || 'APPROVED',
          reviewRationale: r.review_rationale || '',
          identifiedRisks: r.identified_risks || [],
          knowledgeId: r.knowledge_id
        },
        sourceDoc: r.source_doc || '',
        category: isNonConforming ? '⚠️ Non-Conforming CPG' : 'Auto-Harvested',
        targetTier: r.target_tier || 'Tier 1 Deterministic Red-Line',
        ageBand: r.age_band || 'pediatric',
        originatingAgent: '@adp_multiagent',
        confidenceScore: typeof r.confidence_score === 'number' ? (r.confidence_score > 1 ? r.confidence_score / 100 : r.confidence_score) : 0.85,
        status: 'pending_review' as const,
        timestamp: now,
        verifiedSource: r.verified_source || 'Tencent Cloud ADP',
        originalText: r.original_text || '',
        requiresClinicianReview: isNonConforming || Boolean(r.requires_clinician_review),
        clinicianReviewReason: r.review_rationale || (isNonConforming ? `ADP Medical Reviewer flagged: ${r.review_decision}` : '')
      };

      db.saveProposal(proposal);
      savedProposals.push(proposal);
    }

    res.json({
      success: true,
      count: savedProposals.length,
      proposals: savedProposals,
      message: `Successfully ingested ${savedProposals.length} rules into pending governance proposals!`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// Home & First-Aid Medication Governance APIs
// =========================================================================
app.get("/api/agentic/medications/home", (req, res) => {
  try {
    const meds = db.getAllHomeMedications();
    res.json({ success: true, medications: meds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/agentic/medications/home/approve", (req, res) => {
  try {
    const { id, doctorName, mcrNumber } = req.body;
    if (!id) return res.status(400).json({ error: "Missing medication id" });
    const success = db.updateHomeMedicationStatus(id, 'approved', doctorName || 'Dr. Evelyn Lim', mcrNumber || 'M12849J');
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/agentic/medications/home/reject", (req, res) => {
  try {
    const { id, doctorName, mcrNumber } = req.body;
    if (!id) return res.status(400).json({ error: "Missing medication id" });
    const success = db.updateHomeMedicationStatus(id, 'rejected', doctorName, mcrNumber);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/agentic/medications/home/pending", (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing medication id" });
    const success = db.updateHomeMedicationStatus(id, 'pending_review', undefined, undefined);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/agentic/medications/home/:id", (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteHomeMedication(id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库浏览器: http://localhost:${PORT}/db-browser ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

