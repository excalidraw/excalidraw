/**
 * ImageProcessingService
 * 
 * Handles image input from multiple sources and preprocessing for LLM analysis.
 * Supports clipboard paste, file upload, and drag & drop.
 */

export interface ProcessedImage {
  blob: Blob;
  dataUrl: string;
  format: string;
  dimensions: { width: number; height: number };
  size: number;
  metadata: ImageMetadata;
}

export interface ImageMetadata {
  fileName?: string;
  lastModified?: Date;
  source: 'clipboard' | 'upload' | 'dragdrop';
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface OptimizedImage extends ProcessedImage {
  originalSize: number;
  compressionRatio: number;
}

const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 4096; // Max width or height
const TARGET_MAX_DIMENSION = 2048; // Target for optimization

export class ImageProcessingService {
  /**
   * Process image from clipboard paste event
   */
  async processClipboardImage(
    clipboardData: DataTransfer,
  ): Promise<ProcessedImage> {
    const items = Array.from(clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));

    if (!imageItem) {
      throw new Error('No image found in clipboard');
    }

    const file = imageItem.getAsFile();
    if (!file) {
      throw new Error('Failed to get image from clipboard');
    }

    return this.processFile(file, 'clipboard');
  }

  /**
   * Process uploaded files from file input
   */
  async processUploadedFiles(files: FileList): Promise<ProcessedImage[]> {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith('image/'),
    );

    if (imageFiles.length === 0) {
      throw new Error('No image files selected');
    }

    return Promise.all(
      imageFiles.map((file) => this.processFile(file, 'upload')),
    );
  }

  /**
   * Process images from drag and drop event
   */
  async processDragDropImage(
    dragData: DataTransfer,
  ): Promise<ProcessedImage[]> {
    const files = Array.from(dragData.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      throw new Error('No image files found in drop');
    }

    return Promise.all(
      imageFiles.map((file) => this.processFile(file, 'dragdrop')),
    );
  }

  /**
   * Validate image file
   */
  async validateImage(blob: Blob): Promise<ValidationResult> {
    // Check file type
    if (!SUPPORTED_FORMATS.includes(blob.type)) {
      return {
        isValid: false,
        error: `Unsupported format: ${blob.type}. Supported formats: PNG, JPEG, WebP, GIF`,
      };
    }

    // Check file size
    if (blob.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File too large: ${this.formatSize(blob.size)}. Maximum size: ${this.formatSize(MAX_FILE_SIZE)}`,
      };
    }

    // Check image dimensions
    try {
      const dimensions = await this.getImageDimensions(blob);
      if (
        dimensions.width > MAX_DIMENSION ||
        dimensions.height > MAX_DIMENSION
      ) {
        return {
          isValid: false,
          error: `Image too large: ${dimensions.width}x${dimensions.height}. Maximum dimension: ${MAX_DIMENSION}px`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to read image dimensions',
      };
    }

    return { isValid: true };
  }

  /**
   * Optimize image for LLM analysis
   * Resizes large images and compresses to reduce API costs
   */
  async optimizeForAnalysis(
    image: ProcessedImage,
  ): Promise<OptimizedImage> {
    const { width, height } = image.dimensions;

    // Check if optimization is needed
    if (width <= TARGET_MAX_DIMENSION && height <= TARGET_MAX_DIMENSION) {
      return {
        ...image,
        originalSize: image.size,
        compressionRatio: 1,
      };
    }

    // Calculate new dimensions maintaining aspect ratio
    const scale = Math.min(
      TARGET_MAX_DIMENSION / width,
      TARGET_MAX_DIMENSION / height,
    );
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    // Create canvas and resize
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Load image
    const img = await this.loadImage(image.dataUrl);

    // Draw resized image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to blob
    const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.85, // Quality
      );
    });

    // Convert to data URL
    const optimizedDataUrl = await this.blobToDataUrl(optimizedBlob);

    return {
      blob: optimizedBlob,
      dataUrl: optimizedDataUrl,
      format: 'image/jpeg',
      dimensions: { width: newWidth, height: newHeight },
      size: optimizedBlob.size,
      metadata: image.metadata,
      originalSize: image.size,
      compressionRatio: image.size / optimizedBlob.size,
    };
  }

  /**
   * Process a single file
   */
  private async processFile(
    file: File,
    source: ImageMetadata['source'],
  ): Promise<ProcessedImage> {
    // Validate
    const validation = await this.validateImage(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Get dimensions
    const dimensions = await this.getImageDimensions(file);

    // Convert to data URL
    const dataUrl = await this.blobToDataUrl(file);

    return {
      blob: file,
      dataUrl,
      format: file.type,
      dimensions,
      size: file.size,
      metadata: {
        fileName: file.name,
        lastModified: new Date(file.lastModified),
        source,
      },
    };
  }

  /**
   * Get image dimensions from blob
   */
  private async getImageDimensions(
    blob: Blob,
  ): Promise<{ width: number; height: number }> {
    const dataUrl = await this.blobToDataUrl(blob);
    const img = await this.loadImage(dataUrl);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  /**
   * Convert blob to data URL
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Load image from data URL
   */
  private async loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Export singleton instance
export const imageProcessingService = new ImageProcessingService();
