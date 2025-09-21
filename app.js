// main app logic

let originalImageData = null;
let filteredImageElement;
let wasmLoaded = false;



// JS versions of the filters for comparison

function jsApplyBlur(imageData, width, height, radius) {
    const data = new Uint8ClampedArray(imageData.data);
    const original = new Uint8ClampedArray(imageData.data);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let totalR = 0, totalG = 0, totalB = 0, count = 0;
            
            // box blur - average pixels in radius
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const newX = x + dx;
                    const newY = y + dy;
                    
                    if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                        const index = (newY * width + newX) * 4;
                        totalR += original[index];
                        totalG += original[index + 1];
                        totalB += original[index + 2];
                        count++;
                    }
                }
            }
            
            const currentIndex = (y * width + x) * 4;
            data[currentIndex] = totalR / count;
            data[currentIndex + 1] = totalG / count;
            data[currentIndex + 2] = totalB / count;
        }
    }
    
    for (let i = 0; i < data.length; i++) {
        imageData.data[i] = data[i];
    }
}

function jsAdjustBrightness(imageData, factor) {
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] * factor));
        imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] * factor));
        imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] * factor));
    }
}

function jsAdjustContrast(imageData, factor) {
    const contrast = (factor - 1) * 128;
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.min(255, Math.max(0, factor * imageData.data[i] - contrast));
        imageData.data[i + 1] = Math.min(255, Math.max(0, factor * imageData.data[i + 1] - contrast));
        imageData.data[i + 2] = Math.min(255, Math.max(0, factor * imageData.data[i + 2] - contrast));
    }
}

function jsGrayscale(imageData) {
    for (let i = 0; i < imageData.data.length; i += 4) {
        // luminance formula - works better than just averaging RGB
        const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
        imageData.data[i] = gray;
        imageData.data[i + 1] = gray;
        imageData.data[i + 2] = gray;
    }
}

function checkWasmAvailability() {
    return new Promise((resolve) => {
        const isWasmReady = () => {
            return typeof Module !== 'undefined' && 
                   window.wasmReady === true &&
                   typeof Module._malloc === 'function' && 
                   typeof Module._applyBlur === 'function';
        };

        if (isWasmReady()) {
            wasmLoaded = true;
            console.log('WASM ready');
            resolve();
            return;
        }

        if (typeof Module === 'undefined') {
            console.log('WASM not found - build it first');
            wasmLoaded = false;
            document.getElementById('wasmWarning').style.display = 'block';
            const wasmOption = document.querySelector('#implementation option[value="wasm"]');
            wasmOption.disabled = true;
            wasmOption.textContent = 'WebAssembly (Not Available)';
            document.getElementById('implementation').value = 'js';
            resolve();
            return;
        }

        const checkReady = () => {
            if (isWasmReady()) {
                wasmLoaded = true;
                console.log('WASM loaded successfully');
                resolve();
            } else if (window.wasmReady === false) {
                wasmLoaded = false;
                console.error('WASM loading failed');
                document.getElementById('wasmWarning').style.display = 'block';
                const wasmOption = document.querySelector('#implementation option[value="wasm"]');
                wasmOption.disabled = true;
                wasmOption.textContent = 'WebAssembly (Failed)';
                document.getElementById('implementation').value = 'js';
                resolve();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        
        setTimeout(() => {
            if (!wasmLoaded) {
                console.warn('WASM timeout');
                wasmLoaded = false;
                document.getElementById('wasmWarning').style.display = 'block';
                const wasmOption = document.querySelector('#implementation option[value="wasm"]');
                wasmOption.disabled = true;
                wasmOption.textContent = 'WebAssembly (Timeout)';
                document.getElementById('implementation').value = 'js';
                resolve();
            }
        }, 5000);
        
        checkReady();
    });
}

// EVENT LISTENERS - MAKING THE UI INTERACTIVE

document.getElementById('intensity').addEventListener('input', (e) => {
    document.getElementById('intensityValue').textContent = e.target.value;
});

function loadDefaultImage() {
    const img = new Image();
    img.onload = () => {
        // Create a temporary canvas to extract image data
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);
        
        originalImageData = tempCtx.getImageData(0, 0, img.width, img.height);
        console.log('loaded default image:', img.width, 'x', img.height);
    };
    img.src = 'screenshots/LAB.png';
}

document.getElementById('applyFilter').addEventListener('click', async () => {
    if (!originalImageData) {
        alert('Default image not loaded yet, please wait');
        return;
    }
    
    const implementation = document.getElementById('implementation').value;
    const filter = document.getElementById('filter').value;  
    const intensity = parseInt(document.getElementById('intensity').value);
    
    if (implementation === 'wasm' && !wasmLoaded) {
        alert('WASM not available - run build.ps1 first');
        return;
    }
    
    const imageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );
    
    const btn = document.getElementById('applyFilter');
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    console.log(`applying ${filter} (${implementation}) intensity=${intensity}`);
    
    const t1 = performance.now();
    
    if (implementation == 'js') {
        switch (filter) {
            case 'blur':
                jsApplyBlur(imageData, imageData.width, imageData.height, intensity);
                break;
            case 'brightness':
                jsAdjustBrightness(imageData, intensity / 10.0);
                break;  
            case 'contrast':
                jsAdjustContrast(imageData, intensity / 10.0);
                break;
            case 'grayscale':
                jsGrayscale(imageData);
                break;
        }
    } else {
        try {
            await Module.ready;
            
            const dataSize = imageData.data.length;
            const ptr = Module._malloc(dataSize);
            
            const mem = HEAPU8 || new Uint8Array(wasmMemory.buffer);
            mem.set(imageData.data, ptr);
            
            switch (filter) {
                case 'blur':
                    Module._applyBlur(ptr, imageData.width, imageData.height, intensity);
                    break;
                case 'brightness':
                    Module._adjustBrightness(ptr, imageData.width, imageData.height, intensity / 10.0);
                    break;
                case 'contrast': 
                    Module._adjustContrast(ptr, imageData.width, imageData.height, intensity / 10.0);
                    break;
                case 'grayscale':
                    Module._grayscale(ptr, imageData.width, imageData.height);
                    break;
            }
            
            const result = mem.subarray(ptr, ptr + dataSize);
            imageData.data.set(result);
            Module._free(ptr);
        } catch (error) {
            console.error('WASM failed:', error);
            // JS fallback
            switch (filter) {
                case 'blur':
                    jsApplyBlur(imageData, imageData.width, imageData.height, intensity);
                    break;
                case 'brightness':
                    jsAdjustBrightness(imageData, intensity / 10.0);
                    break;
                case 'contrast':
                    jsAdjustContrast(imageData, intensity / 10.0);
                    break; 
                case 'grayscale':
                    jsGrayscale(imageData);
                    break;
            }
        }
    }
    
    const t2 = performance.now();
    const time = t2 - t1;
    
    // Convert processed imageData to image URL and update the img element
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    filteredImageElement.src = tempCanvas.toDataURL();
    
    document.getElementById('performance').innerHTML = `
        Processing time (${implementation}): ${time.toFixed(1)}ms
        <br>Try the other implementation to compare!
    `;
    
    btn.disabled = false;
    btn.textContent = 'Apply Filter';
    
    console.log(`done in ${time.toFixed(1)}ms`);
});

document.getElementById('resetImage').addEventListener('click', () => {
    filteredImageElement.src = 'screenshots/LAB.png';
    document.getElementById('performance').innerHTML = 'Reset to original LAB image';
    console.log('reset to original');
});

// Initialize when page loads
window.onload = () => {
    console.log('PAGE LOADED - LOADING DEFAULT IMAGE');
    
    // Initialize image elements
    filteredImageElement = document.getElementById('filteredImage');
    
    // Check WASM availability
    setTimeout(() => {
        checkWasmAvailability();
    }, 2000);
    
    // Load the default LAB.png image
    loadDefaultImage();
};