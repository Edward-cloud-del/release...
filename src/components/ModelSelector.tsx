import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth-service-db';
import { type User } from '../services/user-service';

interface ModelSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  onModelSelect: (model: string) => void;
  selectedModel: string;
}

interface AIModel {
  name: string;
  provider: string;
  icon: string;
  tier: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ isVisible, onClose, onModelSelect, selectedModel }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userAvailableModels, setUserAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Animation state like ChatBox
  const [boxVisible, setBoxVisible] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      setBoxVisible(false);
      setTimeout(() => setBoxVisible(true), 10);
      loadUserAndModels();
    } else {
      setBoxVisible(false);
    }
  }, [isVisible]);

  const loadUserAndModels = async () => {
    console.log('🔍 DEBUG: ModelSelector - loadUserAndModels started');
    setLoading(true);
    try {
      const user = authService.getCurrentUser();
      console.log('🔍 DEBUG: ModelSelector - Current user:', user ? `${user.email} (${user.tier})` : 'null');
      setCurrentUser(user);
      
      const tier = user?.tier || 'free';
      console.log('🔍 DEBUG: ModelSelector - Using tier:', tier);
      
      const models = await authService.getAvailableModels(tier);
      console.log('🔍 DEBUG: ModelSelector - Available models:', models);
      setUserAvailableModels(models);
      
      // If selected model is not available, select first available
      if (!models.includes(selectedModel) && models.length > 0 && models[0]) {
        console.log('🔍 DEBUG: ModelSelector - Selected model not available, switching to:', models[0]);
        onModelSelect(models[0]);
      } else {
        console.log('🔍 DEBUG: ModelSelector - Selected model is available:', selectedModel);
      }
    } catch (error) {
      console.error('❌ DEBUG: ModelSelector - Failed to load user models:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = (user: User | null) => {
      setCurrentUser(user);
      if (isVisible) {
        loadUserAndModels();
      }
    };

    authService.addAuthListener(handleAuthChange);
    
    return () => {
      authService.removeAuthListener(handleAuthChange);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const allModelsByTier: Record<string, AIModel[]> = {
    free: [
      { name: 'GPT-3.5-turbo', provider: 'OpenAI', icon: '🤖', tier: 'free' },
      { name: 'Gemini Flash', provider: 'Google', icon: '💎', tier: 'free' }
    ],
    premium: [
      { name: 'GPT-4o-mini', provider: 'OpenAI', icon: '🤖', tier: 'premium' },
      { name: 'Claude 3 Haiku', provider: 'Anthropic', icon: '🧠', tier: 'premium' },
      { name: 'Gemini Pro', provider: 'Google', icon: '💎', tier: 'premium' },
      { name: 'Jamba Mini', provider: 'AI21', icon: '🧬', tier: 'premium' },
      { name: 'Mistral Small', provider: 'Mistral', icon: '⚡', tier: 'premium' }
    ],
    pro: [
      { name: 'GPT-4o', provider: 'OpenAI', icon: '🤖', tier: 'pro' },
      { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', icon: '🧠', tier: 'pro' },
      { name: 'Jamba Large', provider: 'AI21', icon: '🧬', tier: 'pro' },
      { name: 'Mistral Medium', provider: 'Mistral', icon: '⚡', tier: 'pro' }
    ],
    enterprise: [
      { name: 'GPT-4o 32k', provider: 'OpenAI', icon: '🤖', tier: 'enterprise' },
      { name: 'Claude 3 Opus', provider: 'Anthropic', icon: '🧠', tier: 'enterprise' },
      { name: 'Jamba Mini', provider: 'AI21', icon: '🧬', tier: 'enterprise' },
      { name: 'Mistral Large', provider: 'Mistral', icon: '⚡', tier: 'enterprise' }
    ]
  };

  const currentUserTier = currentUser?.tier || 'free';
  const tierOrder = ['free', 'premium', 'pro', 'enterprise'];
  const userTierIndex = tierOrder.indexOf(currentUserTier);

  // Get available models up to user's tier
  const accessibleModels: AIModel[] = [];
  for (let i = 0; i <= userTierIndex; i++) {
    const tier = tierOrder[i];
    if (tier && allModelsByTier[tier]) {
      accessibleModels.push(...allModelsByTier[tier]);
    }
  }

  // Get locked models
  const lockedModels: AIModel[] = [];
  for (let i = userTierIndex + 1; i < tierOrder.length; i++) {
    const tier = tierOrder[i];
    if (tier && allModelsByTier[tier]) {
      lockedModels.push(...allModelsByTier[tier]);
    }
  }

  // Combine all models for 4x2 grid layout
  const allModels = [...accessibleModels, ...lockedModels];

  const handleModelSelect = async (modelName: string, isLocked: boolean) => {
    console.log('🔍 DEBUG: ModelSelector - handleModelSelect called:', { modelName, isLocked });
    
    if (isLocked) {
      console.log('🔍 DEBUG: ModelSelector - Model is locked, opening upgrade page');
      handleUpgrade();
      return;
    }
    
    // Double-check with auth service
    console.log('🔍 DEBUG: ModelSelector - Double-checking model access with auth service...');
    const canUse = await authService.canUseModel(modelName);
    console.log('🔍 DEBUG: ModelSelector - Auth service canUseModel result:', canUse);
    
    if (!canUse) {
      console.log('🔍 DEBUG: ModelSelector - Auth service says model not available, opening upgrade page');
      handleUpgrade();
      return;
    }
    
    console.log('🔍 DEBUG: ModelSelector - Model access confirmed, selecting model:', modelName);
    onModelSelect(modelName);
    onClose();
  };

  const handleUpgrade = (plan?: string) => {
    authService.openUpgradePage(plan);
  };

  const handleCheckPaymentStatus = async () => {
    try {
      setLoading(true);
      console.log('🔄 Verifying payment status with backend...');
      
      // Use new verification method that calls backend
      const updatedUser = await authService.verifyPaymentStatus();
      
      if (updatedUser && updatedUser.tier !== 'free') {
        console.log('✅ Payment verified! User upgraded to:', updatedUser.tier);
        
        // Show success notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Payment Verified! 🎉', {
            body: `Welcome to FrameSense ${updatedUser.tier.charAt(0).toUpperCase() + updatedUser.tier.slice(1)}!`,
            icon: '/favicon.ico'
          });
        }
      } else {
        alert('Payment verification in progress. If you just completed payment, please wait a few minutes and try again.');
      }
      
      // Reload models to update UI
      await loadUserAndModels();
    } catch (error) {
      console.error('❌ Payment verification failed:', error);
      alert('Unable to verify payment status. Please try again or contact customer support.');
    } finally {
      setLoading(false);
    }
  };



  const isModelLocked = (model: AIModel) => {
    const isLocked = !userAvailableModels.includes(model.name);
    console.log('🔍 DEBUG: ModelSelector - isModelLocked check:', {
      modelName: model.name,
      userAvailableModels: userAvailableModels,
      isLocked: isLocked,
      currentUserTier: currentUser?.tier
    });
    return isLocked;
  };

  const getModelDisplayName = (name: string) => {
    // Very short names for 4x2 compact display
    return name
      .replace('GPT-3.5-turbo', 'GPT-3.5')
      .replace('GPT-4o-mini', 'GPT-4o mini')
      .replace('GPT-4o 32k', 'GPT-4o 32k')
      .replace('GPT-4o', 'GPT-4o')
      .replace('Claude 3 Haiku', 'Haiku')
      .replace('Claude 3.5 Sonnet', 'Sonnet')
      .replace('Claude 3 Opus', 'Opus')
      .replace('Gemini Flash', 'Flash')
      .replace('Gemini Pro', 'Gemini Pro')
      .replace('Jamba Large', 'Jamba Large')
      .replace('Jamba Mini', 'Jamba Mini')
      .replace('Mistral Small', 'Mistral S')
      .replace('Mistral Medium', 'Mistral M')
      .replace('Mistral Large', 'Mistral L');
  };

  const getRequiredPlan = (model: AIModel): string => {
    const tier = authService.getRequiredTier(model.name);
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <div className={`relative z-50 transition-all duration-300 ease-out ${boxVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div 
        className="bg-gray-900/95 backdrop-blur-[20px] border border-white/10 rounded-2xl p-2 mt-2 mb-1"
        style={{
          background: 'rgba(20, 20, 20, 0.95)',
        }}
      >
        {/* User info section */}
        <div className="mb-2 flex justify-between items-center text-xs">
          {currentUser ? (
            <>
              <div className="text-white/70">
                <span className="font-medium">{currentUser.name}</span>
              </div>
              <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                currentUser.tier === 'free' ? 'bg-gray-500/20 text-gray-300' :
                currentUser.tier === 'premium' ? 'bg-blue-500/20 text-blue-300' :
                currentUser.tier === 'pro' ? 'bg-purple-600/25 text-purple-200 shadow-inner shadow-purple-900/30' :
                'bg-yellow-500/20 text-yellow-300'
              }`}>
                {currentUser.tier.charAt(0).toUpperCase() + currentUser.tier.slice(1)}
              </div>
            </>
          ) : (
            <div className="text-white/50 text-center w-full flex flex-col space-y-1">
              <div>
                <span>Free User - </span>
                <button 
                  onClick={() => handleUpgrade()}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Upgrade to Premium
                </button>
              </div>
              <button 
                onClick={() => handleCheckPaymentStatus()}
                className="text-xs text-green-400 hover:text-green-300 underline"
                disabled={loading}
              >
                Already paid? Check status
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-4 text-white/50">Loading models...</div>
        ) : (
          <>
            {/* 4x2 Grid Layout - 4 columns, scrollable */}
            <div className="max-h-32 overflow-y-auto mb-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
              <div className="grid grid-cols-4 gap-1">
                {allModels.map((model) => {
                  const isLocked = isModelLocked(model);
                  const isSelected = selectedModel === model.name;
                  
                  return (
                    <button
                      key={model.name}
                      onClick={() => handleModelSelect(model.name, isLocked)}
                      className={`
                        relative p-1 rounded-md transition-all duration-200 text-left min-h-[35px] flex flex-col justify-center
                        ${isSelected && !isLocked
                          ? 'bg-blue-500/30 border border-blue-400/50'
                          : isLocked 
                            ? 'bg-white/5 border border-white/10 opacity-50 cursor-pointer hover:opacity-70'
                            : 'bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30'
                        }
                      `}
                      title={isLocked ? `Requires ${getRequiredPlan(model)} plan` : model.name}
                    >
                      {/* Lock icon for locked models */}
                      {isLocked && (
                        <div className="absolute top-0.5 right-0.5">
                          <svg className="w-2 h-2 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Selected checkmark */}
                      {isSelected && !isLocked && (
                        <div className="absolute top-0.5 right-0.5">
                          <svg className="w-2 h-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      <div className="flex flex-col items-center text-center">
                        <span className="text-xs mb-0.5">{model.icon}</span>
                        <div className={`text-xs font-medium leading-tight ${isLocked ? 'text-white/40' : 'text-white/90'}`}>
                          {getModelDisplayName(model.name)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upgrade section for locked models */}
            {lockedModels.length > 0 && (
              <div className="border-t border-white/10 pt-1 mb-1">
                <button
                  onClick={() => handleUpgrade()}
                  className="w-full bg-gradient-to-r from-blue-500/20 to-purple-600/20 text-white/90 py-1 px-2 rounded-md font-medium text-xs hover:from-blue-500/30 hover:to-purple-600/30 transition-all duration-200 flex items-center justify-center space-x-1 border border-white/20"
                >
                  <span>🚀</span>
                  <span>Upgrade for Premium Models</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Usage info - very compact */}
        {currentUser && (
          <div className="text-xs text-white/50 flex justify-between items-center">
            <span>{currentUser.usage_daily || 0}/{authService.getDailyLimit()} today</span>
            <div className="w-12 bg-white/10 rounded-full h-1">
              <div 
                className="h-1 bg-blue-400 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, authService.getUsagePercentage())}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector; 