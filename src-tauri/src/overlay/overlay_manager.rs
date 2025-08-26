use super::screen_capture::ScreenCapture;
use screenshots;
use std::time::{Duration, Instant};
use tauri::{WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub struct OverlayManager {
  overlay_window: Option<WebviewWindow>,
  is_active: bool,
  last_used: Option<Instant>,
}

impl OverlayManager {
  pub fn new() -> Self {
    Self {
      overlay_window: None,
      is_active: false,
      last_used: None,
    }
  }

  pub fn show_selection_overlay(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
    match &self.overlay_window {
      Some(window) => {
        // ♻️ Återanvänd befintlig overlay
        window
          .show()
          .map_err(|e| format!("Failed to show overlay: {}", e))?;

        // Ensure focus for event handling when reusing
        if let Err(e) = window.set_focus() {
          println!("⚠️ Could not set focus on reused overlay: {}", e);
        }

        self.is_active = true;
        println!("♻️ Reusing existing React overlay window");
      }
      None => {
        // 🆕 Skapa första gången med React istället för HTML
        let overlay = self.create_react_overlay_once(app)?;
        self.overlay_window = Some(overlay);
        self.is_active = true;
        println!("🆕 Created new React overlay window");
      }
    }
    self.last_used = Some(Instant::now());
    Ok(())
  }

  pub fn hide_overlay(&mut self) -> Result<(), String> {
    if let Some(window) = &self.overlay_window {
      window
        .hide()
        .map_err(|e| format!("Failed to hide overlay: {}", e))?;
      self.is_active = false;
      println!("👁️ React overlay hidden (not destroyed)");
    }
    Ok(())
  }
  /*
      pub fn cleanup_if_old(&mut self) {
          // Rensa overlay om den inte använts på 5 minuter
          if let Some(last_used) = self.last_used {
              if last_used.elapsed() > Duration::from_secs(300) && !self.is_active {
                  if let Some(window) = &self.overlay_window {
                      window.close().ok();
                      self.overlay_window = None;
                      println!("🗑️ Cleaned up old React overlay window");
                  }
              }
          }
      }
  */
  /*
  pub fn is_overlay_active(&self) -> bool {
      self.is_active
  }
  */
  fn create_react_overlay_once(&self, app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    println!("🚀 === CREATING MULTI-SCREEN OVERLAY ===");

    // Get total screen area covering all monitors
    let (screen_width, screen_height, offset_x, offset_y) =
      match ScreenCapture::get_total_screen_area() {
        Ok(total_area) => {
          let width = total_area.width as f64;
          let height = total_area.height as f64;
          let x_offset = total_area.min_x as f64;
          let y_offset = total_area.min_y as f64;

          println!("✅ Multi-screen setup detected!");
          println!("📺 Total screen real estate: {}x{}", width, height);
          println!(
            "📍 Overlay position: ({}, {}) covering area to ({}, {})",
            x_offset,
            y_offset,
            x_offset + width,
            y_offset + height
          );
          println!("🎯 This overlay will cover ALL screens simultaneously!");

          (width, height, x_offset, y_offset)
        }
        Err(e) => {
          println!(
            "⚠️ Failed to get total screen area: {}, falling back to single screen",
            e
          );
          // Fallback to single screen
          match screenshots::Screen::all() {
            Ok(screens) => {
              if let Some(screen) = screens.first() {
                let width = screen.display_info.width as f64;
                let height = screen.display_info.height as f64;
                println!("📺 Fallback: Using single screen {}x{}", width, height);
                (width, height, 0.0, 0.0)
              } else {
                println!("⚠️ No screens found, using fallback 1920x1080");
                (1920.0, 1080.0, 0.0, 0.0)
              }
            }
            Err(e) => {
              println!("❌ Failed to get screen info: {}, using fallback", e);
              (1920.0, 1080.0, 0.0, 0.0)
            }
          }
        }
      };

    println!("🔧 Creating React overlay window with:");
    println!("   Size: {}x{}", screen_width, screen_height);
    println!("   Position: ({}, {})", offset_x, offset_y);
    println!("   Properties: transparent, always-on-top, no decorations");

    // Create React-based overlay window that covers ALL screens
    let overlay = WebviewWindowBuilder::new(
      app,
      "overlay",                         // Same ID as regular overlay
      WebviewUrl::App("overlay".into()), // React route från OverlayApp.tsx
    )
    .title("FrameSense Selection")
    .inner_size(screen_width, screen_height)
    .position(offset_x, offset_y) // Start at the leftmost screen
    .decorations(false) // No window borders
    .transparent(true) // Make window transparent!
    .always_on_top(true) // Above all other windows
    .skip_taskbar(true) // Don't show in taskbar
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .focused(true) // Ensure window can receive events
    .build()
    .map_err(|e| format!("Failed to create React overlay: {}", e))?;

    // Force focus to ensure events work
    if let Err(e) = overlay.set_focus() {
      println!("⚠️ Could not set React overlay focus: {}", e);
    }

    println!("✅ MULTI-SCREEN OVERLAY CREATED SUCCESSFULLY!");
    println!("🎉 Users can now drag selections across ALL monitors!");
    println!(
      "📐 Coordinate system: overlay (0,0) = screen ({}, {})",
      offset_x, offset_y
    );
    println!("🚀 === OVERLAY CREATION COMPLETE ===\n");

    Ok(overlay)
  }
}

impl Default for OverlayManager {
  fn default() -> Self {
    Self::new()
  }
}
