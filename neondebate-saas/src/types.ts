export interface Agent {
  id: string;
  name: string;
  persona: string;
  color: string;
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
}

export interface Article {
  body: string;
  summaryPoints: string[];
}

export interface DebateConfig {
  topic: string;
  rounds: number;
  agent1: Agent;
  agent2: Agent;
  moderatorPersona?: string;
}

export interface DebateState {
  config: DebateConfig;
  status: 'idle' | 'running' | 'paused' | 'completed';
  currentRound: number;
  currentSpeakerId: string | null;
  history: Message[];
  article: Article;
}
