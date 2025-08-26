import React, { useEffect, useState } from 'react';
import { useAppStore, AIResult } from '../stores/app-store';
import { invoke } from '@tauri-apps/api/core';

// ⬇️ Nya imports för Markdown + Math
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// OBS: katex-CSS importeras globalt i App.tsx eller index.tsx

interface ResultOverlayProps {
  result: AIResult;
  onFollowUp?: () => void;
}

// Hjälpare: normalisera LaTeX-delimiters för KaTeX-rendering
function normalizeLatexDelimiters(text: string) {
  if (!text) return '';
  
  return text
    // Konvertera \[ ... \] till $$ ... $$ (display math)
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    // Konvertera \( ... \) till $ ... $ (inline math)  
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    // Säkerställ att \frac, \pi, etc. fungerar korrekt
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}')
    .replace(/\\pi/g, '\\pi')
    .replace(/\\sqrt\{([^}]+)\}/g, '\\sqrt{$1}');
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ result, onFollowUp }) => {
  const { 
    setCurrentResult, 
    user
  } = useAppStore();

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentResult(null);
    }, 300);
  };

  const handleCopyText = async () => {
    try {
      await invoke('copy_to_clipboard', { text: result.content ?? '' });
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleFollowUpClick = () => {
    if (onFollowUp) onFollowUp();
  };

  const getTierColor = () => {
    const tier = user?.tier.tier || 'free';
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-700';
      case 'premium': return 'bg-blue-100 text-blue-700';
      case 'pro': return 'bg-purple-200/80 text-purple-800 shadow-inner shadow-purple-900/20';
      case 'enterprise': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Safe position values to avoid TypeScript errors
  const positionX = result.position?.x ?? undefined;
  const positionY = result.position?.y ?? undefined;
  const hasPosition = positionX !== undefined && positionY !== undefined;

  return (
    <>
      {/* Seamless AI Response - No backdrop, no modal overlay */}
      <div 
        className={`p-3 rounded-xl border border-white/10 backdrop-blur-sm overflow-y-auto transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{
          backgroundColor: 'rgba(20, 20, 20, 0.7)',
          maxHeight: 'calc(100vh - 68px)',
          minHeight: 60,
        }}
        data-ai-response
      >
        <div className="flex items-start justify-between" id="response-div">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <h3 className="text-xs font-medium mb-2 flex items-center justify-between">
              <span className="text-gray-300">AI Response</span>
              <button
                onClick={handleClose}
                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
                title="Dismiss"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </h3>

            {/* AI Response Content with LaTeX/Math rendering */}
            <div className="text-gray-300 leading-relaxed break-words" style={{ fontSize: '13px' }}>
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {normalizeLatexDelimiters(result.content ?? '')}
              </ReactMarkdown>
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="mt-2 pt-2 border-t border-white/10 flex justify-end space-x-2">
          <button 
            onClick={handleCopyText}
            className="px-2 py-1 text-xs text-gray-300 hover:text-gray-100 transition-colors"
          >
            Copy
          </button>
          <button
            onClick={handleFollowUpClick}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ask follow up
          </button>
        </div>
      </div>
    </>
  );
};

export default ResultOverlay;
