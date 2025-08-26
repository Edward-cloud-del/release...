import React, {useEffect, useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {open} from '@tauri-apps/plugin-shell';
import ResultOverlay from './components/ResultOverlay';
// Removed AIResponse import - now using ResultOverlay
import ChatBox from './components/ChatBox';
// Removed SettingsDialog import - now using Upgrade to Pro
import ThinkingAnimation from './components/ThinkingAnimation';
import ModelSelector from './components/ModelSelector';
import WindowAnimation from './components/WindowAnimation';
import 'katex/dist/katex.min.css';


import {useAppStore, AIResult} from './stores/app-store';
import {authService} from './services/auth-service-db';
import {User} from './services/user-service';
import ProfileDropdown from './components/ProfileDropdown';
import { useUIState } from './hooks/useUIState';

// 🤖 Real OpenAI Integration
import {createAIService} from './services/openai-service';
import {getApiKey} from './config/api-config';
import type {IAIService, AIRequest, AIResponse} from './types/ai-types';



// STEG 4: AI Message interface for complete AI integration
interface AIMessage {
	text: string;
	imageData?: string;  // base64 PNG data
	timestamp: number;
	bounds?: any; // Future: CaptureBounds type
	conversationId?: string;
}

// OCR Result interface (matches Rust OCRResult)
interface OCRResult {
	text: string;
	confidence: number;
	has_text: boolean;
}

// App state interface for Tauri state
interface TauriAppState {
	screenshot_data?: string;
}


function App() {
	const [isReady, setIsReady] = useState(false);
	const [screenshotResult, setScreenshotResult] = useState<string | null>(null);
	const [isCreatingOverlay, setIsCreatingOverlay] = useState(false);

	// 🎭 Window animation state
	const [windowVisible, setWindowVisible] = useState(false);
// 🎛️ UI State Management - Global state for all dropdowns
	const {
		chatBoxOpen,
		modelSelectorOpen,
		openChatBox,
		openModelSelector,
		closeChatBox,
		closeModelSelector,
		closeAll
	} = useUIState();

	// 🤖 CHAT FLOW STATE MANAGEMENT (STEG 2) - Updated for window-based chat

	// Backend handles conversation tracking per user - no frontend storage needed
	const [conversationId, setConversationId] = useState<string | null>(null);
	// 🖼️ STEG 2: Separate state for AI image context (independent from badge)
	const [selectedImageForAI, setSelectedImageForAI] = useState<string | null>(null);

	// 🔍 OCR Context state for automatic text extraction
	const [ocrContext, setOcrContext] = useState<OCRResult | null>(null);

	// 🤖 Real OpenAI service state
	const [aiService, setAiService] = useState<IAIService | null>(null);

	// ⚙️ Settings UI state (removed - now using Upgrade to Pro)

	// 🎭 Thinking Animation state
	const [isAiThinking, setIsAiThinking] = useState(false);
	const [aiProcessingStage, setAiProcessingStage] = useState<string>('');


	const {
		//hasPermissions,
		//isProcessing,
		currentResult,
		setPermissions,
		selectedModel,
		setSelectedModel
	} = useAppStore();

	// Use auth service for user management
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [debugMode, setDebugMode] = useState(true); // Auto-show debug info

	// Login handlers - defined at component level
	const handleLoginSuccess = async (user: User) => {
		setCurrentUser(user);

		// Force reload of user status to trigger model updates
		setTimeout(async () => {
			try {
				await authService.refreshUserStatus();
				console.log('✅ User status refreshed after login');
			} catch (error) {
				console.error('❌ Failed to refresh user status:', error);
			}
		}, 100);

		alert(`🎉 Welcome back, ${user.name}!\n\nYou now have ${user.tier} access!\n\nPremium models are now unlocked! 🔓`);
	};

	const handleLogout = () => {
		setCurrentUser(null);
		alert('👋 You have been logged out. You now have free access.');
	};

	const handleUserUpdate = (user: User) => {
		setCurrentUser(user);
	};

	// Initialize auth service and listen for user changes
	useEffect(() => {
		console.log('🔍 DEBUG: App.tsx - Auth useEffect running (component mount/restart)');

		const handleUserChange = (user: User | null) => {
			setCurrentUser(user);
			console.log('🔍 DEBUG: App.tsx - User changed via listener:', user ? `${user.email} (${user.tier})` : 'No user');
		};

		authService.addAuthListener(handleUserChange);
		console.log('✅ DEBUG: App.tsx - Auth listener added');

		// Load current user
		console.log('🔍 DEBUG: App.tsx - About to call loadCurrentUser()');
		authService.loadCurrentUser().then(user => {
			setCurrentUser(user);
			console.log('🔍 DEBUG: App.tsx - Initial user loaded from loadCurrentUser():', user ? `${user.email} (${user.tier})` : 'No user');
		}).catch(error => {
			console.error('❌ DEBUG: App.tsx - loadCurrentUser failed:', error);
		});

		return () => {
			console.log('🔍 DEBUG: App.tsx - Removing auth listener (component unmount)');
			authService.removeAuthListener(handleUserChange);
		};
	}, []);

	// Debug functions for session management
	const clearUserSession = async () => {
		try {
			await authService.logout();
			console.log('🗑️ Session cleared successfully');
			alert('Session cleared! You are now logged out.');
		} catch (error) {
			console.error('❌ Failed to clear session:', error);
			alert('Unable to sign out. Please try again.');
		}
	};
//Viktig
	const handleUpgradeClick = async (plan?: string) => {
		try {
			console.log('🚀 Starting upgrade process for plan:', plan || 'default');

			// Open payment page on Vercel deployment
			const baseUrl = 'https://vely22.vercel.app';
			const upgradeUrl = plan
				? `${baseUrl}/payments?plan=${plan}`
				: `${baseUrl}/payments`;

			console.log('🔗 Opening payment page:', upgradeUrl);
			await open(upgradeUrl);

			console.log('✅ Payment process initiated');
		} catch (error) {
			console.error('❌ Failed to start upgrade process:', error);
			alert('Unable to open payment page. Please check your connection and try again.');
		}
	};

	const handleManageSubscription = async () => {
		try {
			console.log('🛠️ Opening account management page');

			// Open account page on Vercel deployment
			const baseUrl = 'https://vely22.vercel.app';
			const accountUrl = `${baseUrl}/account.html`;

			console.log('🔗 Opening account page:', accountUrl);
			await open(accountUrl);

			console.log('✅ Account management page opened');
		} catch (error) {
			console.error('❌ Failed to open account page:', error);
			alert('Unable to access account page. Please try again.');
		}
	};const refreshUserSession = async () => {
		try {
			const user = await authService.refreshUserStatus();
			if (user) {
				console.log('🔄 Status refreshed:', user.email, user.tier);
				alert(`Status refreshed! User: ${user.email} (${user.tier})`);
			} else {
				console.log('🔄 No user to refresh');
				alert('No active user session found.');
			}
		} catch (error) {
			console.error('❌ Failed to refresh status:', error);
			alert('Unable to refresh account status. Please try again.');
		}
	};

	const clearPaymentFile = async () => {
		try {
			await invoke('clear_payment_file');
			console.log('🗑️ Payment file cleared');
			alert('Payment file cleared successfully.');
		} catch (error) {
			console.error('❌ Failed to clear payment file:', error);
			alert('Failed to clear payment file. Check console for details.');
		}
	};

	const testStatusCheck = async () => {
		try {
			console.log('🧪 Testing status check...');
			await refreshUserSession();
			console.log('✅ Status check test completed');
		} catch (error) {
			console.error('❌ Status check test failed:', error);
			alert('Status check test failed. Check console for details.');
		}
	};

	const testPaymentsPage = () => {
		console.log('🧪 Testing payments page...');
		open('http://localhost:3000/payments');
		console.log('✅ Payments page opened');
	};

	// 🤖 REAL OpenAI integration function - replaces mock
	const sendToAI = async (aiMessage: AIMessage): Promise<AIResponse> => {
		if (!aiService) {
			throw new Error('Service not available. Please restart the application.');
		}

		//byt detta senare till streaming
		setAiProcessingStage('Optimizing AI prompt...');

		console.log('🤖 Sending request to real OpenAI API...', {
			hasImage: !!aiMessage.imageData,
			messageLength: aiMessage.text.length,
			hasOCRContext: aiMessage.text.includes('[OCR Context')
		});

		try {
			const request: AIRequest = {
				message: aiMessage.text,
				imageData: aiMessage.imageData,
				imageType: 'image/png',
				conversationId: aiMessage.conversationId
			};

			console.log('📤 SEND: Sending AIRequest to backend:', {
				messageLength: request.message.length,
				hasImage: !!request.imageData,
				conversationId: request.conversationId
			});

			const response = await aiService.analyzeImageWithText(request);

			console.log('✅ RECEIVE: Backend response received:', {
				contentLength: response.content.length,
				tokensUsed: response.tokensUsed,
				model: response.model,
				conversationId: response.conversationId
			});

			console.log('💭 RECEIVE: ConversationId from backend:', response.conversationId);
			console.log('💭 RECEIVE: ConversationId type:', typeof response.conversationId);

			return response;

		} catch (error: any) {
			console.error('❌ OpenAI API error:', error);
			throw error;
		}
	};

	const sendToAIStreaming = async (aiMessage: AIMessage): Promise<{ streamUrl: string; formData: FormData }> => {
		if (!aiService || !('getStreamingFormData' in aiService)) {
			throw new Error('Streaming service not available. Please try again.');
		}

		const request: AIRequest = {
			message: aiMessage.text,
			imageData: aiMessage.imageData,
			imageType: 'image/png',
			conversationId: aiMessage.conversationId
		};

		const formData = (aiService as any).getStreamingFormData(request);
		const streamUrl = (aiService as any).getStreamingUrl();

		return {streamUrl, formData};
	};

	useEffect(() => {
		// Check permissions on app start
		checkPermissions();

		// Restore app state when window is created (Raycast-style)
		restoreAppState();

		// 🤖 Initialize AI service with API key
		const apiKey = getApiKey();
		if (apiKey) {
			const service = createAIService(apiKey);
			setAiService(service);
			console.log('✅ AI service initialized with real OpenAI');
		} else {
			console.warn('⚠️ No API key found - AI service disabled');
		}

		// 🎆 Show window when React is fully ready (eliminates white flash)
		setTimeout(async () => {
			try {
				console.log('🎆 ALT+C: About to show window after React ready');
				// First show the window
				await invoke('show_window_when_ready');
				console.log('✅ ALT+C: Window shown after React ready - no white flash');

				// Small delay then trigger smooth animation
				setTimeout(() => {
					console.log('🎆 ALT+C: About to start window animation (setWindowVisible(true))');
					setWindowVisible(true);
					console.log('🎭 ALT+C: Window animation started - windowVisible set to true');
				}, 50);
			} catch (error) {
				console.warn('⚠️ ALT+C: Failed to show window (might already be visible):', error);
				// Still trigger animation even if window show fails
				setTimeout(() => {
					console.log('🎆 ALT+C: Fallback - starting window animation despite show failure');
					setWindowVisible(true);
				}, 50);
			}
		}, 100); // Small delay to ensure React is fully rendered

		// 🔗 Server-centralized method - no deep link service needed
		console.log('✅ Using simple server-centralized payment method');

		// Listen for save-state-and-close event from Rust (Raycast-style)
		const unlistenSave = listen('save-state-and-close', () => {
			console.log('🔍 DEBUG: App.tsx - save-state-and-close event received');
			console.log('🔍 DEBUG: App.tsx - Current user before save:', currentUser ? `${currentUser.email} (${currentUser.tier})` : 'No user');
			console.log('💾 DEBUG: Saving state before window closes...');

			// Start close animation
			setWindowVisible(false);
			console.log('🎭 Window closing animation started');

			// Save state during animation
			saveAppState();
		});

		// Listen for selection results from Rust after screen capture
		const unlistenResult = listen('selection-result', (event: any) => {
			console.log('🎯 ALT+C: Received selection result from Rust:', event.payload);
			const result = event.payload;

			if (result.success && result.type === 'image' && result.imageData) {
				// STEG 1: Behåll screenshot for badge (oförändrad)
				setScreenshotResult(result.imageData);
				console.log('✅ ALT+C: Screen selection image loaded for badge!');

				// STEG 1: Save screenshot for AI context
				setSelectedImageForAI(result.imageData);
				console.log('✅ ALT+C: Screenshot saved for AI analysis!');

				// 🔍 NEW: Run automatic OCR in background (SILENT)
				runAutomaticOCR(result.imageData);

				// STEG 1: Auto-activate ChatBox after screenshot
				console.log('🔄 ALT+C: About to call handleAskAI() - current chatBoxOpen:', chatBoxOpen);
				handleAskAI(); // This will expand window and show ChatBox
				console.log('🔄 ALT+C: handleAskAI() called successfully');

				// Show brief success message (remove later)
				const bounds = result.bounds;
				console.log(`📸 ALT+C: Selection: ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y}) - ChatBox activation attempted!`);
			} else if (result.type === 'error') {
				console.error('❌ ALT+C: Selection failed:', result.message);
				alert('Unable to select area. Please try again.');
			}
		});

		return () => {
			unlistenSave.then((fn: () => void) => fn());
			unlistenResult.then((fn: () => void) => fn());
		};
	}, []);

	const checkPermissions = async () => {
		try {
			const permissions = await invoke('check_permissions');
			setPermissions(!!permissions); // Force to boolean
			setIsReady(true);
		} catch (error) {
			console.error('Failed to check permissions:', error);
			setPermissions(true); // Assume true for testing
			setIsReady(true);
		}
	};


	const saveAppState = async () => {
		try {
			await invoke('save_app_state', {
				screenshot_data: screenshotResult
			});
			console.log('💾 App state saved successfully');
		} catch (error) {
			console.error('❌ Failed to save app state:', error);
		}
	};

	const restoreAppState = async () => {
		try {
			const state = await invoke('get_app_state') as any;
			if (state.screenshot_data) {
				setScreenshotResult(state.screenshot_data);
				console.log('📂 App state restored with screenshot');
			}
		} catch (error) {
			console.error('❌ Failed to restore app state:', error);
		}
	};

	const testScreenSelection = async () => {
		console.log('🔴 RED CIRCLE: testScreenSelection called - user clicked Select button');
		// Always close previous chat/AI response when switching
		useAppStore.getState().setCurrentResult(null);
		closeAll();
		if (isCreatingOverlay) {
			console.log('⏳ Already creating overlay, ignoring click');
			return;
		}

		setIsCreatingOverlay(true);
		console.log('🚀 FAS 1: Starting optimized overlay selection...');

		try {
			// FAS 1: Use optimized overlay with pooling
			await invoke('create_transparent_overlay_optimized');
			console.log('✅ Optimized overlay window activated (pooled)');

			// Main window stays normal - no changes needed
		} catch (error) {
			console.error('❌ Failed to create optimized overlay:', error);
			console.log('🔄 Falling back to original overlay...');

			// Fallback to original overlay if optimized fails
			try {
				await invoke('create_transparent_overlay');
				console.log('✅ Fallback overlay window created');
			} catch (fallbackError) {
				console.error('❌ Both overlay methods failed:', fallbackError);
				alert('Unable to create screen overlay. Please restart the application.');
			}
		} finally {
			// FAS 1: Faster reset (overlay pooling is quicker)
			setTimeout(() => {
				setIsCreatingOverlay(false);
			}, 500); // Reduced from 1000ms
		}
	};

	// 🤖 CHAT FLOW HANDLERS (FAS 4: React-based approach)
	const handleAskAI = async () => {
		console.log('🚀 ALT+C: handleAskAI triggered - checking if toggle action needed');

		// Check if ChatBox is already open - if so, close it (toggle behavior)
		if (chatBoxOpen) {
			console.log('🔄 ALT+C: ChatBox already open, closing it (toggle behavior)');
			handleCloseChatBox();
			return;
		}

		console.log('🚀 ALT+C: ChatBox closed, opening it - starting optimized flow');
		// Always close previous chat/AI response when switching
		useAppStore.getState().setCurrentResult(null);
		console.log('🤖 ALT+C: Previous AI results cleared');

		try {
			// Check if we have screenshot data (headless capture)
			const currentState = await invoke('get_app_state') as TauriAppState;
			console.log('📖 ALT+C: Retrieved app state:', currentState);

			if (currentState.screenshot_data) {
				console.log('🖼️ ALT+C: Found screenshot data, using headless capture result');

				// Use existing screenshot data from headless capture
				setScreenshotResult(currentState.screenshot_data);
				setSelectedImageForAI(currentState.screenshot_data);

				// 🎭 Check if we need to create animated window (headless mode)
				const windowInfo = await invoke('get_window_info').catch(() => null);
				if (!windowInfo) {
					console.log('🎆 ALT+C: HEADLESS MODE - Creating window with Alt+Space smooth animation...');

					// Use the same smooth animation as Alt+Space by creating window then triggering WindowAnimation
					await invoke('create_main_window_animated');

					// Wait for window creation
					await new Promise(resolve => setTimeout(resolve, 100));

					// 🎆 TRIGGER SAME ANIMATION AS ALT+SPACE: Reset then show window with smooth transition
					console.log('🎆 ALT+C: Triggering Alt+Space style animation...');
					setWindowVisible(false); // Reset animation state

					// Small delay then trigger the smooth WindowAnimation entrance
					setTimeout(() => {
						console.log('🎆 ALT+C: Starting Alt+Space style entrance animation...');
						setWindowVisible(true); // This triggers WindowAnimation entrance
					}, 50);

					// Wait for the entrance animation to complete (same as Alt+Space)
					await new Promise(resolve => setTimeout(resolve, 350)); // 300ms animation + 50ms buffer
				} else {
					console.log('🖼️ ALT+C: Window already exists, using existing window');
				}

				// Wait for React to be ready before expanding window
				console.log('⏳ ALT+C: Waiting for React to be ready...');
				await new Promise(resolve => setTimeout(resolve, 200)); // Restored original delay

				console.log('📏 ALT+C: Resizing window to expanded size (600x120)');
				await invoke('resize_window', {width: 600, height: 120});

				// Ensure window is shown and focused explicitly after resize
				console.log('👁️ ALT+C: Ensuring window visibility and focus after resize');
				await invoke('show_window_when_ready');

				// Small delay to ensure window is stable before opening ChatBox
				await new Promise(resolve => setTimeout(resolve, 100)); // Restored original delay

				// Open ChatBox with entrance animation
				console.log('💬 ALT+C: Opening ChatBox with entrance animation');
				openChatBox();

				console.log('✅ ALT+C: Headless capture flow completed successfully');
				return;
			}
		} catch (error) {
			console.warn('⚠️ ALT+C: Error handling headless state, continuing with normal flow:', error);
		}

		// Regular flow (non-headless)
		console.log('🤖 ALT+C: Regular flow - expanding existing window');
		console.log('📊 ALT+C: Current chatBoxOpen state:', chatBoxOpen);
		console.log('🖼️ ALT+C: Image context:', selectedImageForAI ? 'Present' : 'None');

		// OPTIMIZED: Minimal delay for React readiness + smooth animation
		console.log('🔄 ALT+C: Quick React readiness check...');

		// Reduced delay - just enough to ensure React is stable
		await new Promise(resolve => setTimeout(resolve, 300));

		console.log('🔄 ALT+C: React ready - starting smooth window expansion');

		try {
			console.log('🔄 ALT+C: Calling resize_window to 600x120...');
			// Expand window for chat mode with better height calculation
			await invoke('resize_window', {width: 600, height: 120});
			console.log('✅ ALT+C: Window expanded successfully to 600x120 for chat');

			// CRITICAL: Ensure window remains visible and focused after resize
			try {
				await invoke('show_window_when_ready');
				console.log('✅ ALT+C: Window visibility ensured after resize');
			} catch (showError) {
				console.warn('⚠️ ALT+C: Failed to ensure window visibility:', showError);
			}

			// Additional delay to ensure window resize completes
			await new Promise(resolve => setTimeout(resolve, 120));

			console.log('🔄 ALT+C: About to set setChatBoxOpen(true)');
			// Show ChatBox React component
			openChatBox();
			console.log('✅ ALT+C: setChatBoxOpen(true) called - ChatBox component should now be visible');

			// Final check to keep window stable
			await new Promise(resolve => setTimeout(resolve, 50));
			console.log('✅ ALT+C: ChatBox setup completed - window should remain stable');

		} catch (error) {
			console.error('❌ ALT+C: Failed to expand window for chat:', error);
			// Still show ChatBox even if window resize fails
			console.log('🔄 ALT+C: Window resize failed, but still showing ChatBox');
			openChatBox();
			console.log('✅ ALT+C: setChatBoxOpen(true) called despite resize failure');
		}

		console.log('🤖 ALT+C: handleAskAI completed - function finished');
	};

	// Handle ChatBox close (shrink window back to compact size)
	const handleCloseChatBox = async () => {
		console.log('🔄 Closing ChatBox and shrinking window');

		try {
			// Hide ChatBox component first
			closeChatBox();
			// STEG 2: Clear image context when closing ChatBox but preserve conversation for follow-ups
			clearImageContextButKeepConversation();

			// Only shrink if no AI response is showing
			if (!currentResult) {
				await invoke('resize_window', {width: 600, height: 50});
				console.log('✅ Window shrunk back to 600x50');
			} else {
				console.log('✅ Keeping window expanded - AI response visible');
			}

			// ChatBox closed, background remains consistent
			console.log('✅ ChatBox closed, background consistent');

		} catch (error) {
			console.error('❌ Failed to shrink window after chat close:', error);
			// Still hide ChatBox even if window resize fails
			closeChatBox();
		}
	};

	const handleFollowUp = async () => {
		console.log('🔄 FOLLOW-UP: handleFollowUp triggered');
		console.log('🔄 FOLLOW-UP: Current conversationId:', conversationId);
		console.log('🔄 FOLLOW-UP: Current currentResult:', currentResult?.id);
		console.log('🔄 FOLLOW-UP: About to expand window for ChatBox visibility');

		try {
			const aiResponseElement = document.querySelector('[data-ai-response]');
			const currentAiHeight = aiResponseElement ? aiResponseElement.scrollHeight : 200;
			const chatBoxHeight = 70;
			const headerHeight = 50;
			const totalHeight = Math.min(currentAiHeight + chatBoxHeight + headerHeight, window.screen.height * 0.8);
			console.log('🔄 FOLLOW-UP: Expanding window to', totalHeight, 'for AI response + ChatBox');

			await invoke('resize_window', {width: 600, height: totalHeight});
			console.log('🔄 FOLLOW-UP: Window expanded successfully');

			await new Promise(resolve => setTimeout(resolve, 100));

			openChatBox();
			console.log('🔄 FOLLOW-UP: ChatBox opened under AI response');
		} catch (error) {
			console.error('❌ FOLLOW-UP: Failed to expand window:', error);
			openChatBox();
			console.log('🔄 FOLLOW-UP: ChatBox opened despite resize failure');
		}
	};

	// Handle AI response dismissal (shrink window back to compact)
	const handleDismissAiResponse = async () => {
		console.log('🔄 Dismissing AI response and shrinking window');

		// Hide AI response using new system
		useAppStore.getState().setCurrentResult(null);

		// STEG 2: Clear image context when dismissing AI response but preserve conversation for follow-ups
		clearImageContextButKeepConversation();

		try {
			// Shrink window back to compact size
			await invoke('resize_window', {width: 600, height: 50});
			console.log('✅ Window shrunk back to 600x50 after AI response dismissed');
		} catch (error) {
			console.error('❌ Failed to shrink window after AI response dismiss:', error);
		}
	};

	// Ta bort!!
	const handleSendMessage = async (message: string) => {
		console.log('💬 ========== MESSAGE SEND DEBUG ==========');
		console.log('💬 SEND: Message sent from ChatBox:', message);
		console.log('🖼️ SEND: Image context available:', !!selectedImageForAI);
		console.log('🔍 SEND: OCR context available:', !!ocrContext?.has_text);
		console.log('💭 SEND: Current conversationId:', conversationId);
		console.log('💭 SEND: conversationId type:', typeof conversationId);
		console.log('💭 SEND: conversationId is null?', conversationId === null);
		console.log('💭 SEND: conversationId is undefined?', conversationId === undefined);
		console.log('💾 SEND: Backend handles conversation tracking (no localStorage)');

		// Clear old AI response immediately when sending new message
		useAppStore.getState().setCurrentResult(null);

		// Start thinking animation
		setIsAiThinking(true);
		setAiProcessingStage('Analyzing screenshot...');

		// Hide ChatBox but keep window expanded for AI response
		closeChatBox();
		// Restore CSS background but keep window size for AI response
		console.log('✅ ChatBox hidden, keeping window expanded for AI response');

		// 🔍 Enhanced message with OCR context if available
		setAiProcessingStage('Processing OCR context...');

		const enhancedMessage = ocrContext?.has_text
			? `${message}\n\n[OCR Context - Text found in image: "${ocrContext.text}" (Confidence: ${Math.round(ocrContext.confidence * 100)}%)]`
			: message;

		// STEG 4: Create comprehensive AI message with text, image, and OCR data
		const aiMessage: AIMessage = {
			text: enhancedMessage,
			imageData: selectedImageForAI || undefined,
			timestamp: Date.now(),
			bounds: undefined, // Future: Add capture bounds if needed
			conversationId: conversationId || undefined // Convert null to undefined for type compatibility
		};

		console.log('📤 Enhanced AI message prepared:', {
			originalText: message,
			enhancedText: enhancedMessage,
			hasImage: !!aiMessage.imageData,
			hasOCR: !!ocrContext?.has_text,
			ocrText: ocrContext?.has_text ? `"${ocrContext.text.substring(0, 30)}..."` : 'None',
			imageSize: aiMessage.imageData ? `${Math.round(aiMessage.imageData.length * 0.75 / 1024)}KB` : 'N/A',
			timestamp: aiMessage.timestamp,
			formattedTime: new Date(aiMessage.timestamp).toLocaleTimeString()
		});

		// STEG 4: Send to AI (mock for now, ready for real API)
		setAiProcessingStage('Sending to OpenAI...');

		try {
			// Try streaming first, fallback to regular if not supported
			let streamingData;
			try {
				streamingData = await sendToAIStreaming(aiMessage);
				console.log('✅ Streaming supported');
			} catch (streamError) {
				console.log('⚠️ Streaming failed, using regular response');
				streamingData = null;
			}

			if (streamingData) {
				// Use streaming with typewriter effect
				setAiProcessingStage('Starting typewriter response...');

				// Resize window for streaming response
				try {
					await invoke('resize_window', {width: 600, height: 400});
					console.log('✅ Window resized for streaming response');
				} catch (error) {
					console.warn('⚠️ Failed to resize window:', error);
				}

				// Create AIResult with streaming data
				const result: AIResult = {
					id: `stream_${Date.now()}`,
					content: '', // Will be filled by streaming
					type: selectedImageForAI ? 'hybrid' : 'text',
					confidence: 0.9,
					timestamp: new Date(),
					capturedImage: selectedImageForAI || undefined,
					position: {x: 100, y: 100},
					streamingData: streamingData
				};

				useAppStore.getState().setCurrentResult(result);
				setIsAiThinking(false);
				setAiProcessingStage('');

			} else {
				// Fallback to regular response
				const aiResponse = await sendToAI(aiMessage);
				setAiProcessingStage('Generating response...');

				console.log('🔄 RECEIVE: AI response conversationId:', aiResponse.conversationId);
				if (aiResponse.conversationId) {
					console.log('💾 RECEIVE: Updating conversationId in state:', aiResponse.conversationId);
					setConversationId(aiResponse.conversationId);
				}

				// Calculate window height based on response length
				const getWindowHeight = (textLength: number) => {
					const screenHeight = window.screen?.height || 900;
					const baseHeight = 80;
					const maxContentHeight = Math.floor(screenHeight * 0.6);

					let contentHeight;
					if (textLength < 100) contentHeight = 80;
					else if (textLength < 300) contentHeight = 120;
					else if (textLength < 600) contentHeight = 160;
					else if (textLength < 1000) contentHeight = 220;
					else contentHeight = maxContentHeight;

					return Math.min(baseHeight + contentHeight, maxContentHeight);
				};

				const windowHeight = getWindowHeight(aiResponse.content.length);
				console.log(`📏 AI response length: ${aiResponse.content.length} chars → window height: ${windowHeight}px`);

				// Short delay to show final stage then resize and show response
				setTimeout(async () => {
					try {
						await invoke('resize_window', {width: 600, height: windowHeight});
						console.log('✅ Window resized for AI response');
					} catch (error) {
						console.warn('⚠️ Failed to resize window:', error);
					}

					const result: AIResult = {
						id: `result_${Date.now()}`,
						content: aiResponse.content,
						type: selectedImageForAI ? 'hybrid' : 'text',
						confidence: 0.9,
						timestamp: new Date(),
						capturedImage: selectedImageForAI || undefined,
						position: {x: 100, y: 100}
					};

					useAppStore.getState().setCurrentResult(result);
					useAppStore.getState().addResult(result);

					setIsAiThinking(false);
					setAiProcessingStage('');

					if (currentUser) {
						console.log('✅ AI request completed for user:', currentUser.email, currentUser.tier);
					}
				}, 100);
			}
		} catch (error) {
			console.error('❌ AI request failed:', error);

			// Create error result for new ResultOverlay
			const errorResult: AIResult = {
				id: `error_${Date.now()}`,
				content: 'Unable to process your request. Please try again or contact support if the issue persists.',
				type: 'text',
				confidence: 0.0,
				timestamp: new Date(),
				capturedImage: selectedImageForAI || undefined,
				position: {x: 100, y: 100}
			};

			useAppStore.getState().setCurrentResult(errorResult);
			setIsAiThinking(false);
			setAiProcessingStage('');
		}

		const contextTypes = [
			selectedImageForAI ? 'Image' : null,
			ocrContext?.has_text ? 'OCR' : null
		].filter(Boolean).join(' + ') || 'Text only';

		console.log('✅ AI response generated with context:', contextTypes);
	};

	// 🔍 Automatic OCR function - runs silently after screenshot
	const runAutomaticOCR = async (imageData: string) => {
		console.log('🔍 Running automatic OCR in background...');

		try {
			const ocrResult = await invoke('extract_text_ocr', {imageData}) as OCRResult;
			setOcrContext(ocrResult);

			if (ocrResult.has_text) {
				console.log(`✅ OCR completed silently - Found text: "${ocrResult.text.substring(0, 50)}..." (${Math.round(ocrResult.confidence * 100)}% confidence)`);
			} else {
				console.log('🔍 OCR completed silently - No text detected');
			}
		} catch (error) {
			console.log('🔍 OCR failed silently, continuing without text context:', error);
			setOcrContext(null);
		}
	};

	// ⚙️ Settings handlers (removed - now using Upgrade to Pro)

	// 🎯 Model Selector handlers (like ChatBox)
	const handleOpenModelSelector = async () => {
		// Always close previous chat/AI response when switching
		useAppStore.getState().setCurrentResult(null);
		closeAll();
		console.log('🎯 Model selector clicked - dropdown approach');
		console.log('📊 Current modelSelectorOpen state:', modelSelectorOpen);

		if (!modelSelectorOpen) {
			// Open ModelSelector: Expand window + show ModelSelector
			console.log('🔄 Opening ModelSelector - expanding window and showing component');

			try {
				// Expand window for model selector with better height
				await invoke('resize_window', {width: 600, height: 250});
				console.log('✅ Window expanded to 600x250 for model selector');

				// Show ModelSelector React component
				openModelSelector();
				console.log('✅ ModelSelector component now visible');

			} catch (error) {
				console.error('❌ Failed to expand window for model selector:', error);
				// Still show ModelSelector even if window resize fails
				openModelSelector();
			}
		} else {
			// Close ModelSelector: Hide ModelSelector + shrink window
			console.log('🔄 Closing ModelSelector - hiding component and shrinking window');
			handleCloseModelSelector();
		}
	};

	const handleCloseModelSelector = async () => {
		console.log('🔄 Closing ModelSelector and shrinking window');

		try {
			// Hide ModelSelector component first
			closeModelSelector();
			// Only shrink if no AI response is showing
			if (!currentResult) {
				await invoke('resize_window', {width: 600, height: 50});
				console.log('✅ Window shrunk back to 600x50');
			} else {
				console.log('✅ Keeping window expanded - AI response visible');
			}

			console.log('✅ ModelSelector closed, background consistent');

		} catch (error) {
			console.error('❌ Failed to shrink window after model selector close:', error);
			// Still hide ModelSelector even if window resize fails
			closeModelSelector();
		}
	};

	const handleModelSelect = (model: string) => {
		setSelectedModel(model);
		console.log('🎯 Model selected:', model);
	};
//Härr
	// STEG 2: Clear image context when starting new session
	const clearImageContext = () => {
		setSelectedImageForAI(null);
		setOcrContext(null); // Also clear OCR context
		setConversationId(null);
		console.log('🗑️ Image and OCR context cleared for new session');
	};

	// Clear only image context but preserve conversation for follow-ups
	const clearImageContextButKeepConversation = () => {
		setSelectedImageForAI(null);
		setOcrContext(null);
		console.log('🗑️ Image and OCR context cleared, backend preserves conversation');
	};


	// Add effect to resize window when thinking
	useEffect(() => {
		if (isAiThinking) {
			invoke('resize_window', {width: 600, height: 100});
		}
	}, [isAiThinking]);

	// Removed aiResponseVisible state - now using ResultOverlay system

	// 🔴 DEBUG: Comprehensive render state logging
	console.log('🔍 App.tsx render - Debug State:', {
		// User session info
		hasCurrentUser: !!currentUser,
		userEmail: currentUser?.email || 'NO USER',
		userTier: currentUser?.tier || 'NO TIER',
		userStatus: currentUser?.subscription_status || 'NO STATUS',

		// AI result info
		hasCurrentResult: !!currentResult,
		currentResultId: currentResult?.id,
		currentResultType: currentResult?.type,
		currentResultContent: currentResult?.content?.substring(0, 30) + '...' || 'NO CONTENT',

		// Component states
		chatBoxOpen,
		modelSelectorOpen,
		debugMode,
		selectedModel,
	});

	// 🔴 RED CIRCLE: Manual test function for debugging
	const testResultOverlay = () => {
		console.log('🔴 RED CIRCLE: Manually testing ResultOverlay...');
		const testResult: AIResult = {
			id: `test_${Date.now()}`,
			content: '🔴 This is a test AI response to verify that the ResultOverlay works correctly. You should see upgrade buttons and model selector.',
			type: 'text',
			confidence: 1.0,
			timestamp: new Date(),
			capturedImage: undefined,
			position: {x: 100, y: 100}
		};

		useAppStore.getState().setCurrentResult(testResult);
		console.log('🔴 RED CIRCLE: Test result set - ResultOverlay should appear!');
	};

	// 🧪 Debug function for testing model access
	const debugTestModelAccess = async (tier: string = 'premium') => {
		try {
			// @ts-ignore
			const result = await invoke('debug_test_tier_models', {tier}) as any;
			console.log(`🧪 Model access test for ${tier}:`, result);
			alert(`🧪 Debug: ${tier} tier has ${result.model_count} models\n\nGPT-4o: ${result.can_use_gpt4o ? '✅' : '❌'}\nGPT-4o-mini: ${result.can_use_gpt4o_mini ? '✅' : '❌'}\nClaude Haiku: ${result.can_use_claude_haiku ? '✅' : '❌'}`);
			return result;
		} catch (error) {
			console.error('❌ Debug test failed:', error);
			alert('❌ Debug test failed: ' + error);
		}
	}

	// 🔴 RED CIRCLE: Make test function available in browser console
	if (typeof window !== 'undefined') {
		(window as any).testResultOverlay = testResultOverlay;
		(window as any).debugTestModelAccess = debugTestModelAccess;
		console.log('🔴 RED CIRCLE: Run testResultOverlay() in console to test UI');
		console.log('🧪 DEBUG: Run debugTestModelAccess("premium") to test model access');
	}


	if (!isReady) {
		return (
			<div className="flex items-center justify-center h-screen bg-gray-50">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
			</div>
		);
	}

	// Temporary: Skip permissions for testing
	// if (!hasPermissions) {
	// 	return <PermissionWizard onPermissionsGranted={checkPermissions} />;
	// }

	return (
		<WindowAnimation isVisible={windowVisible} animationDuration={300}>
			<div
				className={`h-full flex flex-col px-4 py-1.5 rounded-xl border border-gray-200 shadow-lg relative overflow-hidden ${
					windowVisible ? 'animate-window-entrance' : 'opacity-0'
				}`}
				style={{
					backgroundColor: 'rgba(20, 20, 20, 0.5)',
					backdropFilter: 'blur(10px)',
					borderColor: 'rgba(255, 255, 255, 0.2)'
				}}
				data-tauri-drag-region
			>
				{/* Compact palette header */}
				<div className="flex items-center justify-between flex-shrink-0">
					<div className="flex items-center space-x-2">
						<div className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
							<svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
						</div>
						<span className="text-xs font-medium text-white">Vely</span>

						{/* 🔍 DEBUG: Current User Display */}
						<ProfileDropdown
							currentUser={currentUser}
							debugMode={debugMode}
							onLoginSuccess={handleLoginSuccess}
							onLogout={handleLogout}
							onUserUpdate={handleUserUpdate}
							onManageSubscription={handleManageSubscription}clearUserSession={clearUserSession}
						/>

						{/* Screenshot result - BETWEEN LOGO AND BUTTON */}
						{screenshotResult && (
							<div
								className="flex items-center space-x-1 px-2 py-0.5 bg-gray-500/20 rounded-lg border border-white/10 backdrop-blur-sm">
								<img
									src={screenshotResult}
									alt="Screenshot"
									className="w-6 h-6 object-cover rounded border border-white/20"
								/>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex space-x-1.5" data-tauri-drag-region="false">
						{/* Upgrade to Pro Button - Only show for free tier */}
					{(!currentUser || currentUser.tier === 'free') && (
						<button
							onClick={() => handleUpgradeClick('pro')}
							className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white px-3 py-0.5 rounded-lg transition-colors text-xs flex items-center space-x-1.5 backdrop-blur-sm border border-purple-400/20"
						>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
							<span>Upgrade to Pro</span>
						</button>)}


						{/* Model Selector Button */}
						<button
							onClick={handleOpenModelSelector}
							className="bg-purple-500/20 hover:bg-purple-500/30 text-white px-3 py-0.5 rounded-lg transition-colors text-xs flex items-center space-x-1.5 backdrop-blur-sm border border-white/10"
							title={`Current model: ${selectedModel}`}
						>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
											d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
							</svg>
							<span>Models</span>
							<span className="text-xs opacity-75">({selectedModel.split('-')[0]})</span>
						</button>

						{/* Ask AI Button */}
						<button
							onClick={handleAskAI}
							className="bg-gray-500/20 hover:bg-gray-500/30 text-white px-3 py-1 rounded-lg transition-colors text-xs flex items-center space-x-1.5 backdrop-blur-sm border border-white/10"
						>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
											d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
							</svg>
							<span>Ai</span>
						</button>

						{/* Interactive Selection Button - With loading state */}
						<button
							onClick={testScreenSelection}
							disabled={isCreatingOverlay}
							className={`${
								isCreatingOverlay
									? 'bg-gray-500/30 cursor-not-allowed'
									: 'bg-gray-500/20 hover:bg-gray-500/30'
							} text-white px-3 py-0.5 rounded-lg transition-colors text-xs flex items-center space-x-1.5 backdrop-blur-sm border border-white/10`}
						>
							{isCreatingOverlay ? (
								<>
									<div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									<span>Creating...</span>
								</>
							) : (
								<>
									<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
													d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
									</svg>
									<span>Select</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Main content area with fixed top and bottom margins */}
				<div className="flex flex-col justify-between h-full overflow-hidden">
					{/* Top margin from header - old AIResponse removed, now using ResultOverlay */}
					<div className="mt-0.1 flex-shrink-0">
						{/* AI Response now handled by ResultOverlay component below */}
					</div>

					{/* Bottom elements with fixed margin from AI Response */}
					<div className="flex flex-col flex-shrink-0 mt-0.5"> {/* mt-2 = 8px top margin */}
						<ThinkingAnimation
							isVisible={isAiThinking}
							currentStage={aiProcessingStage}
						/>
						<div data-tauri-drag-region="false">
							<ModelSelector
								isVisible={modelSelectorOpen}
								onClose={handleCloseModelSelector}
								onModelSelect={handleModelSelect}
								selectedModel={selectedModel}
							/>
						</div>
					</div>
				</div>


				{/* 🔴 RED CIRCLE: Debug currentResult state */}

				{/* Result overlay */}
				{currentResult && (
					<div data-tauri-drag-region="false">
						<ResultOverlay
							result={currentResult}
							onFollowUp={handleFollowUp}
						/>
					</div>
				)}

				{/* ChatBox positioned after AI response for follow-ups */}
				{chatBoxOpen && (
					<div data-tauri-drag-region="false" className="mt-2">
						<ChatBox
							isVisible={chatBoxOpen}
							onSend={handleSendMessage}
							onClose={handleCloseChatBox}
							imageContext={selectedImageForAI || undefined}
							currentUser={currentUser}
						/>
					</div>
				)}
				{/* 🔴 RED CIRCLE: ResultOverlay should render above this line when currentResult exists */}


				{/* Login Dialog - Removed since login is now handled in ProfileDropdown */}

				{/* ⚙️ Settings Dialog - Removed, now using Upgrade to Pro button */}


			</div>
		</WindowAnimation>
	);
}

export default App;
