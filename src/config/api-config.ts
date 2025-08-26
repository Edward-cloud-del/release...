// 🚨 TEMPORARY API CONFIGURATION 🚨
// =====================================
// ⚠️  WARNING: This file contains API keys - DO NOT commit to git!
// ⚠️  SECURITY: Move to environment variables or backend storage
// ⚠️  TODO: Replace with secure Tauri backend storage
// =====================================

// 🔧 TEMPORARY: Hardcoded API key for development
// Replace with your actual OpenAI API key

// 🔮 FUTURE: These will be moved to backend/environment
export const AI_CONFIG = {
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.2,
  dailyLimit: 50, // Conservative limit for testing
};

// 🔧 MIGRATION NOTES:
// 1. IMMEDIATELY: Add this file to .gitignore
// 3. BACKEND: Move to secure Tauri storage system
// 4. PRODUCTION: Use backend-only API calls

 