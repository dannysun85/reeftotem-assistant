export interface AgentCapability {
  agentId: string;
  agentName: string;
  capabilities: string[];
}

export interface DelegationRequest {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  task: string;
  context?: string;
}

export interface DelegationResult {
  id: string;
  output: string;
  status: 'completed' | 'failed';
}

export interface Delegation {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  task: string;
  context?: string | null;
  status: 'pending' | 'completed' | 'failed';
  output?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
}
