import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { authService } from '../services/auth-service-db';
import { type User } from '../services/user-service';
import { useUIState } from '../hooks/useUIState';
//vad är core?
interface ProfileDropdownProps {
    currentUser: User | null;
    debugMode: boolean;
    onLoginSuccess: (user: User) => void | Promise<void>;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
    onManageSubscription?: () => void;
    clearUserSession: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
    currentUser,
    debugMode,
    onLoginSuccess,
    onLogout,
    onUserUpdate,
    onManageSubscription,
    clearUserSession,
}) => {
    const { profileDropdownOpen, openProfileDropdown, closeProfileDropdown } = useUIState();
    const isOpen = profileDropdownOpen;
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Animation state like ChatBox and ModelSelector
    const [dropdownVisible, setDropdownVisible] = useState(false);

    // Animation effect - same pattern as ChatBox and ModelSelector
    useEffect(() => {
        if (isOpen) {
            setDropdownVisible(false);
            setTimeout(() => setDropdownVisible(true), 10);
        } else {
            setDropdownVisible(false);
        }
    }, [isOpen]);

    // Handle window resizing when dropdown opens/closes
    useEffect(() => {
        const resizeWindow = async () => {
            try {
                if (isOpen && dropdownRef.current) {
                    // Longer window for the tall narrow dropdown
                    const minHeight = 300; // 500px dropdown + 50px for header/spacing
                    
                    await invoke('resize_window', { 
                        width: 600, 
                        height: minHeight 
                    });
                    console.log('✅ ALT+C: ProfileDropdown resized window for tall dropdown:', minHeight);
                } else if (!isOpen) {
                    // Only reset to small size when dropdown actually closes
                    // DON'T resize if this effect is running due to currentUser change
                    console.log('✅ ALT+C: ProfileDropdown dropdown closed - checking if safe to resize');
                    
                    // Add safety check: only resize to small if no other UI components are open
                    // This prevents conflicting with ChatBox, ModelSelector, etc.
                    try {
                        // Check current window size first to see if something else expanded it
                        const windowInfo = await invoke('get_window_info') as { height?: number; width?: number } | null;
                        console.log('✅ ALT+C: Current window info before ProfileDropdown resize:', windowInfo);
                        
                        // Only shrink if window is currently large (indicating dropdown was open)
                        // This prevents shrinking when other components have expanded the window
                        if (windowInfo && windowInfo.height && windowInfo.height > 200) {
                            await invoke('resize_window', { 
                                width: 600, 
                                height: 50
                            });
                            console.log('✅ ALT+C: ProfileDropdown reset window to small size');
                        } else {
                            console.log('✅ ALT+C: ProfileDropdown skipped resize - window not in dropdown state');
                        }
                    } catch (infoError) {
                        console.log('✅ ALT+C: Could not check window info, skipping ProfileDropdown resize to prevent conflicts');
                    }
                }
            } catch (error) {
                console.error('❌ ALT+C: ProfileDropdown failed to resize window:', error);
            }
        };

        // Small delay to ensure DOM is updated
        const timer = setTimeout(resizeWindow, 100);
        return () => clearTimeout(timer);
    }, [isOpen, showLoginForm]); // Removed currentUser dependency - only resize on actual UI state changes

    const handleToggleOpen = () => {
        if (isOpen) {
            closeProfileDropdown();
        } else {
            openProfileDropdown();
            setShowLoginForm(false);
            setError('');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await authService.loginWithDatabase(email, password);
            await Promise.resolve(onLoginSuccess(user));
            setShowLoginForm(false);
            setEmail('');
            setPassword('');
            closeProfileDropdown();
        } catch (error) {
            console.error('❌ Login failed:', error);
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            console.trace('ProfileDropdown: handleLogout called'); // visar varifrån knappen/funktionen kallades
            await authService.logout();
            onLogout();
            closeProfileDropdown();
        } catch (error) {
            console.error('❌ Logout failed:', error);
            alert('Unable to sign out. Please try again.');
        }
    };



    const openRegistrationPage = () => {
        window.open('https://api.finalyze.pro', '_blank');
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'premium': return 'text-blue-400 bg-blue-600/15';
            case 'pro': return 'text-purple-300 bg-purple-700/20';
            case 'enterprise': return 'text-yellow-400 bg-yellow-600/15';
            default: return 'text-gray-300 bg-gray-500/20';
        }
    };

    const getTierBorderColor = (tier: string) => {
        switch (tier) {
            case 'premium': return 'border-blue-600/30 hover:border-blue-500/40';
            case 'pro': return 'border-purple-700/35 hover:border-purple-600/45';
            case 'enterprise': return 'border-yellow-600/30 hover:border-yellow-500/40';
            default: return 'border-white/20 hover:border-white/30';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleToggleOpen}
                className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 border backdrop-blur-sm ${
                    currentUser ? getTierBorderColor(currentUser.tier) : 'border-white/20 hover:border-white/30'
                }`}
                title={currentUser ? `${currentUser.name} (${currentUser.tier})` : 'Profile & Settings'}
            >
                <svg
                    className="w-4 h-4 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => closeProfileDropdown()}
                    />
                    <div
                        ref={dropdownRef}
                        className={`fixed left-1/2 top-12 transform -translate-x-1/2 w-72 h-[500px] bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 shadow-xl z-50 overflow-y-auto transition-all duration-300 ease-out ${
                            dropdownVisible 
                                ? 'opacity-100 scale-100 translate-y-0' 
                                : 'opacity-0 scale-95 -translate-y-2'
                        }`}
                    >
                        {currentUser ? (
                            // Logged in user view
                            <>
                                <div className="p-4 border-b border-white/10">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                            {currentUser.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{currentUser.name}</div>
                                            <div className="text-white/60 text-sm">{currentUser.email}</div>
                                        </div>
                                    </div>
                                    <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getTierColor(currentUser.tier)} text-center`}>
                                        {currentUser.tier.charAt(0).toUpperCase() + currentUser.tier.slice(1)} Plan
                                    </div>
                                </div>

                                <div className="p-2">
                                    <button
                                        onClick={onManageSubscription}
                                        className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <span>🌐</span>
                                        <span>Manage Subscription</span>
                                    </button>



                                    <hr className="my-2 border-white/10" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center space-x-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <span>🚪</span>
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            // Not logged in view
                            <>
                                <div className="p-4 border-b border-white/10">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gray-500/30 rounded-full flex items-center justify-center text-white/60">
                                            👤
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">Not Logged In</div>
                                            <div className="text-white/60 text-sm">Free tier access</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    {!showLoginForm ? (
                                        <>
                                            <button
                                                onClick={() => setShowLoginForm(true)}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors mb-3"
                                            >
                                                🔑 Login to Premium
                                            </button>
                                            
                                            <button
                                                onClick={openRegistrationPage}
                                                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                                            >
                                                📝 Create Account
                                            </button>


                                        </>
                                    ) : (
                                        // Login form
                                        <form onSubmit={handleLogin} className="space-y-3">
                                            <div>
                                                <label className="block text-white/80 text-sm mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm"
                                                    placeholder="your@email.com"
                                                    required
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-white/80 text-sm mb-1">Password</label>
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm"
                                                    placeholder="Password"
                                                    required
                                                />
                                            </div>
                                            
                                            {error && (
                                                <div className="text-red-400 text-sm">{error}</div>
                                            )}
                                            
                                            <div className="flex space-x-2">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                                                >
                                                    {loading ? 'Logging in...' : 'Login'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLoginForm(false)}
                                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProfileDropdown; 