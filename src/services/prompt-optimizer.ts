// 🧠 SMART PROMPT OPTIMIZER - Better AI responses through intelligent prompting
// ============================================================================

export interface PromptContext {
  message: string;
  hasImage: boolean;
  hasOCR: boolean;
  ocrText?: string;
  ocrConfidence?: number;
  imageSize?: number;
}

export interface OptimizedPrompt {
  prompt: string;
  maxTokens: number;
  temperature: number;
  reasoning: string;
}

export class PromptOptimizer {
  
  static optimizePrompt(context: PromptContext): OptimizedPrompt {
    const questionType = this.detectQuestionType(context.message);
    const promptStyle = this.selectPromptStyle(questionType, context);
    
    return {
      prompt: this.buildOptimizedPrompt(context, promptStyle),
      maxTokens: this.getOptimalTokenCount(questionType),
      temperature: this.getOptimalTemperature(questionType),
      reasoning: `Detected: ${questionType}, Style: ${promptStyle.name}`
    };
  }

  private static detectQuestionType(message: string): QuestionType {
    const lowerMessage = message.toLowerCase();
    
    // Code/Technical Analysis
    if (this.matchesKeywords(lowerMessage, ['code', 'function', 'script', 'programming', 'error', 'debug', 'syntax'])) {
      return 'code_analysis';
    }
    
    // Text extraction/Reading
    if (this.matchesKeywords(lowerMessage, ['read', 'text', 'extract', 'transcribe', 'what does it say', 'whats written'])) {
      return 'text_extraction';
    }
    
    // UI/Interface Analysis  
    if (this.matchesKeywords(lowerMessage, ['interface', 'ui', 'button', 'design', 'layout', 'website', 'app', 'screen'])) {
      return 'ui_analysis';
    }
    
    // Data/Numbers Analysis
    if (this.matchesKeywords(lowerMessage, ['data', 'chart', 'graph', 'numbers', 'statistics', 'analyze', 'calculate'])) {
      return 'data_analysis';
    }
    
    // Quick explanation (what/how questions)
    if (this.matchesKeywords(lowerMessage, ['what', 'how', 'explain', 'describe', 'tell me about'])) {
      return 'explanation';
    }
    
    // Problem solving
    if (this.matchesKeywords(lowerMessage, ['help', 'fix', 'solve', 'problem', 'issue', 'broken', 'wrong'])) {
      return 'problem_solving';
    }
    
    return 'general';
  }

  private static selectPromptStyle(questionType: QuestionType, context: PromptContext): PromptStyle {
    const styles: Record<QuestionType, PromptStyle> = {
      code_analysis: {
        name: 'Code Expert',
        prefix: 'As a senior software engineer, analyze this code/interface:',
        focusAreas: ['syntax', 'functionality', 'best practices', 'potential issues'],
        responseFormat: 'structured with code blocks'
      },
      
      text_extraction: {
        name: 'Text Reader',
        prefix: 'Extract and transcribe all visible text accurately:',
        focusAreas: ['exact text', 'formatting', 'structure'],
        responseFormat: 'clean text output'
      },
      
      ui_analysis: {
        name: 'UX/UI Expert',
        prefix: 'As a UX/UI designer, analyze this interface:',
        focusAreas: ['usability', 'design patterns', 'user experience'],
        responseFormat: 'structured analysis'
      },
      
      data_analysis: {
        name: 'Data Analyst',
        prefix: 'As a data analyst, examine this data/chart:',
        focusAreas: ['trends', 'insights', 'key metrics', 'conclusions'],
        responseFormat: 'analytical summary'
      },
      
      explanation: {
        name: 'Clear Explainer',
        prefix: 'Explain this clearly and concisely:',
        focusAreas: ['key concepts', 'main points', 'context'],
        responseFormat: 'easy to understand'
      },
      
      problem_solving: {
        name: 'Problem Solver',
        prefix: 'Help solve this issue step by step:',
        focusAreas: ['root cause', 'solutions', 'next steps'],
        responseFormat: 'actionable steps'
      },
      
      general: {
        name: 'General Assistant',
        prefix: 'Analyze this screenshot and provide helpful insights:',
        focusAreas: ['overview', 'key details', 'context'],
        responseFormat: 'comprehensive response'
      }
    };
    
    return styles[questionType];
  }

  private static buildOptimizedPrompt(context: PromptContext, style: PromptStyle): string {
    let prompt = style.prefix + '\n\n';
    
    // Add user's specific question
    prompt += `**User Question:** ${context.message}\n\n`;
    
    // Add OCR context if available and high confidence
    if (context.hasOCR && context.ocrText && context.ocrConfidence && context.ocrConfidence > 0.5) {
      prompt += `**Text found in image:** "${context.ocrText}"\n`;
      prompt += `*(OCR confidence: ${Math.round(context.ocrConfidence * 100)}%)*\n\n`;
    }
    
    // Add focus instructions based on question type
    prompt += `**Focus on:** ${style.focusAreas.join(', ')}\n`;
    prompt += `**Response format:** ${style.responseFormat}\n\n`;
    
    // Add specific instructions for better responses
    prompt += this.getSpecificInstructions(context);
    
    return prompt;
  }

  private static getSpecificInstructions(context: PromptContext): string {
    let instructions = '';
    
    if (context.hasImage) {
      instructions += '• Analyze both visual elements and any text content\n';
    }
    
    if (context.hasOCR && context.ocrText) {
      instructions += '• Cross-reference the extracted text with what you see visually\n';
    }
    
    instructions += '• Be specific and actionable\n';
    instructions += '• Use clear, concise language\n';
    instructions += '• Provide practical insights\n';
    
    return instructions;
  }

  private static getOptimalTokenCount(questionType: QuestionType): number {
    const tokenCounts: Record<QuestionType, number> = {
      text_extraction: 300,     // Short, focused text output
      code_analysis: 800,       // Detailed code analysis
      ui_analysis: 600,         // Structured UI feedback  
      data_analysis: 700,       // Data insights
      explanation: 500,         // Clear explanations
      problem_solving: 600,     // Step-by-step solutions
      general: 500              // Balanced response
    };
    
    return tokenCounts[questionType];
  }

  private static getOptimalTemperature(questionType: QuestionType): number {
    const temperatures: Record<QuestionType, number> = {
      text_extraction: 0.1,     // Very precise
      code_analysis: 0.3,       // Mostly precise, some creativity
      data_analysis: 0.2,       // Precise analysis
      ui_analysis: 0.4,         // Some creative insights
      explanation: 0.5,         // Balanced explanation
      problem_solving: 0.3,     // Focused solutions
      general: 0.4              // Balanced response
    };
    
    return temperatures[questionType];
  }

  private static matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}

// Types
type QuestionType = 
  | 'code_analysis' 
  | 'text_extraction' 
  | 'ui_analysis' 
  | 'data_analysis' 
  | 'explanation' 
  | 'problem_solving' 
  | 'general';

interface PromptStyle {
  name: string;
  prefix: string;
  focusAreas: string[];
  responseFormat: string;
} 