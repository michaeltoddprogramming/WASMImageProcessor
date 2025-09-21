#include <emscripten/emscripten.h>
#include <algorithm>
#include <cmath>

extern "C" {
    
    EMSCRIPTEN_KEEPALIVE
    void applyBlur(unsigned char* imageData, int width, int height, int radius) {
        unsigned char* temp = new unsigned char[width * height * 4];
        
        for (int i = 0; i < width * height * 4; i++) {
            temp[i] = imageData[i];
        }
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int totalR = 0, totalG = 0, totalB = 0, count = 0;
                
                for (int dy = -radius; dy <= radius; dy++) {
                    for (int dx = -radius; dx <= radius; dx++) {
                        int newX = x + dx;
                        int newY = y + dy;
                        
                        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                            int index = (newY * width + newX) * 4;
                            totalR += temp[index];
                            totalG += temp[index + 1];
                            totalB += temp[index + 2];
                            count++;
                        }
                    }
                }
                
                int currentIndex = (y * width + x) * 4;
                imageData[currentIndex] = totalR / count;
                imageData[currentIndex + 1] = totalG / count;
                imageData[currentIndex + 2] = totalB / count;
            }
        }
        
        delete[] temp;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void adjustBrightness(unsigned char* imageData, int width, int height, float factor) {
        int totalPixels = width * height * 4;
        
        for (int i = 0; i < totalPixels; i += 4) {
            imageData[i] = std::min(255.0f, std::max(0.0f, imageData[i] * factor));
            imageData[i + 1] = std::min(255.0f, std::max(0.0f, imageData[i + 1] * factor));
            imageData[i + 2] = std::min(255.0f, std::max(0.0f, imageData[i + 2] * factor));
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void adjustContrast(unsigned char* imageData, int width, int height, float factor) {
        int totalPixels = width * height * 4;
        float contrast = (factor - 1.0f) * 128.0f; 
        
        for (int i = 0; i < totalPixels; i += 4) {
            imageData[i] = std::min(255.0f, std::max(0.0f, factor * imageData[i] - contrast));
            imageData[i + 1] = std::min(255.0f, std::max(0.0f, factor * imageData[i + 1] - contrast));
            imageData[i + 2] = std::min(255.0f, std::max(0.0f, factor * imageData[i + 2] - contrast));
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void grayscale(unsigned char* imageData, int width, int height) {
        int totalPixels = width * height * 4;
        
        for (int i = 0; i < totalPixels; i += 4) {
            unsigned char gray = (unsigned char)(
                0.299f * imageData[i] + 
                0.587f * imageData[i + 1] + 
                0.114f * imageData[i + 2]
            );
            
            imageData[i] = gray;
            imageData[i + 1] = gray;
            imageData[i + 2] = gray;
        }
    }
}