import React, { useState } from 'react';
import { authService, type User } from '../services/auth-service-db';

interface LoginDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: User) => void | Promise<void>;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await authService.loginWithDatabase(email, password);
            await Promise.resolve(onLoginSuccess(user));
            onClose();
            setEmail('');
            setPassword('');
        } catch (error) {
            console.error('❌ Login failed:', error);
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    const openRegistrationPage = () => {
        window.open('https://api.finalyze.pro', '_blank');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold text-white mb-4">Login to Premium</h2>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-white/80 text-sm mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                            placeholder="your@email.com"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-white/80 text-sm mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                            placeholder="Password"
                            required
                        />
                    </div>
                    
                    {error && (
                        <div className="text-red-400 text-sm">{error}</div>
                    )}
                    
                    <div className="flex space-x-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
                
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-sm text-center">
                        Don't have an account?{' '}
                        <button
                            onClick={openRegistrationPage}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Register on website
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginDialog; 