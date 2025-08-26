use screenshots::Screen;
use image::{ImageFormat, RgbaImage, DynamicImage};
use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct CaptureBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CaptureResult {
    pub image_data: String, // Base64 encoded image
    pub bounds: CaptureBounds,
    pub timestamp: u64,
}

pub struct ScreenCapture;

impl ScreenCapture {
    pub fn new() -> Self {
        Self
    }

    /// Take a fullscreen screenshot
    pub async fn capture_fullscreen() -> Result<String, String> {
        println!("🖼️ Taking fullscreen screenshot...");
        
        let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
        
        if screens.is_empty() {
            return Err("No screens found".to_string());
        }
        
        let screen = &screens[0];
        println!("📸 Capturing screen: {}x{}", screen.display_info.width, screen.display_info.height);
        
        let screenshot = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;
        
        Self::encode_image_to_base64(screenshot)
    }

    /// Take a screenshot of a specific region
    pub async fn capture_region(bounds: CaptureBounds) -> Result<CaptureResult, String> {
        println!("🎯 Capturing region: {:?}", bounds);
        
        let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
        
        if screens.is_empty() {
            return Err("No screens found".to_string());
        }
        
        let screen = &screens[0];
        let screenshot = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;
        
        // Convert to RgbaImage for cropping
        let rgba_image = RgbaImage::from_raw(
            screenshot.width(),
            screenshot.height(),
            screenshot.rgba().to_vec(),
        ).ok_or("Failed to create RGBA image from screenshot")?;
        
        // Crop the image to the specified bounds
        let cropped = Self::crop_image(rgba_image, &bounds)?;
        
        // Encode to base64
        let image_data = Self::encode_rgba_to_base64(cropped)?;
        
        Ok(CaptureResult {
            image_data,
            bounds,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        })
    }

    /// Crop an RgbaImage to the specified bounds
    fn crop_image(image: RgbaImage, bounds: &CaptureBounds) -> Result<RgbaImage, String> {
        let (img_width, img_height) = image.dimensions();
        
        // Validate bounds
        if bounds.x < 0 || bounds.y < 0 {
            return Err("Negative coordinates not supported".to_string());
        }
        
        let x = bounds.x as u32;
        let y = bounds.y as u32;
        let width = bounds.width.min(img_width.saturating_sub(x));
        let height = bounds.height.min(img_height.saturating_sub(y));
        
        if width == 0 || height == 0 {
            return Err("Invalid crop dimensions".to_string());
        }
        
        // Create new image with cropped dimensions
        let mut cropped = RgbaImage::new(width, height);
        
        for crop_y in 0..height {
            for crop_x in 0..width {
                let src_x = x + crop_x;
                let src_y = y + crop_y;
                
                if src_x < img_width && src_y < img_height {
                    let pixel = image.get_pixel(src_x, src_y);
                    cropped.put_pixel(crop_x, crop_y, *pixel);
                }
            }
        }
        
        Ok(cropped)
    }

    /// Convert screenshots::Image to base64
    fn encode_image_to_base64(screenshot: screenshots::Image) -> Result<String, String> {
        let rgba_image = RgbaImage::from_raw(
            screenshot.width(),
            screenshot.height(),
            screenshot.rgba().to_vec(),
        ).ok_or("Failed to create RGBA image from screenshot")?;
        
        Self::encode_rgba_to_base64(rgba_image)
    }

    /// Convert RgbaImage to base64 PNG
    fn encode_rgba_to_base64(rgba_image: RgbaImage) -> Result<String, String> {
        let dynamic_image = DynamicImage::ImageRgba8(rgba_image);
        
        let mut png_buffer = Vec::new();
        {
            let mut cursor = Cursor::new(&mut png_buffer);
            dynamic_image.write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;
        }
        
        let base64_data = general_purpose::STANDARD.encode(&png_buffer);
        Ok(format!("data:image/png;base64,{}", base64_data))
    }

    /// Get display information for all screens
    pub fn get_screen_info() -> Result<Vec<ScreenInfo>, String> {
        let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
        
        let screen_info: Vec<ScreenInfo> = screens
            .iter()
            .enumerate()
            .map(|(index, screen)| {
                println!("🖥️ Screen {}: {}x{} at ({}, {}) scale={}", 
                         index, 
                         screen.display_info.width, 
                         screen.display_info.height,
                         screen.display_info.x,
                         screen.display_info.y,
                         screen.display_info.scale_factor);
                ScreenInfo {
                    id: index as u32,
                    width: screen.display_info.width,
                    height: screen.display_info.height,
                    scale_factor: screen.display_info.scale_factor,
                    is_primary: index == 0, // First screen is typically primary
                }
            })
            .collect();
        
        Ok(screen_info)
    }

    /// Get the total area covering all screens
    pub fn get_total_screen_area() -> Result<TotalScreenArea, String> {
        let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
        
        if screens.is_empty() {
            return Err("No screens found".to_string());
        }

        let mut min_x = i32::MAX;
        let mut min_y = i32::MAX;
        let mut max_x = i32::MIN;
        let mut max_y = i32::MIN;

        for screen in &screens {
            let display = &screen.display_info;
            
            // Get screen bounds (x, y, width, height)
            let screen_x = display.x;
            let screen_y = display.y;
            let screen_width = display.width as i32;
            let screen_height = display.height as i32;
            
            min_x = min_x.min(screen_x);
            min_y = min_y.min(screen_y);
            max_x = max_x.max(screen_x + screen_width);
            max_y = max_y.max(screen_y + screen_height);
        }

        let total_width = (max_x - min_x) as u32;
        let total_height = (max_y - min_y) as u32;

        println!("🖥️ Total screen area: {}x{} from ({}, {}) to ({}, {})", 
                 total_width, total_height, min_x, min_y, max_x, max_y);

        Ok(TotalScreenArea {
            width: total_width,
            height: total_height,
            min_x,
            min_y,
            max_x,
            max_y,
        })
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ScreenInfo {
    pub id: u32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
    pub is_primary: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct TotalScreenArea {
    pub width: u32,
    pub height: u32,
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
} 