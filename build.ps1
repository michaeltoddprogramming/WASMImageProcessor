echo "building..."
emcc --version
if ($LASTEXITCODE -ne 0) {
    echo "emcc not found - install emscripten first"
    exit
}
emcc imageprocessing.cpp -o imagefilters.js -s "EXPORTED_FUNCTIONS=[`"_applyBlur`", `"_adjustBrightness`", `"_adjustContrast`", `"_grayscale`", `"_malloc`", `"_free`"]" -s ALLOW_MEMORY_GROWTH=1 -O3
if ($LASTEXITCODE -eq 0) {
    echo "done! start a server with:"
    echo "python -m http.server 8000 or use Live Server or node or whatever you feeling"
} else {
    echo "build failed"
}