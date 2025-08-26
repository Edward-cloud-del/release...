import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface User {
    id: string;
    email: string;
    name: string;
    tier: string;
    subscription_status: string;
    stripe_customer_id?: string;
    usage_daily: number;
    usage_total: number;
    created_at: string;
    updated_at: string;
}

interface UserMenuProps {
    user: User;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onUserUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefreshStatus = async () => {
        setRefreshing(true);
        try {
            const updatedUser = await invoke<User | null>('refresh_user_status_db');
            if (updatedUser) {
                onUserUpdate(updatedUser);
                if (updatedUser.tier !== user.tier) {
                    alert(`🎉 Status updated! You now have ${updatedUser.tier} access!`);
                }
            }
        } catch (error) {
            console.error('Failed to refresh status:', error);
            alert('Unable to refresh account status. Please try again.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        try {
            await invoke('logout_user_db');
            onLogout();
            setIsOpen(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const openManageSubscription = () => {
        window.open('https://vely22.vercel.app/account.html', '_blank');
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'premium': return 'text-blue-300 bg-blue-500/20';
            case 'pro': return 'text-purple-200 bg-purple-600/25 shadow-inner shadow-purple-900/30';
            case 'enterprise': return 'text-yellow-300 bg-yellow-500/20';
            default: return 'text-gray-300 bg-gray-500/20';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title={`${user.name} (${user.tier})`}
            >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTierColor(user.tier)}`}>
                    {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                </span>
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 shadow-xl z-50">
                        <div className="p-4 border-b border-white/10">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-white font-medium">{user.name}</div>
                                    <div className="text-white/60 text-sm">{user.email}</div>
                                </div>
                            </div>
                            <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getTierColor(user.tier)} text-center`}>
                                {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Plan
                            </div>
                        </div>

                        <div className="p-2">
                            <button
                                onClick={handleRefreshStatus}
                                disabled={refreshing}
                                className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                                <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
                            </button>

                            <button
                                onClick={openManageSubscription}
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
                    </div>
                </>
            )}
        </div>
    );
};

export default UserMenu; 