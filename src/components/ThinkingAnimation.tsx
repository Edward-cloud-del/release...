import React from 'react';

interface ThinkingAnimationProps {
  isVisible: boolean;
  currentStage: string;
}

export default function ThinkingAnimation({ isVisible, currentStage }: ThinkingAnimationProps) {
  if (!isVisible) return null;

  // Clean stage text without emojis
  const cleanStage = currentStage
    .replace(/📸|🔍|🧠|🤖|✨/g, '')
    .trim();

  return (
    <div className="relative z-40 mt-2">
      <div
        className="px-3 py-1 rounded-2xl border border-white/10"
        style={{
          background: 'rgba(20, 20, 20, 0.5)',
          minWidth: 180,
          maxWidth: 320,
          height: 28,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="text-xs font-light text-left w-full truncate animate-pulse-harmonic">
          {cleanStage}
        </span>
      </div>
    </div>
  );
} 