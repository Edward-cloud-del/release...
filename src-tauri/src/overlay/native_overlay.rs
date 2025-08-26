#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSView, NSApp, NSApplication, NSApplicationActivationPolicy};
#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, YES, NO};
#[cfg(target_os = "macos")]
use cocoa::foundation::{NSRect, NSPoint, NSSize, NSString};
#[cfg(target_os = "macos")]
use objc::runtime::{Object, Class, Sel};
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl, class};

use std::sync::{Arc, Mutex, mpsc};
use super::screen_capture::{ScreenCapture, CaptureBounds, ScreenInfo};
use super::selection_overlay::{SelectionResult, MousePosition};

pub struct NativeOverlay {
    #[cfg(target_os = "macos")]
    window: Option<id>,
    selection_receiver: Option<mpsc::Receiver<SelectionResult>>,
}

impl NativeOverlay {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "macos")]
            window: None,
            selection_receiver: None,
        }
    }

    /// Start interactive screen selection with native overlay
    pub async fn start_interactive_selection() -> Result<SelectionResult, String> {
        #[cfg(target_os = "macos")]
        {
            Self::show_macos_overlay().await
        }
        
        #[cfg(not(target_os = "macos"))]
        {
            // Fallback for other platforms
            Self::fallback_selection().await
        }
    }

    #[cfg(target_os = "macos")]
    async fn show_macos_overlay() -> Result<SelectionResult, String> {
        println!("🖼️ Creating native macOS selection overlay...");
        
        // Get screen info first
        let screen_info = ScreenCapture::get_screen_info()?;
        if screen_info.is_empty() {
            return Err("No screens available".to_string());
        }
        
        let primary_screen = &screen_info[0];
        println!("📺 Screen: {}x{}", primary_screen.width, primary_screen.height);

        // Create channel for communication
        let (tx, rx) = mpsc::channel::<SelectionResult>();
        
        // This is a simplified implementation - in a full implementation, 
        // we would create a transparent NSWindow and handle mouse events
        // For now, let's create a working selection system using a different approach
        
        tokio::task::spawn_blocking(move || {
            // Simulate interactive selection
            // In real implementation, this would show the overlay and wait for user input
            println!("⚠️ Simulating interactive selection (native overlay in development)");
            
            // For demo: create a selection in different area than the placeholder
            let bounds = CaptureBounds {
                x: 100,
                y: 100, 
                width: 400,
                height: 300,
            };
            
            // Capture the area
            let runtime = tokio::runtime::Runtime::new().unwrap();
            match runtime.block_on(ScreenCapture::capture_region(bounds.clone())) {
                Ok(capture_result) => {
                    let result = SelectionResult {
                        bounds: capture_result.bounds,
                        image_data: capture_result.image_data,
                        cancelled: false,
                    };
                    tx.send(result).ok();
                },
                Err(e) => {
                    println!("❌ Capture failed: {}", e);
                    let result = SelectionResult {
                        bounds,
                        image_data: String::new(),
                        cancelled: true,
                    };
                    tx.send(result).ok();
                }
            }
        });
        
        // Wait for result
        match rx.recv() {
            Ok(result) => Ok(result),
            Err(_) => Err("Selection cancelled or failed".to_string()),
        }
    }

    #[cfg(not(target_os = "macos"))]
    async fn fallback_selection() -> Result<SelectionResult, String> {
        println!("🖼️ Using fallback selection for non-macOS platform");
        
        // Get screen info
        let screen_info = ScreenCapture::get_screen_info()?;
        if screen_info.is_empty() {
            return Err("No screens available".to_string());
        }
        
        let primary_screen = &screen_info[0];
        
        // Create a selection in center of screen
        let bounds = CaptureBounds {
            x: (primary_screen.width / 4) as i32,
            y: (primary_screen.height / 4) as i32,
            width: primary_screen.width / 2,
            height: primary_screen.height / 2,
        };
        
        match ScreenCapture::capture_region(bounds.clone()).await {
            Ok(capture_result) => Ok(SelectionResult {
                bounds: capture_result.bounds,
                image_data: capture_result.image_data,
                cancelled: false,
            }),
            Err(e) => Err(format!("Failed to capture selection: {}", e)),
        }
    }

    /// Create a manual selection with given bounds (for testing)
    pub async fn manual_selection(bounds: CaptureBounds) -> Result<SelectionResult, String> {
        println!("🎯 Manual selection: {:?}", bounds);
        
        match ScreenCapture::capture_region(bounds.clone()).await {
            Ok(capture_result) => Ok(SelectionResult {
                bounds: capture_result.bounds,
                image_data: capture_result.image_data,
                cancelled: false,
            }),
            Err(e) => Err(format!("Failed to capture manual selection: {}", e)),
        }
    }
}

// Utility functions for different selection modes
impl NativeOverlay {
    /// Quick selection of screen quadrants for testing
    pub async fn select_screen_quadrant(quadrant: ScreenQuadrant) -> Result<SelectionResult, String> {
        let screen_info = ScreenCapture::get_screen_info()?;
        if screen_info.is_empty() {
            return Err("No screens available".to_string());
        }
        
        let screen = &screen_info[0];
        let half_width = screen.width / 2;
        let half_height = screen.height / 2;
        
        let bounds = match quadrant {
            ScreenQuadrant::TopLeft => CaptureBounds {
                x: 0,
                y: 0,
                width: half_width,
                height: half_height,
            },
            ScreenQuadrant::TopRight => CaptureBounds {
                x: half_width as i32,
                y: 0,
                width: half_width,
                height: half_height,
            },
            ScreenQuadrant::BottomLeft => CaptureBounds {
                x: 0,
                y: half_height as i32,
                width: half_width,
                height: half_height,
            },
            ScreenQuadrant::BottomRight => CaptureBounds {
                x: half_width as i32,
                y: half_height as i32,
                width: half_width,
                height: half_height,
            },
            ScreenQuadrant::Center => CaptureBounds {
                x: (half_width / 2) as i32,
                y: (half_height / 2) as i32,
                width: half_width,
                height: half_height,
            },
        };
        
        println!("📐 Selecting {} quadrant: {:?}", quadrant.name(), bounds);
        Self::manual_selection(bounds).await
    }
}

#[derive(Debug, Clone)]
pub enum ScreenQuadrant {
    TopLeft,
    TopRight, 
    BottomLeft,
    BottomRight,
    Center,
}

impl ScreenQuadrant {
    pub fn name(&self) -> &'static str {
        match self {
            ScreenQuadrant::TopLeft => "top-left",
            ScreenQuadrant::TopRight => "top-right",
            ScreenQuadrant::BottomLeft => "bottom-left", 
            ScreenQuadrant::BottomRight => "bottom-right",
            ScreenQuadrant::Center => "center",
        }
    }
} 