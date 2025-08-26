import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { Store } from '@tauri-apps/plugin-store';
import userService, { User } from './user-service';

class AuthService {
    private currentUser: User | null = null;
    private authListeners: Array<(user: User | null) => void> = [];
    private apiUrl = process.env.NODE_ENV === 'production'
        ? 'https://api.finalyze.pro' // Railway backend that's working
        : 'https://api.finalyze.pro'; // Use Railway for development too since local DB is not configured
    private sessionKey = 'framesense_user_session';
    private secureStore: Store | null = null;


    async initialize() {
        // Initialize secure store
        try {
            this.secureStore = await Store.load('auth.json');
        } catch (error) {
            console.error('❌ Failed to initialize secure store:', error);
        }

        // Load current user from local storage
        await this.loadCurrentUser();
    }

    // Secure store helper methods for refresh tokens
    private async saveRefreshToken(token: string): Promise<void> {
        try {
            if (this.secureStore) {
                await this.secureStore.set('refresh_token', token);
                await this.secureStore.save();
                console.log('✅ SECURE STORAGE: Refresh token saved to secure store', {
                    tokenLength: token.length,
                    tokenPreview: token.substring(0, 20) + '...',
                    timestamp: new Date().toISOString()
                });
            } else {
                console.warn('⚠️ SECURE STORAGE: Store not available, refresh token not saved');
            }
        } catch (error) {
            console.error('❌ SECURE STORAGE: Failed to save refresh token:', error);
        }
    }

    private async getRefreshToken(): Promise<string | null> {
        try {
            if (this.secureStore) {
                const token = await this.secureStore.get<string>('refresh_token');
                console.log('🔍 SECURE STORAGE: Getting refresh token', {
                    hasToken: !!token,
                    tokenLength: token?.length || 0,
                    tokenPreview: token ? token.substring(0, 20) + '...' : 'NO TOKEN',
                    timestamp: new Date().toISOString()
                });
                return token || null;
            } else {
                console.warn('⚠️ SECURE STORAGE: Store not available');
                return null;
            }
        } catch (error) {
            console.error('❌ SECURE STORAGE: Failed to get refresh token:', error);
            return null;
        }
    }

    private async clearRefreshToken(): Promise<void> {
        try {
            if (this.secureStore) {
                await this.secureStore.delete('refresh_token');
                await this.secureStore.save();
                console.log('✅ SECURE STORAGE: Refresh token cleared from secure store', {
                    timestamp: new Date().toISOString()
                });
            } else {
                console.warn('⚠️ SECURE STORAGE: Store not available');
            }
        } catch (error) {
            console.error('❌ SECURE STORAGE: Failed to clear refresh token:', error);
        }
    }

    async loginWithDatabase(email: string, password: string): Promise<User> {
        try {
            console.log('🔐 Logging in user with backend API:', email);

            // Use Tauri HTTP client for secure requests
            console.log('🔍 LOGIN: Making request to:', `${this.apiUrl}/api/auth/login`);
            const response = await fetch(`${this.apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json();

            if (!data.success || !data.user) {
                throw new Error('Invalid response from server');
            }

            const user = data.user;

            // Store access token in memory (short-lived)
            if (data.access_token) {
                userService.setAccessToken(data.access_token);
                console.log('✅ Access token stored in memory');
            }

            // Store refresh token securely (long-lived)
            if (data.refresh_token) {
                await this.saveRefreshToken(data.refresh_token);
                console.log('✅ Refresh token stored securely');
            }

            // Fallback for old token format
            if (data.token && !data.access_token) {
                userService.setAccessToken(data.token);
                console.log('✅ Legacy token stored in memory');
            }

						this.saveUserSessionLocal(user);
						console.log('✅ DEBUG: User session saved to localStorage');

            // Use tier from backend response
            // user.tier is already set correctly from backend

            this.currentUser = user;

            console.log('🔍 DEBUG: About to save user session:', {
                email: user.email,
                tier: user.tier,
                hasToken: !!user.token,
                tokenLength: user.token ? user.token.length : 0
            });

            // Save user session to BOTH Tauri storage AND in memory
            try {
                // Convert user to Tauri-compatible format
                const tauriUser = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    tier: user.tier,
                    token: data.token,
                    usage: {
                        daily: user.usage_daily || 0,
                        total: user.usage_total || 0,
                        last_reset: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
                    },
                    created_at: user.created_at,
                    subscription_status: user.subscription_status,
                    stripe_customer_id: user.stripe_customer_id,
                    usage_daily: user.usage_daily,
                    usage_total: user.usage_total,
                    updated_at: user.updated_at
                };

                console.log('🔍 DEBUG: Converted user for Tauri:', {
                    email: tauriUser.email,
                    tier: tauriUser.tier,
                    hasUsage: !!tauriUser.usage,
                    usageDaily: tauriUser.usage.daily
                });

                // @ts-ignore - invoke is available in Tauri context
                await invoke('save_user_session', { user: tauriUser });
                console.log('✅ DEBUG: User session saved to Tauri storage successfully');
            } catch (error) {
                console.error('❌ DEBUG: Failed to save to Tauri storage:', error);
                console.log('ℹ️ DEBUG: Using localStorage only as fallback');
            }

            // Notify listeners
            this.notifyAuthListeners(user);

            console.log('✅ User logged in successfully:', user.email, user.tier);
            return user;
        } catch (error) {
            console.error('❌ Login failed:', error);
            throw new Error(`Login failed: ${error}`);
        }
    }

		// Kolla om denna kan fungera istället för att manuellt refresha token vid 401. Tanken är
	  // att man ska skicka in fetch-funktionen i denna funktion och att den refreshar automatiskt då
		// Den verkar för tillfället inte fungera
		withRefresh(fetchFn: () => Promise<Response>): Promise<Response> {
			console.log('🔄 withRefresh: Making initial request');
			return fetchFn()
				.then((res) => {
					if (res.status === 401) {
						console.log('🔄 withRefresh: Got 401, refreshing token...');
						return this.refreshToken().then(() => {
							console.log('🔄 withRefresh: Token refreshed, retrying request');
							return fetchFn();
						});
					}
					console.log(`🔄 withRefresh: Request successful (${res.status})`);
					return res;
				})
				.catch((err) => {
					console.error('🔄 withRefresh: Error:', err);
					throw err;
				});
		}

			async refreshToken() {
		const startTime = Date.now();
		try {
			console.log('🔄 REFRESH TOKEN: Starting refresh process...', {
				timestamp: new Date().toISOString(),
				currentUser: this.currentUser?.email || 'NO USER'
			});

			// Get refresh token from secure storage
			const refreshToken = await this.getRefreshToken();
			if (!refreshToken) {
				console.error('❌ REFRESH TOKEN: No refresh token available in secure storage');
				throw new Error('No refresh token available');
			}

			console.log('🔄 REFRESH TOKEN: Making refresh request to backend...', {
				url: `${this.apiUrl}/api/auth/refresh`,
				refreshTokenPreview: refreshToken.substring(0, 20) + '...'
			});

			// Use Tauri HTTP client for secure requests
			const response = await fetch(`${this.apiUrl}/api/auth/refresh`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ refresh_token: refreshToken }),
			});

			console.log('🔄 REFRESH TOKEN: Backend response received', {
				status: response.status,
				ok: response.ok,
				statusText: response.statusText
			});

			if (!response.ok) {
				console.error('❌ REFRESH TOKEN: Backend rejected refresh token', {
					status: response.status,
					statusText: response.statusText
				});
				// If refresh fails, clear the invalid refresh token
				await this.clearRefreshToken();
				throw new Error(`Refresh failed: ${response.status}`);
			}

			const data = await response.json();
			console.log('🔄 REFRESH TOKEN: Backend response data:', {
				success: data.success,
				hasAccessToken: !!data.access_token,
				hasRefreshToken: !!data.refresh_token,
				accessTokenLength: data.access_token?.length || 0,
				refreshTokenLength: data.refresh_token?.length || 0
			});

			if (data.success && data.access_token) {
				console.log('✅ REFRESH TOKEN: Setting new access token in memory');
				userService.setAccessToken(data.access_token);

				// If we get a new refresh token, update it in secure store
				if (data.refresh_token) {
					await this.saveRefreshToken(data.refresh_token);
					console.log('✅ REFRESH TOKEN: Updated refresh token in secure store');
				}

				const duration = Date.now() - startTime;
				console.log('🎉 REFRESH TOKEN: Process completed successfully!', {
					duration: `${duration}ms`,
					newAccessTokenPreview: data.access_token.substring(0, 20) + '...',
					timestamp: new Date().toISOString()
				});

				return data.access_token;
			}

			console.error('❌ REFRESH TOKEN: Invalid response format, clearing all tokens');
			userService.clearAccessToken();
			await this.clearRefreshToken();
			throw new Error('Invalid refresh response');
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('💥 REFRESH TOKEN: Process failed!', {
				error: error.message,
				duration: `${duration}ms`,
				timestamp: new Date().toISOString()
			});
			userService.clearAccessToken();
			await this.clearRefreshToken();
			throw error;
		}
	}

async logout(): Promise<void> {
    console.log('🔍 DEBUG: logout() called');
    console.trace('🔍 DEBUG: logout callsite'); // visar vem som anropade denna metod

    // Get refresh token before clearing it to send to backend
    const refreshToken = await this.getRefreshToken();

    // Notify backend about logout (optional - to invalidate token server-side)
    if (refreshToken) {
        try {
            await fetch(`${this.apiUrl}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            console.log('✅ Backend logout successful');
        } catch (error) {
            console.log('⚠️ Backend logout failed (continuing with local logout):', error);
        }
    }

    try {
        // @ts-ignore (i Tauri-miljö)
        await invoke('clear_user_session');
        console.log('✅ DEBUG: Tauri session cleared successfully');
    } catch (error) {
        console.log('❌ DEBUG: Tauri session clear failed:', error);
    }

    // Clear refresh token from secure store
    await this.clearRefreshToken();

    // Clear access token from memory
    userService.clearAccessToken();

    // Clear user session locally
    this.clearUserSessionLocal();
    this.currentUser = null;
    console.log('🔍 DEBUG: Set currentUser to null');

    // Notify listeners
    this.notifyAuthListeners(null);
    console.log('✅ DEBUG: Notified auth listeners with null');

    console.log('🚪 DEBUG: User logged out successfully');
}

    async loadCurrentUser(): Promise<User | null> {
        console.log('🔍 DEBUG: Starting loadCurrentUser()...');
        try {
            // First try to load from Tauri storage (more reliable)
            let user: User | null = null;

            console.log('🔍 DEBUG: Attempting to load from Tauri storage...');
            try {
                // @ts-ignore - invoke is available in Tauri context
                const tauriUser: any = await invoke('load_user_session');
                if (tauriUser) {
                    console.log('✅ DEBUG: Raw user from Tauri storage:', {
                        email: tauriUser.email,
                        tier: tauriUser.tier,
                        hasToken: !!tauriUser.token,
                        hasUsage: !!tauriUser.usage,
                        usageFormat: typeof tauriUser.usage
                    });

                    // Convert from Tauri format back to JavaScript format
                    user = {
                        id: tauriUser.id,
                        email: tauriUser.email,
                        name: tauriUser.name,
                        tier: tauriUser.tier, // Use actual tier from backend
                        token: tauriUser.token,
                        created_at: tauriUser.created_at,
                        subscription_status: tauriUser.subscription_status,
                        stripe_customer_id: tauriUser.stripe_customer_id,
                        usage_daily: tauriUser.usage?.daily || tauriUser.usage_daily || 0,
                        usage_total: tauriUser.usage?.total || tauriUser.usage_total || 0,
                        updated_at: tauriUser.updated_at
                    };

                    console.log('✅ DEBUG: Converted user from Tauri:', {
                        email: user.email,
                        tier: user.tier,
                        hasToken: !!user.token,
                        usageDaily: user.usage_daily
                    });

                    // Sync to localStorage as backup
                    if (user) {
                        this.saveUserSessionLocal(user);
                    }
                } else {
                    console.log('❌ DEBUG: Tauri storage returned null/undefined');
                }
            } catch (tauriError) {
                console.log('❌ DEBUG: Tauri session failed with error:', tauriError);
                console.log('🔍 DEBUG: Trying localStorage fallback...');
                // Fallback to localStorage
                user = this.loadUserSessionLocal();
                if (user) {
                    // Keep original tier from backend
                    // user.tier is already correct
                    console.log('✅ DEBUG: Loaded user session from localStorage:', {
                        email: user.email,
                        tier: user.tier,
                        hasToken: !!user.token,
                        tokenLength: user.token ? user.token.length : 0
                    });
                } else {
                    console.log('❌ DEBUG: localStorage also returned null');
                }
            }

            this.currentUser = user;
            console.log('🔍 DEBUG: Set currentUser to:', user ? `${user.email} (${user.tier})` : 'null');

            if (user) {
                // CRITICAL FIX: Restore access token to prevent automatic logout
                if (user.token) {
                    userService.setAccessToken(user.token);
                    console.log('✅ DEBUG: Access token restored from session');
                } else {
                    console.log('⚠️ DEBUG: No token found in user session');
                }
            }
            if (user) {
                // CRITICAL FIX: Restore access token to prevent automatic logout
                if (user.token) {
                    userService.setAccessToken(user.token);
                    console.log('✅ DEBUG: Access token restored from session');
                } else {
                    console.log('⚠️ DEBUG: No token found in user session');
                }

                // Notify listeners
                this.notifyAuthListeners(user);
                console.log('✅ DEBUG: Notified auth listeners with user');
            } else {
                this.notifyAuthListeners(null);
                console.log('⚠️ DEBUG: Notified auth listeners with null user');
            }

            return user;
        } catch (error) {
            console.error('❌ DEBUG: loadCurrentUser failed with error:', error);
            return null;
        }
    }

    async refreshUserStatus(): Promise<User | null> {
        try {
            if (!this.currentUser) {
                return null;
            }

            // Verify user status with backend API using Tauri HTTP client
            const response = await this.withRefresh(() =>
                fetch(`${this.apiUrl}/api/auth/verify`, {
                    method: 'GET',
                    headers: {
                        ...userService.getAuthHeader(),
                    },
                })
            );

            const data = await response.json();
            if (data.success && data.user) {
                const freshUser = data.user;

                // Use tier from backend response
                // freshUser.tier is already correct

                this.currentUser = freshUser;
                this.notifyAuthListeners(freshUser);
                return freshUser;
            }

            return this.currentUser;
        } catch (error) {
            console.error('❌ Failed to refresh user status:', error);
            return null;
        }
    }

    // Local storage helper methods
    private saveUserSessionLocal(user: User): void {
        try {
            console.log('🔍 DEBUG: Saving to localStorage with key:', this.sessionKey);
            const userToSave = JSON.stringify(user);

            localStorage.setItem(this.sessionKey, userToSave);
            console.log('✅ DEBUG: User session saved to localStorage successfully:', {
                email: user.email,
                tier: user.tier,
                dataLength: userToSave.length
            });
        } catch (error) {
            console.error('❌ DEBUG: Failed to save user session to localStorage:', error);
        }
    }

    private loadUserSessionLocal(): User | null {
        try {
            console.log('🔍 DEBUG: Loading from localStorage with key:', this.sessionKey);
            const userJson = localStorage.getItem(this.sessionKey);
            console.log('🔍 DEBUG: localStorage raw data:', userJson ? 'Found data' : 'No data found');

            if (userJson) {
                const user: User = JSON.parse(userJson);
                console.log('✅ DEBUG: User session loaded from localStorage:', {
                    email: user.email,
                    tier: user.tier,
                    dataLength: userJson.length
                });
                return user;
            }
            console.log('❌ DEBUG: No user data found in localStorage');
            return null;
        } catch (error) {
            console.error('❌ DEBUG: Failed to load user session from localStorage:', error);
            return null;
        }
    }

    private clearUserSessionLocal(): void {
        try {
            console.log('🔍 DEBUG: Clearing localStorage with key:', this.sessionKey);
            localStorage.removeItem(this.sessionKey);
            console.log('✅ DEBUG: User session cleared from localStorage');
        } catch (error) {
            console.error('❌ DEBUG: Failed to clear user session from localStorage:', error);
        }
    }

    getCurrentUser(): User | null {
        return this.currentUser;
    }

    isLoggedIn(): boolean {
        return this.currentUser !== null;
    }

    getUserTier(): string {
        // Return actual user tier
        return this.currentUser?.tier || 'free';
    }

    async getAvailableModels(tier?: string): Promise<string[]> {
        try {
            const userTier = this.currentUser?.tier || 'free'; // Use actual user tier
            const models = await invoke<string[]>('get_available_models', { userTier });
            return models;
        } catch (error) {
            console.error('❌ Failed to get available models:', error);
            return ['GPT-3.5-turbo']; // Fallback
        }
    }

    async canUseModel(model: string, tier?: string): Promise<boolean> {
        try {
            // All logged in users can use any model
            return this.isLoggedIn();
        } catch (error) {
            console.error('❌ Failed to check model access:', error);
            return false;
        }
    }

    // Get required tier for a specific model (for UI display only)
    getRequiredTier(model: string): string {
        // All models available to logged in users
        return this.isLoggedIn() ? 'premium' : 'premium';
    }

    // Get daily limit for user tier
    getDailyLimit(tier?: string): number {
        // Generous limit for all logged in users
        return this.isLoggedIn() ? 5000 : 50;
    }

    // Get usage percentage
    getUsagePercentage(): number {
        if (!this.currentUser) return 0;
        const daily = this.currentUser.usage_daily || 0;
        const limit = this.getDailyLimit();
        return Math.min(100, (daily / limit) * 100);
    }

    // Verify payment status (for manual checking)
    async verifyPaymentStatus(): Promise<User | null> {
        try {
            if (!this.currentUser) return null;

            // Refresh user status to get latest tier
            const updatedUser = await this.refreshUserStatus();
            return updatedUser;
        } catch (error) {
            console.error('❌ Failed to verify payment status:', error);
            return null;
        }
    }

    // Auth state listeners for UI updates
    addAuthListener(callback: (user: User | null) => void): void {
        this.authListeners.push(callback);
    }

    removeAuthListener(callback: (user: User | null) => void): void {
        this.authListeners = this.authListeners.filter(listener => listener !== callback);
    }

    private notifyAuthListeners(user: User | null): void {
        this.authListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('❌ Error in auth listener:', error);
            }
        });
    }

    // Payment and upgrade functionality
    openUpgradePage(plan?: string): void {
        const baseUrl = 'https://vely22.vercel.app'; // Hardcoded for simplicity
        const upgradeUrl = plan
            ? `${baseUrl}/payments?plan=${plan}`
            : `${baseUrl}/payments`;

        console.log('🔗 Opening upgrade page:', upgradeUrl);
        window.open(upgradeUrl, '_blank');
    }

    // DEBUG: Manual session check function
    async debugCheckSessions(): Promise<void> {
        console.log('🔍 DEBUG: === MANUAL SESSION CHECK ===');
        console.log('🔍 DEBUG: Current user in memory:', this.currentUser ? `${this.currentUser.email} (${this.currentUser.tier})` : 'null');

        // Check localStorage
        console.log('🔍 DEBUG: Checking localStorage...');
        const localUser = this.loadUserSessionLocal();
        console.log('🔍 DEBUG: localStorage result:', localUser ? `${localUser.email} (${localUser.tier})` : 'null');

        // Check Tauri storage
        console.log('🔍 DEBUG: Checking Tauri storage...');
        try {
            // @ts-ignore - invoke is available in Tauri context
            const tauriUser: any = await invoke('load_user_session');
            if (tauriUser) {
                console.log('🔍 DEBUG: Tauri storage result:', `${tauriUser.email} (${tauriUser.tier})`);
                console.log('🔍 DEBUG: Tauri user structure:', {
                    hasUsage: !!tauriUser.usage,
                    usageDaily: tauriUser.usage?.daily,
                    usageDailyField: tauriUser.usage_daily
                });
            } else {
                console.log('🔍 DEBUG: Tauri storage result: null');
            }
        } catch (error) {
            console.log('❌ DEBUG: Tauri storage error:', error);
        }

        console.log('🔍 DEBUG: === END SESSION CHECK ===');
    }
}

// Export singleton instance
export const authService = new AuthService();

// Initialize when imported
authService.initialize().catch(error => {
    console.error('❌ Failed to initialize auth service:', error);
});

// DEBUG: Expose debug function globally for browser console
if (typeof window !== 'undefined') {
    (window as any).debugCheckSessions = () => authService.debugCheckSessions();
    console.log('🔍 DEBUG: Global debugCheckSessions() function available in browser console');
}
