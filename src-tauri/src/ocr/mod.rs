// OCR module - simplified version for GitHub Actions compatibility
// use tesseract::Tesseract; // Disabled for GitHub Actions
use base64::Engine;
use image::{DynamicImage, GenericImageView};

pub struct OCRService;

impl OCRService {
  pub fn new() -> Result<Self, String> {
    // Simplified version without Tesseract dependency
    Ok(Self)
  }

  pub fn extract_text(&self, image_data: &str) -> Result<OCRResult, String> {
    // Remove data:image/png;base64, prefix if exists
    let base64_data = if image_data.starts_with("data:image") {
      image_data.split(',').nth(1).unwrap_or(image_data)
    } else {
      image_data
    };

    // Decode base64 image to verify it's valid
    let image_bytes = base64::engine::general_purpose::STANDARD
      .decode(base64_data)
      .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Load image to verify it's valid
    let img =
      image::load_from_memory(&image_bytes).map_err(|e| format!("Failed to load image: {}", e))?;

    // Check image dimensions
    let (width, height) = img.dimensions();
    if width < 10 || height < 10 {
      return Err(format!(
        "Image too small for OCR: {}x{} pixels",
        width, height
      ));
    }

    println!("📏 Image dimensions: {}x{} pixels", width, height);

    // Return placeholder result (Tesseract disabled for GitHub Actions)
    Ok(OCRResult {
      text: "OCR functionality temporarily disabled for this build".to_string(),
      confidence: 0.0,
      has_text: false,
    })
  }
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct OCRResult {
  pub text: String,
  pub confidence: f32,
  pub has_text: bool,
}
