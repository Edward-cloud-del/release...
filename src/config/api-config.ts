// 🚨 TEMPORARY API CONFIGURATION 🚨
// =====================================
// ⚠️  WARNING: This file contains API keys - DO NOT commit to git!
// ⚠️  SECURITY: Move to environment variables or backend storage
// ⚠️  TODO: Replace with secure Tauri backend storage
// =====================================

// 🔧 TEMPORARY: Hardcoded API key for development
// Replace with your actual OpenAI API key
export const TEMP_OPENAI_API_KEY = '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';

// 🔮 FUTURE: These will be moved to backend/environment
export const AI_CONFIG = {
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.2,
  dailyLimit: 50, // Conservative limit for testing
};

// 🔧 MIGRATION NOTES:
// 1. IMMEDIATELY: Add this file to .gitignore
// 2. ENVIRONMENT: Move to .env file with VITE_OPENAI_API_KEY
// 3. BACKEND: Move to secure Tauri storage system
// 4. PRODUCTION: Use backend-only API calls

export function getApiKey(): string {
  // 🚨 TEMPORARY: Return hardcoded key
  if (!TEMP_OPENAI_API_KEY || TEMP_OPENAI_API_KEY === 'sk-your-api-key-here') {
    throw new Error('API configuration required. Please contact administrator.');
  }
  
  return TEMP_OPENAI_API_KEY;
  
  // 🔮 FUTURE: Get from environment or backend
  // return import.meta.env.VITE_OPENAI_API_KEY;
  // or: return await invoke('get_api_key_secure');
} 