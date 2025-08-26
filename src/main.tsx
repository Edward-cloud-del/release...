import React from 'react';
import ReactDOM from 'react-dom/client';
import { emit } from '@tauri-apps/api/event';
import App from './App';
import OverlayApp from './OverlayApp';
import './index.css';

// Check if this is the overlay window - more robust detection
const isOverlay = 
	window.location.pathname === '/overlay' || 
	window.location.hash.includes('overlay') ||
	window.location.search.includes('overlay') ||
	document.title.includes('Selection') ||
	document.title.includes('Overlay');

console.log('🔍 Window detection:', {
	pathname: window.location.pathname,
	hash: window.location.hash,
	search: window.location.search,
	title: document.title,
	isOverlay: isOverlay
});

// Frontend Component that signals readiness
function AppWithReadySignal() {
	React.useEffect(() => {
		// Signal that frontend is ready after React has mounted
		const signalReady = async () => {
			try {
				await emit("frontend_ready", { 
					windowType: isOverlay ? "overlay" : "main",
					timestamp: Date.now()
				});
				console.log('✅ Frontend ready signal sent to Rust backend');
			} catch (error) {
				console.warn('⚠️ Failed to emit frontend_ready event:', error);
			}
		};
		
		// Small delay to ensure React is fully rendered
		const timer = setTimeout(signalReady, 100);
		return () => clearTimeout(timer);
	}, []);

	return isOverlay ? <OverlayApp /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<AppWithReadySignal />
	</React.StrictMode>
);
