/**
 * Tencent RTC (TRTC) Service for GranPocket
 * Provides UserSig generation and AI Conversation Bot Orchestration (via Tencent Cloud TRTC APIs)
 */

import TLSSigAPIv2 from 'tls-sig-api-v2';
import tencentcloud from 'tencentcloud-sdk-nodejs';

const TrtcClient = tencentcloud.trtc.v20190722.Client;

export interface TrtcConfig {
  sdkAppId: number;
  secretKey: string;
  tencentCloudSecretId?: string;
  tencentCloudSecretKey?: string;
  region?: string;
}

export function getTrtcConfig(): TrtcConfig {
  const sdkAppId = parseInt(process.env.TRTC_SDK_APP_ID || process.env.VITE_TRTC_SDK_APP_ID || '1400000000', 10);
  const secretKey = process.env.TRTC_SECRET_KEY || process.env.VITE_TRTC_SECRET_KEY || 'mock_trtc_secret_key_1234567890abcdef';
  const tencentCloudSecretId = process.env.TENCENTCLOUD_SECRET_ID || '';
  const tencentCloudSecretKey = process.env.TENCENTCLOUD_SECRET_KEY || '';
  const region = process.env.TENCENTCLOUD_REGION || 'ap-singapore';

  return {
    sdkAppId,
    secretKey,
    tencentCloudSecretId,
    tencentCloudSecretKey,
    region,
  };
}

/**
 * Generate UserSig for TRTC Web SDK client
 */
export function generateUserSig(userId: string, expireSeconds = 86400): { sdkAppId: number; userSig: string; isSandbox: boolean } {
  const config = getTrtcConfig();
  
  // If not configured or default placeholder, provide mock sandbox signature
  if (!process.env.TRTC_SDK_APP_ID || !process.env.TRTC_SECRET_KEY) {
    return {
      sdkAppId: config.sdkAppId,
      userSig: `mock_usersig_${Buffer.from(userId).toString('base64')}_${Date.now()}`,
      isSandbox: true,
    };
  }

  try {
    const api = new (TLSSigAPIv2 as any).Api(config.sdkAppId, config.secretKey);
    const userSig = api.genUserSig(userId, expireSeconds);
    return {
      sdkAppId: config.sdkAppId,
      userSig,
      isSandbox: false,
    };
  } catch (err) {
    console.warn('[TRTC] Failed to generate real UserSig, using fallback:', err);
    return {
      sdkAppId: config.sdkAppId,
      userSig: `mock_fallback_usersig_${Buffer.from(userId).toString('base64')}`,
      isSandbox: true,
    };
  }
}

/**
 * Start TRTC AI Conversation Agent
 * Calls StartAIConversation API on Tencent Cloud TRTC to inject an AI voice robot into the room
 */
export async function startTrtcAiConversation(params: {
  roomId: string | number;
  userId: string;
  agentUserId?: string;
  patientContext?: {
    name: string;
    age: number;
    chronicConditions?: string[];
    medications?: string[];
  };
  language?: string;
}) {
  const config = getTrtcConfig();
  const agentUserId = params.agentUserId || 'doctor_granpocket_ai';

  // Generate agent UserSig so the bot can join the room
  const agentSig = generateUserSig(agentUserId);

  const systemPrompt = `You are GranPocket's Senior Conversational Triage Doctor & Emergency Nurse.
You are in a live real-time voice call with patient: ${params.patientContext?.name || 'Patient'} (Age: ${params.patientContext?.age || 'Unknown'}).
Patient History: Conditions: ${params.patientContext?.chronicConditions?.join(', ') || 'None disclosed'}, Medications: ${params.patientContext?.medications?.join(', ') || 'None'}.
Language: ${params.language === 'zh' ? 'Mandarin Chinese' : params.language === 'ms' ? 'Bahasa Melayu' : 'English / Singaporean English (Singlish warm tone)'}.

Clinical Objectives:
1. Greet empathetically and ask for the chief complaint ("Hello! I'm Dr. GranPocket. How can I assist you or your loved one today?").
2. Ask targeted follow-up questions to understand onset, severity, location, and associated signs.
3. Check critical RED FLAGS immediately:
   - Chest pain, severe breathlessness, sudden facial droop or arm weakness, altered mental state, uncontrolled bleeding.
   - If RED FLAG present: immediately inform patient that an ambulance must be called and advise not to move.
4. Keep spoken responses concise (1-2 sentences per turn), compassionate, and easy to understand over voice.
5. In your internal reasoning, evaluate the triage severity: P1 (Resuscitation), P2 (Emergency / Serious), P3 (Urgent GP/Polyclinic), P4 (Self-care / Non-urgent).`;

  // If real Tencent Cloud API credentials are provided, call the Tencent Cloud TRTC client
  if (config.tencentCloudSecretId && config.tencentCloudSecretKey) {
    try {
      const client = new TrtcClient({
        credential: {
          secretId: config.tencentCloudSecretId,
          secretKey: config.tencentCloudSecretKey,
        },
        region: config.region,
        profile: {
          httpProfile: {
            endpoint: 'trtc.tencentcloudapi.com',
          },
        },
      });

      const requestPayload: any = {
        SdkAppId: config.sdkAppId,
        RoomId: typeof params.roomId === 'number' ? params.roomId.toString() : params.roomId,
        AgentConfig: {
          UserId: agentUserId,
          UserSig: agentSig.userSig,
          TargetUserId: params.userId,
          MaxIdleTime: 60,
          WelcomeMessage: `Hello ${params.patientContext?.name || ''}, I am your GranPocket triage doctor. Can you tell me what symptoms you are experiencing today?`,
          InterruptMode: 0, // Auto interrupt when patient speaks
        },
        LLMConfig: {
          Prompt: systemPrompt,
          Model: 'hunyuan-standard',
        },
        TTSConfig: {
          VoiceType: 101001, // Natural warm empathetic clinician voice
          Speed: 0,
        },
      };

      // Call Tencent Cloud API
      const response = await (client as any).StartAIConversation(requestPayload);
      return {
        success: true,
        taskId: response.TaskId,
        agentUserId,
        isSandbox: false,
      };
    } catch (err: any) {
      console.warn('[TRTC Cloud API] Real StartAIConversation returned error, falling back to smart simulation:', err?.message || err);
    }
  }

  // Graceful Sandbox / Simulation response when API keys are not yet configured
  return {
    success: true,
    taskId: `sim_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agentUserId,
    isSandbox: true,
    systemPrompt,
    welcomeMessage: `Hello ${params.patientContext?.name ? params.patientContext.name : 'there'}! I'm Dr. GranPocket from your triage team. I'm listening to your voice live—what symptoms are you feeling right now?`,
  };
}

/**
 * Stop TRTC AI Conversation Agent
 */
export async function stopTrtcAiConversation(taskId: string) {
  const config = getTrtcConfig();
  if (config.tencentCloudSecretId && config.tencentCloudSecretKey && !taskId.startsWith('sim_task_')) {
    try {
      const client = new TrtcClient({
        credential: {
          secretId: config.tencentCloudSecretId,
          secretKey: config.tencentCloudSecretKey,
        },
        region: config.region,
      });
      await (client as any).StopAIConversation({
        SdkAppId: config.sdkAppId,
        TaskId: taskId,
      });
      return { success: true, taskId, isSandbox: false };
    } catch (err: any) {
      console.warn('[TRTC Cloud API] StopAIConversation error:', err?.message || err);
    }
  }

  return { success: true, taskId, isSandbox: true };
}
