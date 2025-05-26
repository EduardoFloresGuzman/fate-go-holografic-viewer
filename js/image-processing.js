/**
 * Image Processing utilities for character/background separation
 * Enables selective holographic effects on card backgrounds only
 */

class ImageProcessor {    static async processCardImage(imageUrl, options = {}) {
        const {
            threshold = 0.3,           // Lower threshold for smoother detection
            blurRadius = 4,            // More blur for smoother edges
            dilateSize = 2,            // Smaller dilation to avoid patches
            featherEdge = 8            // More feathering for smooth transitions
        } = options;

        try {
            // Load image
            const img = await this.loadImage(imageUrl);
            
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Create character mask using edge detection + center bias
            const characterMask = this.createCharacterMask(imageData, {
                threshold,
                blurRadius,
                dilateSize,
                featherEdge
            });
            
            // Create background mask (inverse of character mask)
            const backgroundMask = this.invertMask(characterMask);
            
            return {
                originalImage: img,
                characterMask,
                backgroundMask,
                canvas,
                dimensions: { width: img.width, height: img.height }
            };
            
        } catch (error) {
            console.error('Error processing card image:', error);
            return null;
        }
    }

    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Enable CORS for external images
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }    static createCharacterMask(imageData, options) {
        const { width, height, data } = imageData;
        const { threshold, dilateSize, featherEdge } = options;
        
        // Create initial mask with smoother detection
        const mask = new Uint8ClampedArray(width * height);
        
        // Use luminance and edge detection combined with position bias
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // Calculate luminance (brightness)
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                
                // Get edge strength using Sobel operator
                const gx = this.getSobelX(data, x, y, width);
                const gy = this.getSobelY(data, x, y, width);
                const edgeStrength = Math.sqrt(gx * gx + gy * gy) / 255;
                
                // Position bias - characters usually in center and upper portion
                const centerX = width / 2;
                const centerY = height * 0.4; // Bias toward upper center
                const distanceFromCenter = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );
                const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
                const positionBias = Math.max(0, 1 - (distanceFromCenter / maxDistance));
                
                // Combine factors with gradual weighting
                const characterProbability = (
                    (luminance * 0.3) +           // Brightness factor
                    (edgeStrength * 0.4) +        // Edge detection
                    (positionBias * 0.3)          // Position bias
                );
                
                // Use soft threshold with gradual transition
                const softThreshold = Math.max(0, Math.min(255, 
                    (characterProbability - threshold) * 3 * 255
                ));
                
                mask[y * width + x] = softThreshold;
            }
        }
        
        // Apply Gaussian blur for smoother transitions
        const blurredMask = this.gaussianBlur(mask, width, height, 2);
        
        // Light dilation to connect character parts
        const dilatedMask = this.dilateMask(blurredMask, width, height, dilateSize);
        
        // Apply feathering for smooth edges
        const featheredMask = this.featherMask(dilatedMask, width, height, featherEdge);
        
        return featheredMask;
    }

    static getSobelX(data, x, y, width) {
        const getPixel = (px, py) => {
            const idx = (py * width + px) * 4;
            return (data[idx] + data[idx + 1] + data[idx + 2]) / 3; // Grayscale
        };
        
        return (
            -1 * getPixel(x - 1, y - 1) +
            1 * getPixel(x + 1, y - 1) +
            -2 * getPixel(x - 1, y) +
            2 * getPixel(x + 1, y) +
            -1 * getPixel(x - 1, y + 1) +
            1 * getPixel(x + 1, y + 1)
        );
    }

    static getSobelY(data, x, y, width) {
        const getPixel = (px, py) => {
            const idx = (py * width + px) * 4;
            return (data[idx] + data[idx + 1] + data[idx + 2]) / 3; // Grayscale
        };
        
        return (
            -1 * getPixel(x - 1, y - 1) +
            -2 * getPixel(x, y - 1) +
            -1 * getPixel(x + 1, y - 1) +
            1 * getPixel(x - 1, y + 1) +
            2 * getPixel(x, y + 1) +
            1 * getPixel(x + 1, y + 1)
        );
    }

    static dilateMask(mask, width, height, size) {
        const dilated = new Uint8ClampedArray(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let maxValue = 0;
                
                // Check surrounding pixels within dilate size
                for (let dy = -size; dy <= size; dy++) {
                    for (let dx = -size; dx <= size; dx++) {
                        const nx = Math.max(0, Math.min(width - 1, x + dx));
                        const ny = Math.max(0, Math.min(height - 1, y + dy));
                        maxValue = Math.max(maxValue, mask[ny * width + nx]);
                    }
                }
                
                dilated[y * width + x] = maxValue;
            }
        }
        
        return dilated;
    }

    static featherMask(mask, width, height, featherSize) {
        const feathered = new Uint8ClampedArray(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                // Average surrounding pixels for smooth transition
                for (let dy = -featherSize; dy <= featherSize; dy++) {
                    for (let dx = -featherSize; dx <= featherSize; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance <= featherSize) {
                                const weight = 1 - (distance / featherSize);
                                sum += mask[ny * width + nx] * weight;
                                count += weight;
                            }
                        }
                    }
                }
                
                feathered[y * width + x] = count > 0 ? sum / count : mask[y * width + x];
            }
        }
        
        return feathered;
    }

    static gaussianBlur(data, width, height, radius) {
        const blurred = new Uint8ClampedArray(data.length);
        const kernel = this.createGaussianKernel(radius);
        const kernelSize = kernel.length;
        const halfKernel = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let weightSum = 0;
                
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        const px = Math.max(0, Math.min(width - 1, x + kx - halfKernel));
                        const py = Math.max(0, Math.min(height - 1, y + ky - halfKernel));
                        const weight = kernel[ky][kx];
                        
                        sum += data[py * width + px] * weight;
                        weightSum += weight;
                    }
                }
                
                blurred[y * width + x] = weightSum > 0 ? sum / weightSum : data[y * width + x];
            }
        }
        
        return blurred;
    }
    
    static createGaussianKernel(radius) {
        const size = radius * 2 + 1;
        const kernel = [];
        const sigma = radius / 3;
        const twoSigmaSquare = 2 * sigma * sigma;
        
        for (let y = 0; y < size; y++) {
            kernel[y] = [];
            for (let x = 0; x < size; x++) {
                const dx = x - radius;
                const dy = y - radius;
                const distance = dx * dx + dy * dy;
                kernel[y][x] = Math.exp(-distance / twoSigmaSquare);
            }
        }
        
        return kernel;
    }

    static invertMask(mask) {
        const inverted = new Uint8ClampedArray(mask.length);
        for (let i = 0; i < mask.length; i++) {
            inverted[i] = 255 - mask[i];
        }
        return inverted;
    }    static createMaskDataURL(mask, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        const imageData = ctx.createImageData(width, height);
        
        for (let i = 0; i < mask.length; i++) {
            const pixelIndex = i * 4;
            const maskValue = mask[i];
            
            // Create smooth alpha gradients instead of hard edges
            imageData.data[pixelIndex] = 255;     // R
            imageData.data[pixelIndex + 1] = 255; // G
            imageData.data[pixelIndex + 2] = 255; // B
            imageData.data[pixelIndex + 3] = maskValue; // A - use mask value directly for smooth transitions
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }
}
