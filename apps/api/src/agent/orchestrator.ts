import type { AgentConversation, AgentMessage, AgentMode, AILayoutResult, Topology } from '@gp16/shared';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { AgentTool, AgentContext } from './tools/index.js';
import { layoutTool, analysisTool, validateTool } from './tools/index.js';

// ── LLM call (reused from worker.ts) ──────────────────────────────────────────

async function callLLM(
  messages: { role: string; content: string }[],
  options: { json?: boolean; temperature?: number } = {},
): Promise<string | null> {
  const base = process.env.LLM_API_BASE;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return null;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const res = await fetch(`${trimmed}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.7,
      messages: systemMsg ? [systemMsg, ...userMsgs] : userMsgs,
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;

  if (options.json) {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try { JSON.parse(cleaned); return cleaned; } catch {
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) return cleaned.slice(s, e + 1);
      return null;
    }
  }
  return text;
}

// ── System prompts ────────────────────────────────────────────────────────────

const PLAN_SYSTEM = `You are a senior photovoltaic (PV) system design consultant conducting a multi-turn conversation. You communicate in the SAME language the user uses — Chinese if they write in Chinese, English if they write in English. NEVER mix languages.

## Your role
Analyze the user's requirements, extract key parameters (capacity, load type, grid connection, storage needs), and guide them toward a complete system design through focused questions.

## IMPORTANT CONSTRAINTS — PLAN MODE ONLY
- You are in PLAN/CONSULT mode. You MUST NOT output "tool_call" or "tool_result" reaction types under any circumstance.
- Your job is to ANALYZE and RECOMMEND, not to execute or generate layouts.
- NEVER describe yourself as having generated a layout or applied anything to the canvas.
- Your "response" messages MUST NOT mention layout generation, canvas operations, device counts, connections, or topology. You are a consultant giving advice, not an operator.
- BANNED phrases in "response": "Layout generated", "placed on canvas", "devices", "connections", "topology applied", "click to edit", "drag to rearrange". Use design terminology instead: "Recommended configuration", "System design", "Suggested equipment".

## Conversation state detection
- **First interaction (no history)**: Assess how much info the user provided. If vague → ask questions. If detailed → give recommendation.
- **Follow-up (user answers your question)**: Acknowledge their answer, extract any new numbers, then give a tailored recommendation. Don't ask about things they just answered.
- **Confirmation (user says "yes"/"ok"/"确认")**: Acknowledge agreement, present the final design scheme with specific parameters, then output a question-type message asking if they want to generate the layout on canvas.

## Information extraction
From the user's message, identify:
- PV capacity (numbers followed by kW)
- Storage capacity (numbers followed by kWh)
- User type: residential/home/rooftop vs commercial/office vs industrial/factory
- Grid mode: grid-tied vs off-grid vs microgrid
- Additional needs: EV charger, data center, etc.

## Output format (JSON array, ONLY this, nothing else)
[
  {"reactionType":"thinking","content":"Your internal analysis"},
  {"reactionType":"planning","content":"Step-by-step design approach with parameters"},
  {"reactionType":"response","content":"Your recommendation — design advice ONLY, no layout/canvas language"},
  {"reactionType":"question","content":"ONE specific clarifying question, or the 'generate on canvas' prompt"}
]

## Guidelines for questions
- Ask only ONE question at a time
- Be specific: "Do you need ~10kW or ~50kW capacity?" NOT "What are your requirements?"
- If the user already provided a number, DON'T ask about it again
- Always match the user's language
- If you have enough info for a recommendation, don't ask questions — give the recommendation directly
- In follow-up responses, acknowledge what the user said before asking a new question
- When the user has confirmed/agreed to your recommendation, output a question like "是否按照以上方案在画布上生成布局？点击'在画布上执行'按钮即可。" (or English equivalent: "Shall I generate the layout on canvas based on this scheme? Click the 'Execute on Canvas' button.")

## Guidelines for response
- Include specific numbers from the user's input
- Reference their use case (residential, commercial, industrial)
- Suggest inverter type, battery chemistry, grid connection mode
- Be concise but actionable
- NEVER use words like: layout, canvas, devices, connections, topology, drag, click`;

const AGENT_SYSTEM = `You are a PV system design Agent with autonomous tool execution capabilities.

## CRITICAL RULE — LANGUAGE CONSISTENCY
- You MUST use the EXACT SAME language as the user throughout ALL reaction messages (thinking, tool_call, tool_result, response).
- If the user writes in Chinese → ALL your content must be in Chinese. If English → ALL in English.
- NEVER mix Chinese and English in a single response. NEVER switch languages mid-conversation.
- The "Conversation language" field in the prompt tells you which language to use.

## CRITICAL RULE — EXECUTE, DON'T ASK
- You are in EXECUTION mode. Your job is to GENERATE, not to consult.
- NEVER ask "是否生成" / "要不要" / "Shall I generate" / "Would you like me to". Just do it.
- NEVER output a "question" reactionType. You are not here to chat — you are here to build.
- If the user's message contains specific parameters (kW, kWh) OR a design scheme, immediately call the layout tool.
- Only if the input is truly empty or nonsensical (e.g. "asdf", "hello" with no context), output a brief thinking + question asking for parameters.

## Your role
1. Receive user requirements or a pre-planned design scheme
2. IMMEDIATELY call the layout tool to generate system topology
3. Call the analysis tool to evaluate green benefits
4. Report results

## Available tools
- layout: Generate system topology. Input: {"prompt": "User requirement description including all known parameters"}
- analysis: Analyze green benefits of current topology. Input: {}
- validate: Validate topology correctness. Input: {}

## Output format (JSON array, ONLY this)
[
  {"reactionType":"thinking","content":"Extracting parameters from design scheme..."},
  {"reactionType":"tool_call","toolName":"layout","toolInput":{"prompt":"50kW PV + 100kWh LFP storage, commercial grid-tied"},"content":"Generating layout..."},
  {"reactionType":"tool_result","toolName":"layout","toolSuccess":true,"content":"Layout generated: 5 nodes, 4 connections"},
  {"reactionType":"tool_call","toolName":"analysis","toolInput":{},"content":"Analyzing benefits..."},
  {"reactionType":"tool_result","toolName":"analysis","toolSuccess":true,"content":"Annual generation: 48000kWh, CO2 saved: 26.4t"},
  {"reactionType":"response","content":"System layout completed. PV capacity: 50kW, Storage: 100kWh. Annual generation ~48000kWh, CO2 reduction ~26.4t/year."}
]

Match the user's language (Chinese ↔ English).`;

// ── Message schema for LLM output parsing ─────────────────────────────────────

const reactionSchema = z.object({
  reactionType: z.enum(['thinking', 'planning', 'tool_call', 'tool_result', 'response', 'error', 'question']),
  content: z.string(),
  toolName: z.string().optional(),
  toolInput: z.unknown().optional(),
  toolSuccess: z.boolean().optional(),
});

// ── Heuristic response (fallback when LLM unavailable) ────────────────────────

interface ExtractedInfo {
  pvKw: number | null;
  battKwh: number | null;
  hasResidential: boolean;
  hasCommercial: boolean;
  hasIndustrial: boolean;
  hasStorage: boolean;
  hasGridTied: boolean;
  hasOffGrid: boolean;
  hasCharger: boolean;
  hasEv: boolean;
  isQuestion: boolean;
  isConfirmation: boolean;
  hasNumbers: boolean;
  answeredCapacity: boolean;
  answeredStorage: boolean;
}

function extractInfo(text: string, prevContext?: ExtractedInfo): ExtractedInfo {
  const lower = text.toLowerCase();
  const pvMatch = text.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const battMatch = text.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  return {
    pvKw: pvMatch ? Number(pvMatch[1]) : null,
    battKwh: battMatch ? Number(battMatch[1]) : null,
    hasResidential: /residential|居民|home|屋顶|rooftop|农村|village/i.test(lower),
    hasCommercial: /commercial|商业|工商业|office|商场|shop/i.test(lower),
    hasIndustrial: /industrial|工业|工厂|factory|园区|campus/i.test(lower),
    hasStorage: /storage|储能|battery|电池/i.test(lower),
    hasGridTied: /grid.?tied|并网|grid.?connected/i.test(lower),
    hasOffGrid: /off.?grid|离网|standalone|独立供电/i.test(lower),
    hasCharger: /charger|充电桩/i.test(lower),
    hasEv: /ev|electric vehicle|电动车|vehicle/i.test(lower),
    isQuestion: /[?？]/.test(text) || /^(what|how|do|can|could|would|is|are|which|whether|多少|什么|怎么|如何|是否|能不能|可不可以|好吗|行吗|需要)/i.test(lower),
    isConfirmation: /^(yes|ok|sure|confirm|go ahead|proceed|好的|确认|执行|同意|可以|没问题|行|好|yeah|yep)/i.test(lower),
    hasNumbers: /\d+(?:\.\d+)?/.test(text),
    answeredCapacity: prevContext?.pvKw === null && pvMatch !== null,
    answeredStorage: prevContext?.battKwh === null && battMatch !== null,
  };
}

function userTypeName(info: ExtractedInfo): string {
  if (info.hasIndustrial) return 'industrial';
  if (info.hasCommercial) return 'commercial';
  if (info.hasResidential) return 'residential';
  return 'general';
}

// Generate a focused follow-up question based on missing info
function generateFollowUp(info: ExtractedInfo, pvKw: number, battKwh: number): { zh: string; en: string } {
  if (info.pvKw === null) {
    return {
      zh: `装机容量大概多大？常见选项：${pvKw}kW（家用屋顶）、50kW（工商业）、200kW（大型园区）`,
      en: `What PV capacity do you need? Common options: ${pvKw}kW (residential rooftop), 50kW (commercial), 200kW (large campus)`,
    };
  }
  if (info.battKwh === null && !info.hasStorage) {
    const suggested = Math.round(pvKw * 2);
    return {
      zh: `是否需要配置储能？如果需要，建议约 ${suggested}kWh，可以作备用电源或削峰填谷。`,
      en: `Would you like energy storage? Recommended ~${suggested}kWh — useful for backup or peak shaving.`,
    };
  }
  if (!info.hasGridTied && !info.hasOffGrid) {
    return {
      zh: `接入方式是并网还是离网？并网可余电上网获收益，离网适合偏远地区独立供电。`,
      en: `Grid-tied or off-grid? Grid-tied can sell excess power; off-grid suits remote areas.`,
    };
  }
  return {
    zh: `还有什么具体需求可以补充？比如安装场地、预算范围、或者特殊功能要求。`,
    en: `Any other requirements? For example: installation site, budget range, or special features.`,
  };
}

function heuristicPlan(prompt: string, isFollowUp: boolean, prevAnswer: string | null): AgentMessage[] {
  // Try to extract context from previous answer for smarter follow-ups
  const prevContext = prevAnswer ? extractInfo(prevAnswer) : null;
  const info = extractInfo(prompt, prevContext);
  const now = Date.now();
  const user = userTypeName(info);
  const zh = isZh(prompt);

  // User answered a question with confirmation or specific info
  if (info.isConfirmation || (isFollowUp && (info.pvKw !== null || info.battKwh !== null || info.hasNumbers))) {
    const pvKw = info.pvKw ?? (prevContext?.pvKw ?? 10);
    const battKwh = info.battKwh ?? (prevContext?.battKwh ?? (info.hasStorage ? 20 : 0));
    const invType = pvKw > 50 ? 'central' : 'string';

    if (zh) {
      return [
        { id: randomUUID(), role: 'assistant', content: `收到，已更新参数`, reactionType: 'thinking', timestamp: now },
        { id: randomUUID(), role: 'assistant', content: `设计方案（${user}）：\n• 光伏装机：${pvKw} kW\n• 储能容量：${battKwh} kWh\n• 逆变器：${invType === 'central' ? '集中式' : '组串式'}，效率约 98%\n• 电池化学：LFP（磷酸铁锂），循环寿命 6000+\n• 接入方式：${info.hasOffGrid ? '离网独立供电' : '并网，余电可上网'}`, reactionType: 'planning', timestamp: now + 1 },
        { id: randomUUID(), role: 'assistant', content: `推荐 ${pvKw}kW 光伏阵列搭配 ${battKwh}kWh LFP 储能系统。\n• 组串式逆变器便于扩展，支持组串级 MPPT 优化\n• 储能可作备用电源，停电时自动切换，${battKwh > pvKw ? '大容量适合削峰填谷' : '容量可满足夜间负载'}\n• ${info.hasOffGrid ? '离网模式需确保日发电量覆盖全天负载' : '并网模式下余电可上网，获得电费收益'}\n\n预计年发电量 ~${Math.round(pvKw * 1200)} kWh`, reactionType: 'response', timestamp: now + 2 },
        { id: randomUUID(), role: 'assistant', content: '是否按照以上方案在画布上生成布局？点击"在画布上执行"按钮即可自动切换到 Agent 模式并生成拓扑。', reactionType: 'question', timestamp: now + 3 },
      ];
    }
    return [
      { id: randomUUID(), role: 'assistant', content: `Parameters received, updating design`, reactionType: 'thinking', timestamp: now },
      { id: randomUUID(), role: 'assistant', content: `Design scheme (${user}):\n• PV capacity: ${pvKw} kW\n• Storage: ${battKwh} kWh\n• Inverter: ${invType}, ~98% efficiency\n• Battery chemistry: LFP, 6000+ cycles\n• Grid mode: ${info.hasOffGrid ? 'Off-grid standalone' : 'Grid-tied with feed-in'}`, reactionType: 'planning', timestamp: now + 1 },
      { id: randomUUID(), role: 'assistant', content: `Recommended: ${pvKw}kW PV array with ${battKwh}kWh LFP storage.\n• String inverter for easy expansion, per-string MPPT optimization\n• Storage as backup — auto-switch on outage, ${battKwh > pvKw ? 'large capacity for peak shaving' : 'enough for nighttime load'}\n• ${info.hasOffGrid ? 'Off-grid mode requires generation to cover full-day load' : 'Grid-tied with feed-in revenue'}\n\nEst. annual generation ~${Math.round(pvKw * 1200)} kWh`, reactionType: 'response', timestamp: now + 2 },
      { id: randomUUID(), role: 'assistant', content: 'Would you like to generate this layout on the canvas? Click the "Execute on Canvas" button to automatically switch to Agent mode and generate the topology.', reactionType: 'question', timestamp: now + 3 },
    ];
  }

  // User provided specific numbers upfront
  if (info.pvKw !== null || info.battKwh !== null) {
    const pvKw = info.pvKw ?? 10;
    const battKwh = info.battKwh ?? (info.hasStorage ? 20 : 0);
    const invType = pvKw > 50 ? 'central' : 'string';
    const followUp = generateFollowUp(info, pvKw, battKwh);
    const needsFollowUp = info.pvKw === null || (info.battKwh === null && !info.hasStorage);

    if (zh) {
      const msgs: AgentMessage[] = [
        { id: randomUUID(), role: 'assistant', content: `分析需求：${pvKw}kW 光伏${battKwh > 0 ? ` + ${battKwh}kWh 储能` : ''}，${user} 用户`, reactionType: 'thinking', timestamp: now },
        { id: randomUUID(), role: 'assistant', content: `设计方案：\n1. ${pvKw}kW 光伏阵列（${user} 场景）\n2. ${invType === 'central' ? '集中式' : '组串式'}逆变器（效率 ~98%）${battKwh > 0 ? `\n3. ${battKwh}kWh LFP 储能（循环 6000+）` : ''}\n4. ${info.hasOffGrid ? '离网独立供电' : '并网接入'}`, reactionType: 'planning', timestamp: now + 1 },
        { id: randomUUID(), role: 'assistant', content: `建议采用 ${pvKw}kW 光伏系统${battKwh > 0 ? `搭配 ${battKwh}kWh LFP 储能` : ''}。\n• 逆变器：${invType === 'central' ? '集中式' : '组串式'}\n• ${info.hasOffGrid ? '离网模式，需确保储能满足夜间用电' : '并网模式，余电可上网获收益'}\n• 预计年发电量 ~${Math.round(pvKw * 1200)} kWh（按年利用 1200h 估算）`, reactionType: 'response', timestamp: now + 2 },
      ];
      if (needsFollowUp) {
        msgs.push({ id: randomUUID(), role: 'assistant', content: followUp.zh, reactionType: 'question', timestamp: now + 3 });
      } else {
        msgs.push({ id: randomUUID(), role: 'assistant', content: '如需按此方案在画布上自动生成拓扑，请点击"在画布上执行"按钮。', reactionType: 'question', timestamp: now + 3 });
      }
      return msgs;
    }

    const msgs: AgentMessage[] = [
      { id: randomUUID(), role: 'assistant', content: `Analyzing: ${pvKw}kW PV${battKwh > 0 ? ` + ${battKwh}kWh storage` : ''}, ${user} user`, reactionType: 'thinking', timestamp: now },
      { id: randomUUID(), role: 'assistant', content: `Design:\n1. ${pvKw}kW PV array (${user} scenario)\n2. ${invType} inverter (~98% efficiency)${battKwh > 0 ? `\n3. ${battKwh}kWh LFP storage (6000+ cycles)` : ''}\n4. ${info.hasOffGrid ? 'Off-grid standalone' : 'Grid-tied'}`, reactionType: 'planning', timestamp: now + 1 },
      { id: randomUUID(), role: 'assistant', content: `Recommendation: ${pvKw}kW PV system${battKwh > 0 ? ` with ${battKwh}kWh LFP storage` : ''}.\n• Inverter: ${invType}\n• ${info.hasOffGrid ? 'Off-grid — ensure storage covers nighttime load' : 'Grid-tied with feed-in revenue'}\n• Estimated annual generation ~${Math.round(pvKw * 1200)} kWh (1200 full-load hours)`, reactionType: 'response', timestamp: now + 2 },
    ];
    if (needsFollowUp) {
      msgs.push({ id: randomUUID(), role: 'assistant', content: followUp.en, reactionType: 'question', timestamp: now + 3 });
    } else {
      msgs.push({ id: randomUUID(), role: 'assistant', content: 'To generate this layout on the canvas, click the "Execute on Canvas" button.', reactionType: 'question', timestamp: now + 3 });
    }
    return msgs;
  }

  // Vague request — ask focused questions with options
  const q = generateFollowUp(info, 10, 20);
  if (zh) {
    return [
      { id: randomUUID(), role: 'assistant', content: `收到需求，正在分析，信息较少需要进一步确认`, reactionType: 'thinking', timestamp: now },
      { id: randomUUID(), role: 'assistant', content: `我可以帮你设计光伏系统。为给出合适方案，需要了解几个关键信息：\n1. 装机容量（kW）\n2. 是否需要储能及容量（kWh）\n3. 应用场景（居民/商业/工业）\n4. 并网或离网`, reactionType: 'planning', timestamp: now + 1 },
      { id: randomUUID(), role: 'assistant', content: `请描述你的光伏系统需求。例如："10kW 光伏 + 20kWh 储能，居民屋顶"或"50kW 光伏，工商业并网"。\n也可以点击下方快捷场景快速开始。`, reactionType: 'response', timestamp: now + 2 },
      { id: randomUUID(), role: 'assistant', content: q.zh, reactionType: 'question', timestamp: now + 3 },
    ];
  }
  return [
    { id: randomUUID(), role: 'assistant', content: `Analyzing requirements — need more details for a tailored recommendation`, reactionType: 'thinking', timestamp: now },
    { id: randomUUID(), role: 'assistant', content: `I can help design your PV system. To give a proper recommendation, I need:\n1. PV capacity (kW)\n2. Whether storage is needed (kWh)\n3. Application scenario (residential/commercial/industrial)\n4. Grid-tied or off-grid`, reactionType: 'planning', timestamp: now + 1 },
    { id: randomUUID(), role: 'assistant', content: `Please describe your system needs. For example: "10kW PV + 20kWh storage, residential rooftop" or "50kW PV, commercial grid-tied".\nOr pick a quick scenario below to get started.`, reactionType: 'response', timestamp: now + 2 },
    { id: randomUUID(), role: 'assistant', content: q.en, reactionType: 'question', timestamp: now + 3 },
  ];
}

function isZh(text: string): boolean {
  return /[一-鿿]/.test(text);
}

function heuristicAgent(prompt: string, topology?: Topology): AgentMessage[] {
  const now = Date.now();
  const info = extractInfo(prompt);
  const zh = isZh(prompt);

  // In agent mode, always generate — never ask questions
  const pvKw = info.pvKw ?? 10;
  const battKwh = info.battKwh ?? (info.hasStorage ? 20 : 0);
  const zhThinking = zh
    ? `分析需求：${pvKw}kW 光伏${battKwh > 0 ? ` + ${battKwh}kWh 储能` : ''}，正在生成布局`
    : `Analyzing: ${pvKw}kW PV${battKwh > 0 ? ` + ${battKwh}kWh storage` : ''}, generating layout`;

  return [
    { id: randomUUID(), role: 'assistant', content: zhThinking, reactionType: 'thinking', timestamp: now },
    { id: randomUUID(), role: 'assistant', content: zh ? '正在生成系统拓扑' : 'Generating system topology', reactionType: 'tool_call', toolName: 'layout', toolInput: { prompt }, timestamp: now + 1 },
    { id: randomUUID(), role: 'assistant', content: zh ? `方案已执行：${pvKw}kW 光伏系统${battKwh > 0 ? `搭配 ${battKwh}kWh 储能` : ''}已生成。` : `Scheme executed: ${pvKw}kW PV system${battKwh > 0 ? ` with ${battKwh}kWh storage` : ''} generated.`, reactionType: 'response', timestamp: now + 3 },
  ];
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runAgentLoop(
  conversation: AgentConversation,
  userInput: string,
  currentTopology?: Topology,
): Promise<{ messages: AgentMessage[]; layout?: AILayoutResult }> {
  const mode = conversation.mode;
  const now = Date.now();

  // Detect if this is a follow-up to a previous question
  const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant');
  const isFollowUp = lastAssistantMsg?.reactionType === 'question';

  // Extract context from previous messages for smarter follow-up
  const lastUserMsg = [...conversation.messages].reverse().find(m => m.role === 'user');
  const prevContext = lastUserMsg ? extractInfo(lastUserMsg.content) : null;

  // Build conversation history for LLM
  const historyText = conversation.messages
    .slice(-10) // Only last 10 messages to keep it concise
    .map(m => `[${m.reactionType ?? m.role}] ${m.content}`)
    .join('\n');

  const lang = isZh(userInput) ? 'zh' as const : 'en' as const;
  const langLabel = lang === 'zh' ? 'Chinese' : 'English';
  const prompt = `Current canvas: ${currentTopology ? `${currentTopology.nodes.length} devices, ${currentTopology.edges.length} connections` : 'Empty canvas'}\nConversation language: ${langLabel}\n\nHistory:\n${historyText}\n\nUser: ${userInput}`;

  // Try LLM first
  let llmMessages: AgentMessage[] | null = null;
  try {
    const systemPrompt = mode === 'plan' ? PLAN_SYSTEM : AGENT_SYSTEM;
    const llmResponse = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { json: true, temperature: mode === 'plan' ? 0.7 : 0.3 },
    );

    if (llmResponse) {
      const parsed = JSON.parse(llmResponse) as z.infer<typeof reactionSchema>[];
      const validated = z.array(reactionSchema).safeParse(parsed);
      if (validated.success) {
        // In plan mode, filter out tool_call/tool_result that LLM might produce
        const filtered = mode === 'plan'
          ? validated.data.filter(r => r.reactionType !== 'tool_call' && r.reactionType !== 'tool_result')
          : validated.data;

        llmMessages = filtered.map(r => ({
          id: randomUUID(),
          role: 'assistant' as const,
          content: r.content,
          reactionType: r.reactionType,
          toolName: r.toolName,
          toolInput: r.toolInput,
          toolSuccess: r.toolSuccess,
          timestamp: now + Math.random(),
        }));
      }
    }
  } catch (e) {
    console.warn('[agent][llm] error, using heuristic fallback', e);
  }

  // Fallback to heuristic (pass follow-up context for smarter responses)
  const messages = llmMessages ?? (
    mode === 'plan'
      ? heuristicPlan(userInput, isFollowUp, lastAssistantMsg?.content ?? null)
      : heuristicAgent(userInput, currentTopology)
  );

  // If agent mode and LLM produced tool_calls, execute them
  let layoutResult: AILayoutResult | undefined;
  if (mode === 'agent') {
    const toolCalls = messages.filter(m => m.reactionType === 'tool_call');
    const ctx: AgentContext = { topology: currentTopology, prompt: userInput, lang };

    for (const tc of toolCalls) {
      const tool = [layoutTool, analysisTool, validateTool].find(t => t.name === tc.toolName);
      const resultMsg: AgentMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: '',
        reactionType: 'tool_result',
        toolName: tc.toolName,
        toolSuccess: false,
        timestamp: Date.now() + Math.random(),
      };

      try {
        if (tool) {
          const result = await tool.execute((tc.toolInput as Record<string, unknown>) ?? {}, ctx);
          resultMsg.toolSuccess = true;
          resultMsg.content = result.summary;

          if (tc.toolName === 'layout' && result.data) {
            layoutResult = result.data as AILayoutResult;
            // Update context so subsequent tools (analysis/validate) see the new topology
            ctx.topology = layoutResult.topology;
          }
        } else {
          resultMsg.content = `Unknown tool: ${tc.toolName}`;
        }
      } catch (e: any) {
        resultMsg.content = `Execution failed: ${e?.message ?? e}`;
      }

      messages.push(resultMsg);
    }
  }

  return { messages, layout: layoutResult };
}

