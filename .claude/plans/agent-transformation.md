# GP16 Agent 改造计划

## Context

当前 GP16 的 AI 功能是**单次请求-响应**模式：用户发 prompt → 队列调用 LLM → 返回布局 → 应用到画布。没有对话记忆，没有 Plan/Agent 模式区分，输出只有纯文本。

**目标**：借鉴 Claude Code 的 Agent 架构（`query.ts` 主循环 + Tool Protocol + 多种反应类型），将 GP16 改造为：
- **Plan 模式**：AI 分析需求、提出建议、反问澄清，**不修改画布**
- **Agent 模式**：AI 自主执行工具链（布局生成、分析、画布操作），**自动应用到画布**
- **多种反应类型**：thinking（思考折叠面板）、plan（计划清单）、tool_call（工具调用卡片）、response（对话气泡）等

---

## 第一步：共享类型定义

### 1.1 `packages/shared/src/index.ts`

新增类型：

```ts
// Agent 模式
export type AgentMode = 'plan' | 'agent';

// 反应类型（类比 Claude Code 的 Tool render* 方法）
export type AgentReactionType =
  | 'thinking'    // AI 推理过程（可折叠）
  | 'planning'    // 步骤计划清单
  | 'tool_call'   // 工具调用（名称+参数+状态）
  | 'tool_result' // 工具执行结果摘要
  | 'response'    // 最终回复（普通对话气泡）
  | 'error'       // 错误信息
  | 'question';   // 向用户提问（Plan 模式交互点）

// 单条 Agent 消息
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reactionType?: AgentReactionType;
  toolName?: string;      // tool_call 时使用
  toolInput?: unknown;    // 工具参数
  toolSuccess?: boolean;  // 工具执行成功/失败
  timestamp: number;
}

// 对话会话
export interface AgentConversation {
  id: string;
  mode: AgentMode;
  messages: AgentMessage[];
  topologySnapshot?: Topology; // 当前画布快照
  createdAt: number;
}
```

### 1.2 i18n 新增 key (`apps/web/src/i18n.ts`)

在 zh 和 en 两个 section 同步新增：
- `agentMode` — "Agent 模式" / "Agent Mode"
- `planMode` — "规划模式" / "Plan Mode"
- `modeSwitchTip` — "切换为规划模式：AI 会分析并给出建议，不会修改画布" / "Switch to Plan mode: AI will analyze and suggest, without modifying canvas"
- `agentThinking` — "AI 正在思考..." / "AI is thinking..."
- `agentPlanning` — "正在制定计划..." / "Creating plan..."
- `agentExecuting` — "正在执行..." / "Executing..."
- `agentApplied` — "已应用到画布" / "Applied to canvas"
- `agentQuestion` — "请确认" / "Please confirm"
- `agentError` — "执行出错" / "Execution error"
- `confirmAction` — "确认执行" / "Confirm"
- `agentWelcome` — "你好！我是光伏系统设计 Agent。\n\n**规划模式**：我会分析你的需求，给出设计建议。\n\n**Agent 模式**：我会自动生成并应用布局到画布。\n\n请告诉我你的需求，或选择下方模式切换。" / "Hello! I'm your PV System Design Agent.\n\n**Plan Mode**: I'll analyze your needs and suggest designs.\n\n**Agent Mode**: I'll auto-generate and apply layouts.\n\nTell me what you need, or switch modes below."

---

## 第二步：后端改造

### 2.1 新建 Agent Orchestrator
**文件：`apps/api/src/agent/orchestrator.ts`**

核心：借鉴 Claude Code `query.ts` 的 Agent 循环范式

```
function runAgentLoop(conversation, userInput):
  1. 构建系统提示（根据 mode 不同）
  2. 拼接历史消息 + 当前输入
  3. 调用 LLM（temperature=0.7 用于对话，0.2 用于布局生成）
  4. 解析 LLM 输出为结构化 AgentMessage[]
  5. 遍历每条消息：
     - thinking/planning/response/question → 直接追加到消息流
     - tool_call → 执行对应工具 → 追加 tool_result
  6. 如果是 agent 模式且有布局结果 → 自动应用到 conversation
  7. 返回完整 AgentMessage[]
```

系统提示词模板（两种模式不同）：
- **Plan 模式**：「你是一位资深光伏系统设计顾问。分析用户需求，给出专业建议、参数推荐、潜在风险。可以用 question 类型向用户提问确认。不要生成 layout 指令。」
- **Agent 模式**：「你是一位光伏系统设计 Agent。根据用户需求，依次执行：1) 分析需求参数 2) 调用 layout 工具生成拓扑 3) 调用 analysis 工具评估。使用 tool_call 类型记录每一步。」

### 2.2 工具注册表
**文件：`apps/api/src/agent/tools/index.ts`**

```ts
interface AgentTool {
  name: string;
  description: string;
  inputSchema: object;
  execute(input: any, context: AgentContext): Promise<any>;
}

// 注册的工具
- layout_tool:      调用现有 heuristicLayout / callLLM
- analysis_tool:    调用现有 analysis service
- validate_tool:    验证拓扑合理性（节点连接、功率匹配等）
- canvas_tool:      画布操作（clear/add/remove）
```

类比 Claude Code 的 `tools.ts` + `Tool.ts` 协议。

### 2.3 Agent 路由
**文件：`apps/api/src/routes/agent.ts`**

```
POST /api/agent/conversations    — 创建新对话
POST /api/agent/:id/message      — 发送消息，返回 AgentMessage[]（流式 SSE）
GET  /api/agent/:id              — 获取对话历史
DELETE /api/agent/:id            — 删除对话
```

使用 **Server-Sent Events (SSE)** 实现流式输出，让前端能实时显示 thinking → planning → tool_call → response 的进度。

### 2.4 修改 worker.ts
复用现有的 LLM 调用和 `heuristicLayout` 函数，将它们包装为 `AgentTool` 接口。

### 2.5 注册路由
**修改：`apps/api/src/index.ts`**
- 添加 `import agentRoutes from './routes/agent.js'`
- `await app.register(agentRoutes)`

---

## 第三步：前端改造

### 3.1 改造 AIChatPanel
**文件：`apps/web/src/ui/canvas/AIChatPanel.tsx`**

**关键改动**：

a) **模式切换按钮**：在 header 添加 Plan / Agent 切换 toggle
```tsx
<div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 3 }}>
  <button onClick={() => setMode('plan')} className={mode==='plan'?'active':''}>
    {t('planMode')}
  </button>
  <button onClick={() => setMode('agent')} className={mode==='agent'?'active':''}>
    {t('agentMode')}
  </button>
</div>
```

b) **消息类型渲染**：根据 `reactionType` 渲染不同 UI

| reactionType | 渲染方式 |
|---|---|
| `thinking` | 可折叠面板 + 脉冲动画 💭 |
| `planning` | 复选框清单（待执行/已完成） |
| `tool_call` | 工具调用卡片：图标 + 名称 + 参数 + 成功/失败状态 |
| `tool_result` | 结果摘要（绿色成功 / 红色失败） |
| `response` | 普通对话气泡（与现在相同） |
| `question` | 带确认/取消按钮的提问气泡 |
| `error` | 红色警告气泡 |
| `loading` | Spin 动画（当前行为保留） |

c) **SSE 连接**：替换轮询为 `EventSource`
```ts
const es = new EventSource(`/api/agent/${convId}/stream`);
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  setMessages(prev => [...prev, msg]);
};
```

d) **Agent 模式自动应用**：当收到 `tool_call` 类型为 layout 且成功后，自动 `setNodes()` + `setEdges()`

### 3.2 修改 CanvasPage
**文件：`apps/web/src/ui/CanvasPage.tsx`**

- 传递 `agentMode` state 给 AIChatPanel
- 可选：在 canvas 区域显示 Agent 执行状态的 Toast

### 3.3 新建 AgentMessageRenderer 组件
**文件：`apps/web/src/ui/canvas/AgentMessageRenderer.tsx`**

独立的渲染组件，负责将 `AgentMessage` 根据 `reactionType` 渲染为不同视觉元素。保持 AIChatPanel 简洁。

---

## 第四步：验证

1. `npm run build` 确认 TypeScript 编译通过
2. `npm run dev -w @gp16/web` 启动前端
3. **Plan 模式测试**：
   - 切换到 Plan 模式
   - 发送 "我想做一个 50kW 光伏 + 100kWh 储能的工商业系统"
   - 验证：AI 返回 thinking → planning → response（含建议），画布**不被修改**
4. **Agent 模式测试**：
   - 切换到 Agent 模式
   - 发送相同请求
   - 验证：AI 返回 thinking → planning → tool_call(layout) → tool_result → response，画布**自动更新**
5. **SSE 流式测试**：观察 thinking 逐步出现、tool_call 依次执行
6. **中英文切换**：验证所有新增 i18n key 正确显示

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `packages/shared/src/index.ts` — 新增 Agent 类型 |
| 修改 | `apps/web/src/i18n.ts` — 新增双语 key |
| 修改 | `apps/web/src/ui/canvas/AIChatPanel.tsx` — 模式切换 + SSE + 多类型渲染 |
| 新建 | `apps/web/src/ui/canvas/AgentMessageRenderer.tsx` — 消息渲染组件 |
| 修改 | `apps/web/src/ui/CanvasPage.tsx` — 传递 agentMode |
| 新建 | `apps/api/src/agent/orchestrator.ts` — Agent 循环编排器 |
| 新建 | `apps/api/src/agent/tools/index.ts` — 工具注册表 |
| 新建 | `apps/api/src/routes/agent.ts` — Agent REST + SSE 路由 |
| 修改 | `apps/api/src/index.ts` — 注册 agentRoutes |

---

## 架构设计核心

借鉴 Claude Code 的三大核心：

```
Claude Code:   main.tsx (装配) → QueryEngine (会话) → query (Agent循环)
GP16 Agent:    index.ts (装配) → orchestrator (会话+Agent循环) → tools (工具)
```

- `orchestrator.ts` = `QueryEngine.submitMessage()` + `query()` 的简化融合
- `tools/` = `tools.ts` + `Tool.ts` 协议的轻量版
- SSE 流式输出 = Claude Code 的 `yield` 生成器在前端的映射
