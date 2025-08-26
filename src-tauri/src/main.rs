#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    RunEvent, WindowEvent,
    tray::TrayIconBuilder,
    menu::{Menu, MenuItem},
    Manager, Emitter, WebviewUrl, WebviewWindowBuilder, Listener,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use base64::Engine;
use std::time::{SystemTime, UNIX_EPOCH};
//use std::fs;
use std::path::PathBuf;


// Import optimized overlay manager
mod overlay;
use overlay::{OverlayManager, ScreenshotCache, ScreenCapture, CaptureBounds};



// OCR module for Tesseract integration
mod ocr;
use ocr::{OCRService, OCRResult};


// Authentication module
mod auth;
// Using API approach - no direct database connection
use auth::{AuthService, User};

// Global OCR service (reuse instance for performance)
static mut OCR_SERVICE: Option<std::sync::Mutex<OCRService>> = None;
static OCR_INIT: std::sync::Once = std::sync::Once::new();

// Note: macOS-specific imports removed since we're using native egui overlay

#[derive(Clone, Serialize, Deserialize)]
pub struct AppResult {
    pub success: bool,
    pub message: String,
}

// CaptureBounds moved to overlay::screen_capture module

#[derive(Clone, Serialize, Deserialize)]
pub struct CaptureResult {
    pub success: bool,
    pub message: String,
    pub bounds: Option<CaptureBounds>,
    pub image_data: Option<String>, // Base64 encoded image
}

// App state that persists between window creations (like Raycast)
#[derive(Clone, Default, Serialize)]
pub struct AppState {
    pub screenshot_data: Option<String>,
    pub last_bounds: Option<CaptureBounds>,
    pub last_window_closed_time: Option<u64>, // Timestamp when window was last closed
}

type SharedState = Arc<Mutex<AppState>>;

// FAS 1: Optimized overlay manager for pooling
type SharedOverlayManager = Arc<Mutex<OverlayManager>>;



// FAS 3: Screenshot cache manager for optimization
type SharedScreenshotCache = Arc<Mutex<ScreenshotCache>>;

// Authentication service manager
type SharedAuthService = Arc<Mutex<AuthService>>;
/*

*/
// Extract text from image using OCR (Step 2-3 from AI.txt)
#[tauri::command]
async fn extract_text_ocr(image_data: String) -> Result<OCRResult, String> {
    println!("📝 Extracting text from image using OCR...");

    unsafe {
        OCR_INIT.call_once(|| {
            if let Ok(service) = OCRService::new() {
                OCR_SERVICE = Some(std::sync::Mutex::new(service));
                println!("✅ OCR service initialized successfully");
            } else {
                println!("❌ Failed to initialize OCR service");
            }
        });

        if let Some(ref service_mutex) = OCR_SERVICE {
            let service = service_mutex.lock().unwrap();
            match service.extract_text(&image_data) {
                Ok(result) => {
                    println!("✅ OCR extraction successful - Text: '{}', Confidence: {:.2}%",
                             result.text, result.confidence * 100.0);
                    Ok(result)
                },
                Err(error) => {
                    println!("❌ OCR extraction failed: {}", error);
                    Err(error)
                }
            }
        } else {
            let error_msg = "OCR service not initialized".to_string();
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}
// Check permissions (simplified for now)
#[tauri::command]
async fn check_permissions() -> Result<bool, String> {
    // For now, just return true since we handle permissions via macOS system prompts
    // In a real app, you might want to check specific permissions here
    println!("🔐 Checking permissions...");
    Ok(true)
}

// 🚀 FAS 2: OPTIMIZED PERMISSION COMMANDS





// 🚀 FAS 3: OPTIMIZED SCREENSHOT COMMANDS
// Capture screen area with smart caching (60% faster)
#[tauri::command]
fn capture_screen_area_optimized(
    bounds: CaptureBounds,
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<CaptureResult, String> {
    let mut screenshot_cache = cache.lock().unwrap();

    match screenshot_cache.capture_optimized(bounds.clone()) {
        Ok(image_data) => {
            Ok(CaptureResult {
                success: true,
                message: "Optimized screen capture successful!".to_string(),
                bounds: Some(bounds),
                image_data: Some(image_data),
            })
        },
        Err(e) => {
            Ok(CaptureResult {
                success: false,
                message: e,
                bounds: None,
                image_data: None,
            })
        }
    }
}
// Capture screen area with multi-screen support and smart caching
#[tauri::command]
fn capture_screen_area_multi_screen_optimized(
    bounds: CaptureBounds,
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<CaptureResult, String> {
    println!("🖥️ Multi-screen capture: {}x{} at ({}, {})",
             bounds.width, bounds.height, bounds.x, bounds.y);

    let mut screenshot_cache = cache.lock().unwrap();

    // First try the optimized cache (works for single screen regions)
    match screenshot_cache.capture_optimized(bounds.clone()) {
        Ok(image_data) => {
            println!("✅ Multi-screen capture successful via optimized cache!");
            Ok(CaptureResult {
                success: true,
                message: "Multi-screen optimized capture successful!".to_string(),
                bounds: Some(bounds),
                image_data: Some(image_data),
            })
        },
        Err(cache_error) => {
            println!("❌ Multi-screen capture failed: {}", cache_error);
            Ok(CaptureResult {
                success: false,
                message: format!("Multi-screen capture failed: {}", cache_error),
                bounds: None,
                image_data: None,
            })
        }
    }
}

// Clear screenshot cache (for testing or memory management)
#[tauri::command]
fn clear_screenshot_cache(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    screenshot_cache.clear_cache();
    println!("🗑️ Screenshot cache cleared");
    Ok(())
}

// Get screenshot cache statistics
#[tauri::command]
fn get_screenshot_cache_stats(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<serde_json::Value, String> {
    let screenshot_cache = cache.lock().unwrap();
    let (total_entries, total_size, expired_entries) = screenshot_cache.get_cache_stats();

    let stats = serde_json::json!({
        "total_entries": total_entries,
        "total_size_bytes": total_size,
        "total_size_mb": total_size / (1024 * 1024),
        "expired_entries": expired_entries,
        "active_entries": total_entries - expired_entries
    });

    println!("📊 Screenshot cache stats: {} entries, {}MB, {} expired",
             total_entries, total_size / (1024 * 1024), expired_entries);
    Ok(stats)
}

// Cleanup expired screenshot cache entries
#[tauri::command]
fn cleanup_screenshot_cache(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    screenshot_cache.cleanup_expired();
    println!("🧹 Screenshot cache cleanup completed");
    Ok(())
}

// Resize screenshot buffer (for memory optimization)
#[tauri::command]
fn resize_screenshot_buffer(
    new_size_mb: usize,
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    let new_size_bytes = new_size_mb * 1024 * 1024;
    screenshot_cache.resize_buffer(new_size_bytes);
    println!("📏 Screenshot buffer resized to {}MB", new_size_mb);
    Ok(())
}

// 🚀 AUTHENTICATION COMMANDS
//härr
// Login user with credentials
#[tauri::command]
async fn login_user(
    email: String,
    password: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<User, String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.login_user(email, password).await
}

// Logout current user
#[tauri::command]
async fn logout_user(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.logout_user().await
}

// Get current logged in user
#[tauri::command]
async fn get_current_user(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.get_current_user().await
}

// Save user session to storage
#[tauri::command]
async fn save_user_session(
    user: User,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.save_user_session(&user).await
}

// Load user session from storage
#[tauri::command]
async fn load_user_session(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.load_user_session().await
}
/*
}
*/
// Get available models for user tier
#[tauri::command]
fn get_available_models(
    user_tier: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Vec<String>, String> {
    println!("🔍 DEBUG: get_available_models called for tier: {}", user_tier);

    let service = auth_service.lock().unwrap();
    let raw_models = service.get_available_models(&user_tier);
    let models: Vec<String> = raw_models
        .iter()
        .map(|&s| s.to_string())
        .collect();

    println!("✅ DEBUG: get_available_models returning {} models: {:?}", models.len(), models);
    Ok(models)
}

// Check if user can use specific model
#[tauri::command]
fn can_use_model(
    user_tier: String,
    model: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<bool, String> {
    println!("🔍 DEBUG: can_use_model called - tier: '{}', model: '{}'", user_tier, model);

    let service = auth_service.lock().unwrap();
    let can_use = service.can_use_model(&user_tier, &model);

    println!("✅ DEBUG: can_use_model result: {} (tier: '{}', model: '{}')", can_use, user_tier, model);
    Ok(can_use)
}
//härrr
// Test deep link functionality (for development)
#[tauri::command]
async fn test_deep_link(app: tauri::AppHandle, token: String, plan: String) -> Result<(), String> {
    println!("🧪 Testing deep link with token: {} and plan: {}", token, plan);

    // Emit payment success event for testing
    app.emit("payment_success", serde_json::json!({
        "token": token,
        "plan": plan
    })).map_err(|e| format!("Failed to emit payment success: {}", e))?;

    println!("✅ Test deep link event emitted successfully");
    Ok(())
}


// Clear local user session (for troubleshooting)
#[tauri::command]
async fn clear_user_session(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    println!("🗑️ Clearing local user session...");

    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };

    service.logout_user().await?;
    println!("✅ Local session cleared");
    Ok(())
}





// Removed problematic HTML/JS-based overlay function - using React overlays only

// Removed old process_screen_selection - using optimized version only

//removed get window position

// Save app state to file for persistence (like Raycast)
#[tauri::command]
async fn save_app_state(
    screenshot_data: Option<String>,
    bounds: Option<CaptureBounds>,
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedState>
) -> Result<(), String> {
    println!("💾 Saving app state...");

    // Update in-memory state
    {
        let mut app_state = state.lock().unwrap();
        app_state.screenshot_data = screenshot_data.clone();
        app_state.last_bounds = bounds.clone();
        app_state.last_window_closed_time = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
    }

    // Save to file for persistence
    if let Some(app_data_dir) = app.path().app_data_dir().ok() {
        let state_file = app_data_dir.join("app_state.json");

        // Ensure directory exists
        if let Some(parent) = state_file.parent() {
            if !parent.exists() {
                match std::fs::create_dir_all(parent) {
                    Ok(_) => println!("📁 Created app data directory"),
                    Err(e) => println!("⚠️ Failed to create app data directory: {}", e),
                }
            }
        }

        // Save current state
        let current_state = state.lock().unwrap().clone();
        match serde_json::to_string_pretty(&current_state) {
            Ok(state_json) => {
                match std::fs::write(&state_file, state_json) {
                    Ok(_) => println!("✅ App state saved successfully"),
                    Err(e) => println!("❌ Failed to write app state: {}", e),
                }
            },
            Err(e) => println!("❌ Failed to serialize app state: {}", e),
        }
    }

    Ok(())
}

// 🚀 FAS 1: OPTIMIZED OVERLAY COMMANDS (React-based, no HTML/JS issues)

// Create optimized overlay using OverlayManager pooling with React
#[tauri::command]
async fn create_transparent_overlay_optimized(
    app: tauri::AppHandle,
    overlay_manager: tauri::State<'_, SharedOverlayManager>
) -> Result<(), String> {
    println!("🎯 Creating optimized overlay and hiding main window...");

    // 🔧 HIDE main window during capture mode
    if let Some(main_window) = app.get_webview_window("main") {
        match main_window.hide() {
            Ok(_) => println!("👻 Main window hidden for capture mode"),
            Err(e) => println!("⚠️ Failed to hide main window: {}", e),
        }
    }

    let mut manager = overlay_manager.lock().unwrap();
    manager.show_selection_overlay(&app)
}

// Close optimized overlay using OverlayManager
#[tauri::command]
async fn close_transparent_overlay_optimized(
    app: tauri::AppHandle,
    overlay_manager: tauri::State<'_, SharedOverlayManager>
) -> Result<(), String> {
    println!("🎯 Closing optimized overlay and showing main window...");

    let mut manager = overlay_manager.lock().unwrap();
    let result = manager.hide_overlay();

    // 🔧 SHOW main window again after capture mode (if it exists)
    if let Some(main_window) = app.get_webview_window("main") {
        match main_window.show() {
            Ok(_) => {
                println!("👁️ Main window shown again after capture");
                // Focus the window so it's ready for interaction
                if let Err(e) = main_window.set_focus() {
                    println!("⚠️ Failed to focus main window: {}", e);
                }
            },
            Err(e) => println!("⚠️ Failed to show main window: {}", e),
        }
    } else {
        println!("ℹ️ No main window to show (headless capture mode)");
    }

    result
}

// Process screen selection with React overlay and optimized capture
#[tauri::command]
async fn process_screen_selection_optimized(
    app: tauri::AppHandle,
    bounds: CaptureBounds,
    overlay_manager: tauri::State<'_, SharedOverlayManager>,
    screenshot_cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    println!("📸 Processing optimized screen selection: {}x{} at ({}, {})",
             bounds.width, bounds.height, bounds.x, bounds.y);

    // Use multi-screen optimized capture with caching
    let capture_result = capture_screen_area_multi_screen_optimized(bounds.clone(), screenshot_cache)?;

    if capture_result.success && capture_result.image_data.is_some() {
        let image_data = capture_result.image_data.unwrap();
        println!("✅ Optimized screen capture successful!");

        // Send result to React - create window if needed for headless capture
        let window = if let Some(existing_window) = app.get_webview_window("main") {
            existing_window
        } else {
            // 🎭 Headless capture - create animated window for smooth entrance
            println!("🆕 Headless capture complete - creating animated window for smooth result display");
            if let Err(e) = create_main_window_animated(app.clone()).await {
                println!("❌ Failed to create animated window for headless result: {}", e);
                // Fallback to regular window creation
                if let Err(e) = create_main_window(app.clone()).await {
                    println!("❌ Failed to create fallback window: {}", e);
                    return Ok(());
                }
            }
            // Get the newly created window
            if let Some(new_window) = app.get_webview_window("main") {
                new_window
            } else {
                println!("❌ Failed to get newly created animated window");
                return Ok(());
            }
        };

        let analysis_result = serde_json::json!({
            "type": "image",
            "bounds": bounds,
            "imageData": image_data,
            "text": null,
            "success": true,
            "message": "Optimized screen area captured successfully!"
        });

        // Save to app state for React to pick up when ready
        if let Some(state) = app.try_state::<SharedState>() {
            let mut app_state = state.lock().unwrap();
            app_state.screenshot_data = Some(image_data.clone());
            app_state.last_bounds = Some(bounds.clone());
            println!("💾 Saved capture to app state for React pickup");
        }

        // Give React time to load before sending selection-result
        tokio::time::sleep(tokio::time::Duration::from_millis(110)).await;
        window.emit("selection-result", analysis_result).unwrap();
        println!("📤 Sent optimized capture data to main app");

        // Hide overlay using optimized manager
        let _ = close_transparent_overlay_optimized(app, overlay_manager);

    } else {
        println!("❌ Optimized capture failed: {}", capture_result.message);
    }

    Ok(())
}

// Cleanup old overlays periodically
/*

*/
// 🆕 FAS 2: WINDOW RESIZE FUNCTIONS

// Resize main window for chat expansion/contraction
#[tauri::command]
async fn resize_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    println!("📏 Resizing main window to {}x{}", width, height);

    if let Some(window) = app.get_webview_window("main") {
        match window.set_size(tauri::LogicalSize::new(width, height)) {
            Ok(_) => {
                println!("✅ Window resized successfully to {}x{}", width, height);
                Ok(())
            },
            Err(e) => {
                println!("❌ Failed to resize window: {}", e);
                Err(format!("Failed to resize window: {}", e))
            }
        }
    } else {
        println!("❌ Main window not found for resize");
        Err("Main window not found".to_string())
    }
}

// Get current window information (for ProfileDropdown to check window state)
#[tauri::command]
async fn get_window_info(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    if let Some(window) = app.get_webview_window("main") {
        let mut info = serde_json::Map::new();

        if let Ok(outer_size) = window.outer_size() {
            info.insert("width".to_string(), serde_json::json!(outer_size.width));
            info.insert("height".to_string(), serde_json::json!(outer_size.height));
        }

        if let Ok(inner_size) = window.inner_size() {
            info.insert("inner_width".to_string(), serde_json::json!(inner_size.width));
            info.insert("inner_height".to_string(), serde_json::json!(inner_size.height));
        }

        if let Ok(position) = window.outer_position() {
            info.insert("x".to_string(), serde_json::json!(position.x));
            info.insert("y".to_string(), serde_json::json!(position.y));
        }

        info.insert("visible".to_string(), serde_json::json!(window.is_visible().unwrap_or(false)));

        println!("📊 ALT+C: Window info requested - {}x{}",
                 info.get("width").unwrap_or(&serde_json::json!(0)),
                 info.get("height").unwrap_or(&serde_json::json!(0)));

        Ok(serde_json::Value::Object(info))
    } else {
        Err("Main window not found".to_string())
    }
}

// Note: Main window created with .transparent(true) - React CSS controls background visibility
// When chatBoxOpen=true: transparent, when false: white background

// Show main window when React is ready (eliminates white flash)
#[tauri::command]
async fn show_window_when_ready(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        match window.show() {
            Ok(_) => {
                // Set focus after showing
                if let Err(e) = window.set_focus() {
                    println!("⚠️ Failed to focus window after showing: {}", e);
                }
                println!("✅ Window shown after React ready");
                Ok(())
            },
            Err(e) => {
                let err_msg = format!("Failed to show window: {}", e);
                println!("❌ {}", err_msg);
                Err(err_msg)
            }
        }
    } else {
        let err_msg = "Main window not found";
        println!("❌ {}", err_msg);
        Err(err_msg.to_string())
    }
}

// 🔧 DEBUG COMMAND - Get detailed coordinate info

#[tauri::command]
async fn debug_coordinates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let mut debug_info = serde_json::Map::new();

    // Main window info
    if let Some(main_window) = app.get_webview_window("main") {
        if let Ok(pos) = main_window.outer_position() {
            debug_info.insert("main_outer_position".to_string(),
                serde_json::json!({"x": pos.x, "y": pos.y}));
        }
        if let Ok(size) = main_window.outer_size() {
            debug_info.insert("main_outer_size".to_string(),
                serde_json::json!({"width": size.width, "height": size.height}));
        }
        if let Ok(inner_pos) = main_window.inner_position() {
            debug_info.insert("main_inner_position".to_string(),
                serde_json::json!({"x": inner_pos.x, "y": inner_pos.y}));
        }
        if let Ok(inner_size) = main_window.inner_size() {
            debug_info.insert("main_inner_size".to_string(),
                serde_json::json!({"width": inner_size.width, "height": inner_size.height}));
        }
        if let Ok(scale) = main_window.scale_factor() {
            debug_info.insert("scale_factor".to_string(), serde_json::json!(scale));
        }
    }


    // Screen info
    if let Ok(screens) = screenshots::Screen::all() {
        if let Some(screen) = screens.first() {
            debug_info.insert("screen_size".to_string(),
                serde_json::json!({
                    "width": screen.display_info.width,
                    "height": screen.display_info.height
                }));
        }
    }

    println!("🔍 DEBUG INFO: {}", serde_json::to_string_pretty(&debug_info).unwrap());
    Ok(serde_json::Value::Object(debug_info))
}






//gör så att det skapar nytt fönster
// Create new main window on current Space (like Raycast/Spotlight)
#[tauri::command]
async fn create_main_window(app: tauri::AppHandle) -> Result<(), String> {
    create_main_window_with_size(app, 600.0, 50.0).await
}

// Create expanded main window for ChatBox (used by Alt+C headless capture)
#[tauri::command]
async fn create_main_window_expanded(app: tauri::AppHandle) -> Result<(), String> {
    create_main_window_with_size(app, 600.0, 120.0).await
}

// 🎭 NEW: Create main window with smooth entrance animation (Alt+C optimized)
#[tauri::command]
async fn create_main_window_animated(app: tauri::AppHandle) -> Result<(), String> {
    println!("🎭 ALT+C: Creating animated window for smooth entrance...");

    // Get screen size for positioning
    let (screen_width, screen_height) = match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                (screen.display_info.width as f64, screen.display_info.height as f64)
            } else {
                (1440.0, 900.0) // fallback
            }
        },
        Err(_) => (1440.0, 900.0),
    };

    // Close existing window if it exists
    if let Some(existing) = app.get_webview_window("main") {
        let _ = existing.close();
    }

    let window_width = 600.0;
    let window_height = 50.0; // Start compact
    let x = (screen_width - window_width) / 2.0;
    let y = screen_height * 0.2 - window_height / 2.0;

    // Create window with smooth animation properties
    let window = WebviewWindowBuilder::new(
        &app,
        "main",
        WebviewUrl::App("/".into())
    )
    .title("FrameSense")
    .inner_size(window_width, window_height)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .visible(false) // Start hidden for smooth entrance
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create animated window: {}", e))?;

    println!("✅ ALT+C: Animated window created at ({}, {}) - starting smooth entrance...", x, y);

    // 🎭 SMOOTH ENTRANCE ANIMATION SEQUENCE

    // Step 1: Start with slight scale and opacity (invisible)
    // This happens instantly when window is created

    // Step 2: Small delay to ensure window is ready
    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    // Step 3: Show window and start entrance animation
    match window.show() {
        Ok(_) => {
            println!("🎭 ALT+C: Window shown - entrance animation started");

            // Step 4: Focus the window for interaction
            if let Err(e) = window.set_focus() {
                println!("⚠️ ALT+C: Failed to focus animated window: {}", e);
            } else {
                println!("🎯 ALT+C: Animated window focused and ready for interaction");
            }
        },
        Err(e) => {
            println!("❌ ALT+C: Failed to show animated window: {}", e);
            return Err(format!("Failed to show animated window: {}", e));
        }
    }

    println!("✨ ALT+C: Smooth animated window creation completed!");
    Ok(())
}

// Internal helper to create window with specific size
async fn create_main_window_with_size(app: tauri::AppHandle, window_width: f64, window_height: f64) -> Result<(), String> {
    // Close existing window if it exists
    if let Some(existing) = app.get_webview_window("main") {
        let _ = existing.close();
    }
    println!("🎯 Creating new main window {}x{} on current Space...", window_width, window_height);

    // Get screen size
    let (screen_width, screen_height) = match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                (screen.display_info.width as f64, screen.display_info.height as f64)
            } else {
                (1440.0, 900.0) // fallback
            }
        },
        Err(_) => (1440.0, 900.0),
    };
    let x = (screen_width - window_width) / 2.0;
    let y = screen_height * 0.2 - window_height / 2.0;

    // Create fresh window that will appear on current Space (hidden initially)
    let _window = WebviewWindowBuilder::new(
        &app,
        "main",
        WebviewUrl::App("/".into())
    )
    .title("FrameSense")
    .inner_size(window_width, window_height)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .visible(false) // Start hidden to eliminate white flash
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create main window: {}", e))?;

    println!("✅ New main window {}x{} created on current Space at ({}, {})!", window_width, window_height, x, y);
    Ok(())
}

// 🔧 MOVE WINDOW COMMAND - Move window to correct Y position



#[tauri::command]
async fn get_app_state(
    state: tauri::State<'_, SharedState>
) -> Result<AppState, String> {
    let app_state = state.lock().unwrap().clone();
    println!("📖 App state retrieved");
    Ok(app_state)
}

fn main() {
    use std::sync::{Arc, Mutex};
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri::{Manager, RunEvent, WindowEvent};
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    // Initialize shared state for Raycast-style persistence
    let shared_state: SharedState = Arc::new(Mutex::new(AppState::default()));

    // FAS 1: Initialize optimized overlay manager for pooling
    let shared_overlay_manager: SharedOverlayManager = Arc::new(Mutex::new(OverlayManager::new()));



    // FAS 3: Initialize screenshot cache for optimization
    let shared_screenshot_cache: SharedScreenshotCache = Arc::new(Mutex::new(ScreenshotCache::new()));

    // Initialize authentication service with storage path
    let app_data_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join(".framesense");
    let auth_service = AuthService::new().with_storage_path(app_data_dir);
    let shared_auth_service: SharedAuthService = Arc::new(Mutex::new(auth_service));
    // Database access through backend API only - no direct connection

    tauri::Builder::default()
        .manage(shared_state)
        .manage(shared_overlay_manager)
        .manage(shared_screenshot_cache)
        .manage(shared_auth_service)
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    println!("🔥 GLOBAL SHORTCUT: {:?} - State: {:?}", shortcut, event.state());

                    if event.state() != ShortcutState::Pressed {
                        println!("⚪ Ignoring key release");
                        return;
                    }

                    // Jämför mot parsade Shortcut-objekt (robust mot plattformsnamn som Option vs Alt)
                    let alt_space: Shortcut = "Alt+Space".parse().unwrap();
                    let alt_c: Shortcut = "Alt+C".parse().unwrap();

                    if shortcut == &alt_space {
                        // TOGGLE MAIN WINDOW
                        let app_clone = app.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(50));
                            if let Some(window) = app_clone.get_webview_window("main") {
                                println!("🔄 Window exists, closing and saving state...");
                                let _ = window.emit("save-state-and-close", ());
                                std::thread::sleep(std::time::Duration::from_millis(60));
                                let _ = window.close();

                                if let Some(state) = app_clone.try_state::<SharedState>() {
                                    let mut app_state = state.lock().unwrap();
                                    app_state.last_window_closed_time = Some(
                                        SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs(),
                                    );
                                }
                                println!("🗑️ Window closed (Raycast-style)");
                            } else {
                                println!("✨ No window exists...");
                                println!("🆕 Creating new window on current Space...");
                                // Behåll din ursprungliga tokio-runtime-stil
                                let rt = tokio::runtime::Runtime::new().unwrap();
                                rt.block_on(async {
                                    if let Err(e) = create_main_window(app_clone.clone()).await {
                                        println!("❌ Failed to create window: {}", e);
                                    } else {
                                        println!("✅ New window created successfully!");
                                    }
                                });
                            }
                        });
                    } else if shortcut == &alt_c {
                        // OPTIMIZED OVERLAY — funkar även utan UI
                        println!("📸 Alt+C — optimize overlay (no UI required)");
                        let app_clone = app.clone();
                        std::thread::spawn(move || {
                            // Kolla om UI fanns från början
                            let had_window_initially = app_clone.get_webview_window("main").is_some();

                            let rt = tokio::runtime::Runtime::new().unwrap();
                            rt.block_on(async {
                                // 1) Starta overlay/capture (headless om ingen UI finns)
                                let overlay_manager = app_clone.state::<SharedOverlayManager>();
                                if let Err(e) = create_transparent_overlay_optimized(
                                    app_clone.clone(),
                                    overlay_manager,
                                )
                                .await
                                {
                                    println!("❌ Failed to start optimized overlay: {}", e);
                                    return;
                                }
                                println!("✅ Optimized overlay triggered");

                                // 2) NYTT: Om appen INTE var uppe när vi startade,
                                //    skapa och visa main window EFTER capture är klar
                                if !had_window_initially {
                                    println!("🪄 No UI initially — will create window when capture completes");
                                    // Detta hanteras nu av process_screen_selection_optimized
                                    // när den är klar med capture
                                }
                            });
                        });
                    } else {
                        println!("⚪ Unhandled shortcut");
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Tray
            let quit_item = MenuItem::with_id(app, "quit", "Quit FrameSense", true, None::<&str>)?;
            let capture_item = MenuItem::with_id(app, "capture", "Start Capture", true, None::<&str>)?;
            let test_item = MenuItem::with_id(app, "test", "Test Command", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&capture_item, &test_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            println!("💀 Quit selected");
                            std::process::exit(0);
                        }
                        "capture" => {
                            println!("📸 Capture triggered from menu!");
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("show-capture-overlay", ()).unwrap();
                                println!("✅ Sent show-capture-overlay event to React");
                            } else {
                                println!("❌ Main window not found");
                            }
                        }
                        "test" => {
                            println!("🧪 Test command triggered");
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Register global hotkeys
            println!("🚀 Setting up FrameSense background app...");

            let shortcut_toggle = "Alt+Space".parse::<Shortcut>().unwrap();
            let shortcut_optimize = "Alt+C".parse::<Shortcut>().unwrap();

            for (name, sc) in [("Alt+Space", shortcut_toggle), ("Alt+C", shortcut_optimize)] {
                match app.global_shortcut().register(sc) {
                    Ok(_) => println!("✅ Global shortcut {} registered successfully!", name),
                    Err(e) => println!("❌ Failed to register {}: {}", name, e),
                }
            }

            println!("✅ FrameSense is ready! Press Alt+Space (toggle) or Alt+C (optimize overlay)");

            println!("✅ Frontend event listener will be set up after app starts");

            // Close initial window - we'll create fresh ones on Alt+Space (Raycast-style)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
                println!("🗑️ Closed initial window - will create fresh ones on current Space");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![

            extract_text_ocr,
            check_permissions,
            //test_screen_capture,
            //capture_screen_area,

            // FAS 1: Optimized overlay commands
            create_transparent_overlay_optimized,
            close_transparent_overlay_optimized,
            process_screen_selection_optimized,
            //cleanup_overlay_manager,



            // FAS 3: Optimized screenshot commands
            capture_screen_area_optimized,
            capture_screen_area_multi_screen_optimized,
            clear_screenshot_cache,
            get_screenshot_cache_stats,
            cleanup_screenshot_cache,
            resize_screenshot_buffer,

            // Authentication commands
            login_user,
            logout_user,
            get_current_user,
            save_user_session,
            load_user_session,
            //handle_payment_success,
            get_available_models,
            can_use_model,
            test_deep_link,
            clear_user_session,

            // App state management
            save_app_state,
            get_app_state,

            resize_window,
            get_window_info,
            //debug_coordinates,
            //test_chatbox_position,
            create_main_window,
            create_main_window_expanded,
            create_main_window_animated,
            show_window_when_ready,
            //move_window_to_position,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    println!("🚪 Main window close requested");
                } else {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| match event {
            RunEvent::Ready => {
                println!("🎯 App ready!");
                // Set up global event listener for frontend_ready
                app_handle.listen_any("frontend_ready", |event| {
                    println!("✅ Frontend is ready, safe to close or reopen windows");

                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&event.payload()) {
                        let window_type = payload.get("windowType")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let timestamp = payload.get("timestamp")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);

                        println!("📡 Frontend ready signal received - Window: {}, Timestamp: {}", window_type, timestamp);

                        // Run window-state logic here based on window type
                        match window_type {
                            "main" => {
                                println!("🏠 Main window frontend is ready");
                                // Main window specific logic can go here
                                // For example: show window if it was hidden
                                // Note: We can't access app_handle here, but that's fine for this basic implementation
                                println!("👁️ Main window frontend ready - window operations would go here");
                            },
                            "overlay" => {
                                println!("🎯 Overlay window frontend is ready");
                                // Overlay window specific logic can go here
                            },
                            _ => {
                                println!("❓ Unknown window type: {}", window_type);
                            }
                        }
                    } else {
                        println!("⚠️ Failed to parse frontend_ready payload");
                    }
                });
            }
            RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        });
}
