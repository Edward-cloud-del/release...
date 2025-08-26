import type { IAIService, AIRequest, AIResponse } from '../types/ai-types';
import userService from "./user-service";
import { authService } from "./auth-service-db";
import { invoke } from "@tauri-apps/api/core";

export class OpenAIServiceAPI implements IAIService {
  private apiUrl: string;

  constructor(config: { apiUrl?: string } = {}) {
    this.apiUrl = config.apiUrl || this.getAPIUrl();
    console.log('🔧 OpenAI API Service - Calling backend at:', this.apiUrl);
  }

  private getAPIUrl(): string {
    return 'https://api.finalyze.pro/api/analyze';
  }

  /**
   * Normaliserar LaTeX-delimiters för KaTeX-rendering i frontend.
   * Konverterar olika LaTeX-format till standardformat som KaTeX förstår.
   */
  private normalizeMathDelimiters(text: string): string {
    if (!text) return '';
    
    return text
      // Konvertera \[ ... \] till $$ ... $$ (display math)
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      // Konvertera \( ... \) till $ ... $ (inline math)
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$')
      // Säkerställ att vanliga LaTeX-kommandon fungerar
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}')
      .replace(/\\pi/g, '\\pi')
      .replace(/\\sqrt\{([^}]+)\}/g, '\\sqrt{$1}')
      .replace(/\\sum/g, '\\sum')
      .replace(/\\int/g, '\\int')
      .replace(/\\alpha/g, '\\alpha')
      .replace(/\\beta/g, '\\beta')
      .replace(/\\gamma/g, '\\gamma');
  }

  //här
  async analyzeImageWithText(request: AIRequest): Promise<AIResponse> {
    console.log('🔄 Making authenticated backend API request...');

    try {
      // Convert base64 image to blob for multipart upload
      const formData = new FormData();
      formData.append('question', request.message);
      // Always include conversationId, even if null/undefined, so backend can handle it properly
      formData.append('conversationId', request.conversationId || '');

      // Add model selection from store
      const { useAppStore } = await import('../stores/app-store.js');
      const currentModel = useAppStore.getState().selectedModel;
      formData.append('model', currentModel);
      console.log('🤖 DEBUG: Frontend sending model:', currentModel);

      console.log('🔍 DEBUG: FormData conversationId value:', request.conversationId || '(empty string for null/undefined)');

      //här
      if (request.imageData) {
        // Convert base64 data URL to blob
        const base64Data = request.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([arrayBuffer], { type: 'image/png' });
        formData.append('image', blob, 'screenshot.png');
      }

      authService.withRefresh(() =>
        fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            ...userService.getAuthHeader(),
          },
          credentials: 'include',
          body: formData
        }))
        .then(res => {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let prevHeight = 0;

          const readChunk = (): void => {
            if (!reader) return;
            reader.read().then(({ done, value }) => {
              if (done) return;

              const rawChunk = decoder.decode(value, { stream: true });

              // Filtrera bort ev. usage-events om du inte vill visa dem
              if (!rawChunk.includes('[usage]')) {
                // 🔁 Normalisera LaTeX-delimiters i chunket
                const newContent = this.normalizeMathDelimiters(rawChunk);

                const prevContent = useAppStore.getState().currentResult?.content;

                prevHeight = this.handleResize('response-div', prevHeight);

                // Append:a texten; UI-komponenten kommer att rendera Markdown + Math
                useAppStore.getState().setCurrentResultContent((prevContent || '') + newContent);
                return readChunk();
              }

              // Om du vill hantera [usage], gör det här och fortsätt läsa:
              return readChunk();
            });
          };

          return readChunk();
        })
        .catch(err => console.error(err));

      return {
        content: '',
        tokensUsed: 12,
        model: 'backend-api',
        timestamp: Date.now(),
        conversationId: "1"
      };

    } catch (error: any) {
      console.error('❌ Backend API error:', error);
      throw error;
    }
  }

  //här
  // New streaming method
  getStreamingFormData(request: AIRequest): FormData {
    const formData = new FormData();
    formData.append('question', request.message);
    formData.append('conversationId', request.conversationId || '');

    // Add model selection from store
    const { useAppStore } = require('../stores/app-store.js');
    const currentModel = useAppStore.getState().selectedModel;
    formData.append('model', currentModel);

    if (request.imageData) {
      // Convert base64 data URL to blob
      const base64Data = request.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      formData.append('image', blob, 'screenshot.png');
    }

    return formData;
  }

  //härrrrrrrr
  getStreamingUrl(): string {
    return 'https://api.finalyze.pro/api/analyze-stream';
  }

  getRemainingRequests(): number {
    return 100; // Mock value for now
  }

  getUsageStats() {
    return {
      requestCount: 0,
      dailyLimit: 100,
      remaining: 100,
      lastReset: new Date().toDateString()
    };
  }

  private handleResize(responseDivId: string, prevHeight: number): number {
    const responseDiv = document.getElementById(responseDivId);
    const height = Math.min((responseDiv?.clientHeight || 0) + 150, 600);

    if (height > prevHeight) {
      invoke('resize_window', {
        width: 600,
        height: height,
      });
      return height;
    }

    return prevHeight;
  }
}
