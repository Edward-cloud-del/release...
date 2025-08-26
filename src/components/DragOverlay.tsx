import React, { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DragOverlayProps {
	onSelectionComplete: (result: any) => void;
	onCancel: () => void;
}

interface SelectionBox {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}

const DragOverlay: React.FC<DragOverlayProps> = ({ onSelectionComplete, onCancel }) => {
	const [isDragging, setIsDragging] = useState(false);
	const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
	const overlayRef = useRef<HTMLDivElement>(null);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		console.log('🖱️ Mouse down - starting drag');
		const rect = overlayRef.current?.getBoundingClientRect();
		if (!rect) return;

		const startX = e.clientX - rect.left;
		const startY = e.clientY - rect.top;

		setIsDragging(true);
		setSelectionBox({
			startX,
			startY,
			endX: startX,
			endY: startY,
		});
	}, []);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		if (!isDragging || !selectionBox) return;

		const rect = overlayRef.current?.getBoundingClientRect();
		if (!rect) return;

		const endX = e.clientX - rect.left;
		const endY = e.clientY - rect.top;

		setSelectionBox(prev => prev ? {
			...prev,
			endX,
			endY,
		} : null);
	}, [isDragging, selectionBox]);

	const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		if (!isDragging || !selectionBox) return;

		console.log('🖱️ Mouse up - ending drag');
		setIsDragging(false);

		// Calculate final bounds in viewport coordinates
		const viewportX = Math.min(selectionBox.startX, selectionBox.endX);
		const viewportY = Math.min(selectionBox.startY, selectionBox.endY);
		const width = Math.abs(selectionBox.endX - selectionBox.startX);
		const height = Math.abs(selectionBox.endY - selectionBox.startY);

		// Minimum selection size
		if (width < 10 || height < 10) {
			console.log('❌ Selection too small, cancelling');
			onCancel();
			return;
		}

		try {
			console.log(`📐 Viewport selection: ${width}x${height} at (${viewportX}, ${viewportY})`);

			// 🔧 FIX: Since overlay window covers entire screen at position (0,0),
			// viewport coordinates ARE already absolute screen coordinates!
			// No need to get window position and add offsets.
			const screenX = Math.round(viewportX);
			const screenY = Math.round(viewportY);
			const screenWidth = Math.round(width);
			const screenHeight = Math.round(height);

			console.log(`🎯 Screen coordinates: ${screenWidth}x${screenHeight} at (${screenX}, ${screenY})`);

			// Call our optimized process_screen_selection command with corrected screen coordinates
			await invoke('process_screen_selection_optimized', { 
				bounds: {
					x: screenX, 
					y: screenY, 
					width: screenWidth, 
					height: screenHeight
				}
			});
			
			console.log('✅ Optimized screen selection sent to Rust for processing!');
			// The result will come back via 'selection-result' event that App.tsx listens for
			onSelectionComplete({ success: true });
		} catch (error) {
			console.error('❌ Drag selection failed:', error);
			onCancel();
		}
	}, [isDragging, selectionBox, onSelectionComplete, onCancel]);

	// Handle clicks that aren't part of a drag (to prevent accidental cancellation)
	const handleClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		// Only cancel if this was a simple click (not a drag)
		if (!isDragging && !selectionBox) {
			console.log('🖱️ Click without drag - cancelling');
			onCancel();
		}
	}, [isDragging, selectionBox, onCancel]);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			console.log('⏹️ Escape pressed - cancelling selection');
			e.preventDefault();
			onCancel();
		}
	}, [onCancel]);

	React.useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	const getSelectionStyle = () => {
		if (!selectionBox) return {};

		const x = Math.min(selectionBox.startX, selectionBox.endX);
		const y = Math.min(selectionBox.startY, selectionBox.endY);
		const width = Math.abs(selectionBox.endX - selectionBox.startX);
		const height = Math.abs(selectionBox.endY - selectionBox.startY);

		return {
			left: x,
			top: y,
			width,
			height,
		};
	};

	return (
		<div
			ref={overlayRef}
			className="fixed inset-0 z-50 cursor-crosshair select-none"
			style={{ 
				backgroundColor: 'transparent',
				userSelect: 'none',
				pointerEvents: 'auto',
			}}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onClick={handleClick}
		>
			{/* Instructions */}
			<div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg text-sm pointer-events-none">
				🖱️ Drag to select area • ⏹️ ESC to cancel
			</div>

			{/* Close button */}
			<button
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onCancel();
				}}
				className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
				style={{ pointerEvents: 'auto' }}
			>
				×
			</button>

			{/* Selection box */}
			{selectionBox && (
				<div
					className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
					style={getSelectionStyle()}
				>
					{/* Selection corners for visual feedback */}
					<div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full"></div>
					<div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
					<div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full"></div>
					<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
					
					{/* Size indicator */}
					{isDragging && (
						<div className="absolute -bottom-8 left-0 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs pointer-events-none">
							{Math.round(Math.abs(selectionBox.endX - selectionBox.startX))} × {Math.round(Math.abs(selectionBox.endY - selectionBox.startY))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default DragOverlay; 