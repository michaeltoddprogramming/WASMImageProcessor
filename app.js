// main app logic

let originalImageData = null;
let originalCanvas = document.getElementById('originalCanvas');
let filteredCanvas = document.getElementById('filteredCanvas');
let originalCtx = originalCanvas.getContext('2d');
let filteredCtx = filteredCanvas.getContext('2d');
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

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const maxW = 800;
            const maxH = 600;
            let { width, height } = img;
            
            // don't want huge images slowing things down
            if (width > maxW || height > maxH) {
                const ratio = Math.min(maxW / width, maxH / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }
            
            originalCanvas.width = width;
            originalCanvas.height = height;
            filteredCanvas.width = width;
            filteredCanvas.height = height;
            
            originalCtx.drawImage(img, 0, 0, width, height);
            filteredCtx.drawImage(img, 0, 0, width, height);
            
            originalImageData = originalCtx.getImageData(0, 0, width, height);
            console.log('loaded image:', width, 'x', height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('applyFilter').addEventListener('click', async () => {
    if (!originalImageData) {
        alert('Upload an image first');
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
            
            if (typeof Module._malloc !== 'function') {
                throw new Error('malloc not found');
            }
            if (typeof Module._free !== 'function') {
                throw new Error('free not found');  
            }
            
            const dataSize = imageData.data.length;
            const ptr = Module._malloc(dataSize);
            
            if (!ptr) {
                throw new Error('malloc failed');
            }
            
            console.log('allocated', dataSize, 'bytes at', ptr);
            
            let mem;
            
            if (typeof HEAPU8 !== 'undefined') {
                mem = HEAPU8;
            } else if (typeof wasmMemory !== 'undefined' && wasmMemory.buffer) {
                mem = new Uint8Array(wasmMemory.buffer);
            } else {
                throw new Error('cant access wasm memory');
            }
            
            mem.set(imageData.data, ptr);
            
            switch (filter) {
                case 'blur':
                    if (!Module._applyBlur) throw new Error('blur function missing');
                    Module._applyBlur(ptr, imageData.width, imageData.height, intensity);
                    break;
                case 'brightness':
                    if (!Module._adjustBrightness) throw new Error('brightness function missing');
                    Module._adjustBrightness(ptr, imageData.width, imageData.height, intensity / 10.0);
                    break;
                case 'contrast': 
                    if (!Module._adjustContrast) throw new Error('contrast function missing');
                    Module._adjustContrast(ptr, imageData.width, imageData.height, intensity / 10.0);
                    break;
                case 'grayscale':
                    if (!Module._grayscale) throw new Error('grayscale function missing');
                    Module._grayscale(ptr, imageData.width, imageData.height);
                    break;
            }
            
            // copy processed data back
            const currentMem = typeof HEAPU8 !== 'undefined' ? HEAPU8 : new Uint8Array(wasmMemory.buffer);
            const result = currentMem.subarray(ptr, ptr + dataSize);
            imageData.data.set(result);
            
            Module._free(ptr);
        } catch (error) {
            console.error('WASM failed:', error);
            alert('WASM error, using JS fallback');
            // fallback to JS
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
    
    filteredCtx.putImageData(imageData, 0, 0);
    
    document.getElementById('performance').innerHTML = `
        Processing time (${implementation}): ${time.toFixed(1)}ms
        <br>Try the other implementation to compare!
    `;
    
    btn.disabled = false;
    btn.textContent = 'Apply Filter';
    
    console.log(`done in ${time.toFixed(1)}ms`);
});

document.getElementById('resetImage').addEventListener('click', () => {
    if (originalImageData) {
        filteredCtx.putImageData(originalImageData, 0, 0);
        document.getElementById('performance').innerHTML = 'Reset to original';
        console.log('reset');
    }
});

// CREATE A DEFAULT TEST IMAGE ON PAGE LOAD
window.onload = async () => {
    console.log('PAGE LOADED - CREATING DEFAULT TEST IMAGE');
    
    // CHECK WASM AVAILABILITY FIRST (WAIT A BIT FOR MODULE TO LOAD)
    setTimeout(() => {
        checkWasmAvailability();
    }, 2000);
    
    // CREATE A COLORFUL TEST PATTERN
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 300;
    
    // GRADIENT BACKGROUND
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.5, '#4ecdc4');
    gradient.addColorStop(1, '#45b7d1');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);
    
    // ADD SOME SHAPES FOR VISUAL INTEREST
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('WASM', 200, 100);
    ctx.fillText('Demo', 200, 160);
    
    // ADD SOME CIRCLES
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(
            Math.random() * 400,
            Math.random() * 300,
            Math.random() * 20 + 5,
            0, 2 * Math.PI
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.2})`;
        ctx.fill();
    }
    
    // DRAW ON BOTH CANVASES
    originalCtx.drawImage(canvas, 0, 0);
    filteredCtx.drawImage(canvas, 0, 0);
    
    // STORE AS ORIGINAL IMAGE DATA
    originalImageData = originalCtx.getImageData(0, 0, 400, 300);
};