export interface McpTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallEvent {
  sessionKey: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultEvent {
  sessionKey: string;
  toolCallId: string;
  toolName: string;
  result: string;
  isError: boolean;
}
