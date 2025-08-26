
import React, { useState, useEffect } from 'react';
import type { IAIService } from '../types/ai-types';

//kommer använda senare!

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  aiService: IAIService | null;
  onApiKeyUpdate: (newApiKey: string) => void;
}

interface UsageStats {
  requestCount: number;
  dailyLimit: number;
  remaining: number;
  lastReset: string;
}

export default function SettingsDialog({ isOpen, onClose, aiService, onApiKeyUpdate }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isValidApiKey, setIsValidApiKey] = useState(true);

  // Load current usage stats
  useEffect(() => {
    if (isOpen && aiService && aiService.getUsageStats) {
      try {
        const stats = aiService.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.warn('Could not load usage stats:', error);
      }
    }
  }, [isOpen, aiService]);

  // Validate API key format
  const validateApiKey = (key: string): boolean => {
    return key.startsWith('sk-') && key.length > 20;
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    setIsValidApiKey(newKey === '' || validateApiKey(newKey));
  };

  const handleSaveApiKey = () => {
    if (apiKey && validateApiKey(apiKey)) {
      onApiKeyUpdate(apiKey);
      setApiKey(''); // Clear input after save
      onClose();
    }
  };

  const handleRemoveApiKey = () => {
    if (confirm('Are you sure you want to remove the API key?')) {
      onApiKeyUpdate('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* API Key Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">OpenAI API Key</h3>
            
            {/* Current Status */}
            <div className="flex items-center space-x-2 text-sm">
              {aiService ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-700">API key configured</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-700">No API key configured</span>
                </>
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="sk-proj-..."
                  className={`w-full px-3 py-2 border rounded-md pr-10 text-sm ${
                    !isValidApiKey ? 'border-red-300 text-red-900' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464l1.414-1.414L9.878 9.878z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {!isValidApiKey && (
                <p className="text-xs text-red-600">API key must start with 'sk-' and be at least 20 characters</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey || !isValidApiKey}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Save Key
              </button>
              
              {aiService && (
                <button
                  onClick={handleRemoveApiKey}
                  className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                >
                  Remove Key
                </button>
              )}
            </div>
          </div>

          {/* Usage Statistics */}
          {usageStats && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">Usage Statistics</h3>
              
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Requests Today</span>
                  <span className="text-sm font-medium">
                    {usageStats.requestCount} / {usageStats.dailyLimit}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (usageStats.requestCount / usageStats.dailyLimit) * 100)}%` 
                    }}
                  ></div>
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{usageStats.remaining} requests remaining</span>
                  <span>Resets daily</span>
                </div>
              </div>
            </div>
          )}

          {/* Cost Protection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Cost Protection</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div className="text-xs text-yellow-800">
                  <p className="font-medium">Daily limit: 50 requests</p>
                  <p>Automatic protection against excessive API usage costs</p>
                </div>
              </div>
            </div>
          </div>

          {/* OCR Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">OCR Settings</h3>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-green-800">
                  <p className="font-medium">OCR: Always enabled & free</p>
                  <p>Automatic text extraction from screenshots</p>
                  <p>Language: English + 162 others supported</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>FrameSense Settings</span>
            <span>Frontend Mode (Temporary)</span>
          </div>
        </div>
      </div>
    </div>
  );
} 