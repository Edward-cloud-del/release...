// 🚨 TEMPORARY FRONTEND IMPLEMENTATION 🚨
// ==========================================
// ⚠️  WARNING: This runs OpenAI API calls from the browser (frontend)
// ⚠️  SECURITY: API key is exposed in browser - NOT suitable for production
// ⚠️  TODO: Move this entire implementation to Rust/Tauri backend
// ⚠️  MIGRATION: Replace this file with backend Tauri commands
// ==========================================

import OpenAI from 'openai';
import type { IAIService, AIRequest, AIResponse, AIServiceConfig, UsageTracker } from '../types/ai-types';
import { PromptOptimizer, type PromptContext } from './prompt-optimizer';
import { ImageOptimizer } from '../utils/image-optimizer';
import { OpenAIServiceAPI } from './openai-service-api';

export class OpenAIServiceFrontend implements IAIService {
  private client: OpenAI;
  private config: AIServiceConfig;
  private usageTracker: UsageTracker;

  constructor(config: AIServiceConfig) {
    this.config = {
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.2,
      ...config
    };

    // 🚨 SECURITY WARNING: API key exposed in browser!
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Required for frontend usage
    });
    
    // Load or initialize usage tracking for cost protection
    this.usageTracker = this.loadUsageTracker();
    
    console.warn('🚨 OpenAI Frontend Service Active - API key exposed in browser!');
    console.warn('🔧 TODO: Migrate to backend Tauri service for production');
  }

  async analyzeImageWithText(request: AIRequest): Promise<AIResponse> {
    // Cost protection check
    if (this.usageTracker.requestCount >= this.usageTracker.dailyLimit) {
      throw new Error('Daily usage limit reached. Access will be restored tomorrow.');
    }

    // Image size check (OpenAI 20MB limit)
    if (request.imageData) {
      const imageSizeKB = (request.imageData.length * 0.75) / 1024;
      if (imageSizeKB > 15000) { // 15MB safety margin
        throw new Error('Image file is too large. Please select a smaller area or reduce image size.');
      }
    }

    try {
      // ⚡ SIMPLE PROMPT for short answers
      const ocrMatch = request.message.match(/\[OCR Context - Text found in image: "(.+?)" \(Confidence: (\d+)%\)\]/);
      const ocrText = ocrMatch ? ocrMatch[1] : undefined;
      const cleanMessage = request.message.replace(/\[OCR Context[^\]]*\]/, '').trim();
      
      // Simple prompt - just question + OCR context if available
      const simplePrompt = ocrText 
        ? `${cleanMessage}\n\nText in image: "${ocrText}"`
        : cleanMessage;
      
      console.log(`⚡ Simple prompt mode for short answers`);

      // ⚡ SPEED OPTIMIZATION: Skip image processing for fast responses
      if (request.imageData) {
        const imageSizeKB = (request.imageData.length * 0.75) / 1024;
        console.log(`⚡ Fast mode: Using ${Math.round(imageSizeKB)}KB image directly (no compression)`);
      }

      const messages: any[] = [
        {
          role: "user",
          content: request.imageData ? [
            { 
              type: "text", 
              text: simplePrompt
            },
            { 
              type: "image_url", 
              image_url: { url: request.imageData }
            }
          ] : [
            {
              type: "text",
              text: simplePrompt
            }
          ]
        }
      ];

      const response = await this.client.chat.completions.create({
        model: this.config.model!,
        messages,
        max_tokens: 150, // Short answers
        temperature: 0.3, // Concise but not robotic
        stream: false // Set to true for streaming in future
      });

      // Update usage tracking
      this.usageTracker.requestCount++;
      this.saveUsageTracker();

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      console.log(`✅ OpenAI request successful (${this.usageTracker.requestCount}/${this.usageTracker.dailyLimit} today)`);
      
      return {
        content,
        tokensUsed: response.usage?.total_tokens,
        model: this.config.model!,
        timestamp: Date.now(),
        conversationId: request.conversationId
      };

    } catch (error: any) {
      // Handle specific OpenAI errors
      if (error.status === 401) {
        throw new Error('Authentication failed. Please check your API configuration.');
      } else if (error.status === 429) {
        throw new Error('Service temporarily unavailable due to high demand. Please wait and try again.');
      } else if (error.status === 413) {
        throw new Error('Image size exceeds limits. Please select a smaller area.');
      } else {
        throw new Error('Service error occurred. Please try again later.');
      }
    }
  }

  getRemainingRequests(): number {
    return this.usageTracker.dailyLimit - this.usageTracker.requestCount;
  }

  getUsageStats() {
    return {
      requestCount: this.usageTracker.requestCount,
      dailyLimit: this.usageTracker.dailyLimit,
      remaining: this.getRemainingRequests(),
      lastReset: this.usageTracker.lastReset
    };
  }

  private loadUsageTracker(): UsageTracker {
    const today = new Date().toDateString();
    const saved = localStorage.getItem('openai_usage_frontend');
    
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lastReset === today) {
        return parsed;
      }
    }
    
    // Reset daily counter
    return {
      requestCount: 0,
      dailyLimit: 100, // Conservative limit for frontend testing
      lastReset: today
    };
  }

  private saveUsageTracker(): void {
    localStorage.setItem('openai_usage_frontend', JSON.stringify(this.usageTracker));
  }
}

// 🔧 FACTORY FUNCTION - This is what the app will use
// ✅ UPDATED: Now using backend API service
export function createAIService(apiKey: string): IAIService {
  // ✅ NEW: Backend API implementation (secure)
  return new OpenAIServiceAPI();
  
  // 🚨 OLD: Frontend implementation (insecure)hbf njkcje  
  // return new OpenAIServiceFrontend({ apiKey });
}  