// 🤖 AI SERVICE TYPES - Shared between Frontend & Backend implementations
// This file defines the contract that both frontend and backend services must follow

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIRequest {
  message: string;
  imageData?: string; // Base64 encoded image
  imageType?: string; // "image/png" etc
  conversationId?: string;
  model?: string; // Selected AI model
}

export interface AIResponse {
  content: string;
  tokensUsed?: number;
  model: string;
  timestamp: number;
  conversationId?: string;
}

export interface AIError {
  code: string;
  message: string;
  details?: any;
}

// Abstract interface that both frontend and backend services implement
export interface IAIService {
  analyzeImageWithText(request: AIRequest): Promise<AIResponse>;
  getRemainingRequests?(): number;
  getUsageStats?(): {
    requestCount: number;
    dailyLimit: number;
    remaining: number;
    lastReset: string;
  };
}

// Cost protection settings
export interface UsageTracker {
  requestCount: number;
  dailyLimit: number;
  lastReset: string;
} 