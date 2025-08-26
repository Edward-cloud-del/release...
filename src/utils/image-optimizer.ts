// 🖼️ IMAGE OPTIMIZER - Faster API calls through smart compression
// =================================================================

export interface ImageOptimization {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality: number;
  dimensions: { width: number; height: number };
}

export interface OptimizedImage {
  dataUrl: string;
  optimization: ImageOptimization;
}

export class ImageOptimizer {
  
  static async optimizeForAI(
    imageDataUrl: string, 
    targetSizeKB: number = 800,
    maxDimension: number = 1024
  ): Promise<OptimizedImage> {
    
    const originalSize = this.getImageSizeKB(imageDataUrl);
    
    // If already small enough, return as-is
    if (originalSize <= targetSizeKB) {
      const dimensions = await this.getImageDimensions(imageDataUrl);
      return {
        dataUrl: imageDataUrl,
        optimization: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          quality: 100,
          dimensions
        }
      };
    }

    console.log(`🖼️ Optimizing image: ${Math.round(originalSize)}KB → target ${targetSizeKB}KB`);

    // Load image
    const img = await this.loadImage(imageDataUrl);
    
    // Calculate optimal dimensions
    const { width, height } = this.calculateOptimalDimensions(
      img.naturalWidth, 
      img.naturalHeight, 
      maxDimension
    );

    // Try different quality levels until we hit target size
    let quality = 0.8;
    let compressedDataUrl = '';
    let compressedSize = originalSize;

    for (let attempt = 0; attempt < 5; attempt++) {
      compressedDataUrl = await this.compressImage(img, width, height, quality);
      compressedSize = this.getImageSizeKB(compressedDataUrl);
      
      console.log(`🔄 Attempt ${attempt + 1}: Quality ${Math.round(quality * 100)}% → ${Math.round(compressedSize)}KB`);
      
      if (compressedSize <= targetSizeKB) {
        break;
      }
      
      // Reduce quality for next attempt
      quality *= 0.8;
    }

    const compressionRatio = originalSize / compressedSize;
    
    console.log(`✅ Image optimization complete: ${Math.round(compressionRatio * 100)}% compression`);

    return {
      dataUrl: compressedDataUrl,
      optimization: {
        originalSize,
        compressedSize,
        compressionRatio,
        quality: quality * 100,
        dimensions: { width, height }
      }
    };
  }

  static async optimizeForQuestionType(imageDataUrl: string, questionType: string): Promise<OptimizedImage> {
    // Different optimization strategies based on question type
    const strategies = {
      text_extraction: { targetSize: 1200, maxDimension: 1536, quality: 0.9 }, // High quality for OCR
      code_analysis: { targetSize: 1000, maxDimension: 1280, quality: 0.85 },   // Good quality for code
      ui_analysis: { targetSize: 800, maxDimension: 1024, quality: 0.8 },       // Balanced for UI
      data_analysis: { targetSize: 1000, maxDimension: 1280, quality: 0.85 },   // Good for charts
      general: { targetSize: 600, maxDimension: 800, quality: 0.75 }            // Smaller for general use
    };

    const strategy = strategies[questionType as keyof typeof strategies] || strategies.general;
    
    console.log(`🎯 Using ${questionType} optimization strategy:`, strategy);
    
    return this.optimizeForAI(imageDataUrl, strategy.targetSize, strategy.maxDimension);
  }

  private static getImageSizeKB(dataUrl: string): number {
    // Remove data:image/png;base64, prefix and calculate size
    const base64 = dataUrl.split(',')[1] || dataUrl;
    return (base64.length * 0.75) / 1024;
  }

  private static async getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    const img = await this.loadImage(dataUrl);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight
    };
  }

  private static loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  private static calculateOptimalDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxDimension: number
  ): { width: number; height: number } {
    
    if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxDimension * aspectRatio),
        height: maxDimension
      };
    }
  }

  private static async compressImage(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number
  ): Promise<string> {
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw image with smooth scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(img, 0, 0, width, height);
    
    // Convert to JPEG for better compression (or PNG if transparency needed)
    return canvas.toDataURL('image/jpeg', quality);
  }

  // Quick size check utility
  static getImageInfo(dataUrl: string): { sizeKB: number; format: string } {
    const sizeKB = this.getImageSizeKB(dataUrl);
    const format = dataUrl.includes('data:image/') 
      ? dataUrl.split(';')[0].split('/')[1] 
      : 'unknown';
    
    return { sizeKB, format };
  }
} 