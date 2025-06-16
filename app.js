class AIImageEditor {
    constructor() {
        // Canvas and media elements
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('videoPreview');
        
        // State management
        this.currentImage = null;
        this.originalImageData = null;
        this.isVideoMode = false;
        this.isProcessing = false;
        
        // AI Models
        this.bodyPixModel = null;
        this.blazeFaceModel = null;
        this.modelsLoaded = false;
        
        // UI Elements
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadArea = document.getElementById('uploadArea');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.modelStatus = document.getElementById('modelStatus');
        
        // Control elements
        this.bgRemoveBtn = document.getElementById('bgRemove');
        this.enhanceBtn = document.getElementById('enhance');
        this.faceDetectBtn = document.getElementById('faceDetect');
        this.brightnessSlider = document.getElementById('brightness');
        this.contrastSlider = document.getElementById('contrast');
        this.saturationSlider = document.getElementById('saturation');
        this.downloadBtn = document.getElementById('downloadImage');
        this.resetBtn = document.getElementById('resetImage');
        
        // Value display elements
        this.brightnessValue = document.getElementById('brightnessValue');
        this.contrastValue = document.getElementById('contrastValue');
        this.saturationValue = document.getElementById('saturationValue');
        
        // Filter buttons
        this.filterBtns = document.querySelectorAll('.filter-btn');
        
        // Initialize the application
        this.init();
    }
    
    async init() {
        try {
            this.setupEventListeners();
            await this.loadAIModels();
            this.updateModelStatus('✅ Ready');
            this.modelsLoaded = true;
        } catch (error) {
            console.error('Initialization failed:', error);
            this.updateModelStatus('❌ Failed to load');
        }
    }
    
    async loadAIModels() {
        this.updateModelStatus('🤖 Loading AI models...');
        
        try {
            // Load BodyPix model for background removal
            this.bodyPixModel = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            
            // Load BlazeFace model for face detection
            this.blazeFaceModel = await blazeface.load();
            
            console.log('AI models loaded successfully');
            
        } catch (error) {
            console.error('Error loading AI models:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // File upload events
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        
        // AI feature buttons
        this.bgRemoveBtn.addEventListener('click', () => this.removeBackground());
        this.enhanceBtn.addEventListener('click', () => this.enhanceImage());
        this.faceDetectBtn.addEventListener('click', () => this.detectFaces());
        
        // Manual adjustment sliders
        this.brightnessSlider.addEventListener('input', (e) => this.adjustBrightness(e.target.value));
        this.contrastSlider.addEventListener('input', (e) => this.adjustContrast(e.target.value));
        this.saturationSlider.addEventListener('input', (e) => this.adjustSaturation(e.target.value));
        
        // Filter buttons
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.applyFilter(e.target.dataset.filter));
        });
        
        // Export and reset buttons
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.resetBtn.addEventListener('click', () => this.resetImage());
    }
    
    // Drag and Drop Handlers
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }
    
    // File Upload Handler
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }
    
    processFile(file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Please select an image or video file');
            return;
        }
        
        const reader = new FileReader();
        const isVideo = file.type.startsWith('video/');
        
        if (isVideo) {
            this.isVideoMode = true;
            reader.onload = (e) => {
                this.video.src = e.target.result;
                this.video.style.display = 'block';
                this.canvas.style.display = 'none';
                this.enableControls(false); // Disable some controls for video
            };
        } else {
            this.isVideoMode = false;
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.currentImage = img;
                    this.drawImageToCanvas(img);
                    this.saveOriginalImageData();
                    this.enableControls(true);
                    this.canvas.style.display = 'block';
                    this.video.style.display = 'none';
                };
                img.src = e.target.result;
            };
        }
        
        reader.readAsDataURL(file);
    }
    
    drawImageToCanvas(img) {
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = img;
        
        // Calculate scaled dimensions
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(img, 0, 0, width, height);
    }
    
    saveOriginalImageData() {
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // AI Features
    async removeBackground() {
        if (!this.modelsLoaded || !this.currentImage || this.isProcessing) return;
        
        this.setProcessing(true);
        
        try {
            const segmentation = await this.bodyPixModel.segmentPerson(this.canvas);
            
            // Create a new image data with transparent background
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            // Apply segmentation mask
            for (let i = 0; i < segmentation.data.length; i++) {
                if (segmentation.data[i] === 0) { // Background pixel
                    const pixelIndex = i * 4;
                    data[pixelIndex + 3] = 0; // Set alpha to 0 (transparent)
                }
            }
            
            this.ctx.putImageData(imageData, 0, 0);
            
        } catch (error) {
            console.error('Background removal failed:', error);
            alert('Background removal failed. Please try again.');
        } finally {
            this.setProcessing(false);
        }
    }
    
    async detectFaces() {
        if (!this.modelsLoaded || !this.currentImage || this.isProcessing) return;
        
        this.setProcessing(true);
        
        try {
            const predictions = await this.blazeFaceModel.estimateFaces(this.canvas, false);
            
            // Draw face detection boxes
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 3;
            
            predictions.forEach(prediction => {
                const start = prediction.topLeft;
                const end = prediction.bottomRight;
                const size = [end[0] - start[0], end[1] - start[1]];
                
                this.ctx.strokeRect(start[0], start[1], size[0], size[1]);
            });
            
            if (predictions.length === 0) {
                alert('No faces detected in the image');
            } else {
                alert(`Detected ${predictions.length} face(s)`);
            }
            
        } catch (error) {
            console.error('Face detection failed:', error);
            alert('Face detection failed. Please try again.');
        } finally {
            this.setProcessing(false);
        }
    }
    
    enhanceImage() {
        if (!this.currentImage || this.isProcessing) return;
        
        this.setProcessing(true);
        
        try {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const enhancedData = this.applyEnhancementFilter(imageData);
            this.ctx.putImageData(enhancedData, 0, 0);
        } catch (error) {
            console.error('Image enhancement failed:', error);
            alert('Image enhancement failed. Please try again.');
        } finally {
            this.setProcessing(false);
        }
    }
    
    applyEnhancementFilter(imageData) {
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Apply sharpening and contrast enhancement
            data[i] = Math.min(255, Math.max(0, r * 1.1 + 5));
            data[i + 1] = Math.min(255, Math.max(0, g * 1.1 + 5));
            data[i + 2] = Math.min(255, Math.max(0, b * 1.1 + 5));
        }
        
        return imageData;
    }
    
    // Manual Adjustments
    adjustBrightness(value) {
        if (!this.originalImageData) return;
        
        this.brightnessValue.textContent = value + '%';
        this.applyAdjustments();
    }
    
    adjustContrast(value) {
        if (!this.originalImageData) return;
        
        this.contrastValue.textContent = value + '%';
        this.applyAdjustments();
    }
    
    adjustSaturation(value) {
        if (!this.originalImageData) return;
        
        this.saturationValue.textContent = value + '%';
        this.applyAdjustments();
    }
    
    applyAdjustments() {
        if (!this.originalImageData) return;
        
        const brightness = (this.brightnessSlider.value / 100) - 1;
        const contrast = this.contrastSlider.value / 100;
        const saturation = this.saturationSlider.value / 100;
        
        // Start with original image data
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply brightness
            r += brightness * 255;
            g += brightness * 255;
            b += brightness * 255;
            
            // Apply contrast
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;
            
            // Apply saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + saturation * (r - gray);
            g = gray + saturation * (g - gray);
            b = gray + saturation * (b - gray);
            
            // Clamp values
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    // Filters
    applyFilter(filterType) {
        if (!this.originalImageData) return;
        
        // Remove active class from all filter buttons
        this.filterBtns.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        event.target.classList.add('active');
        
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );
        
        this.applyFilterEffect(imageData, filterType);
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    applyFilterEffect(imageData, filterType) {
        const data = imageData.data;
        
        switch (filterType) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                break;
                
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
                
            case 'negative':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                break;
                
            case 'vintage':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.2);
                    data[i + 1] = Math.min(255, data[i + 1] * 1.1);
                    data[i + 2] = Math.min(255, data[i + 2] * 0.8);
                }
                break;
                
            case 'blur':
                // Simple box blur approximation
                this.applyBoxBlur(imageData, 2);
                break;
                
            case 'sharpen':
                this.applySharpen(imageData);
                break;
        }
    }
    
    applyBoxBlur(imageData, radius) {
        // Simplified blur implementation
        const { width, height, data } = imageData;
        const original = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const idx = (ny * width + nx) * 4;
                            r += original[idx];
                            g += original[idx + 1];
                            b += original[idx + 2];
                            count++;
                        }
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
            }
        }
    }
    
    applySharpen(imageData) {
        const { width, height, data } = imageData;
        const original = new Uint8ClampedArray(data);
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0, g = 0, b = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                        
                        r += original[idx] * weight;
                        g += original[idx + 1] * weight;
                        b += original[idx + 2] * weight;
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = Math.min(255, Math.max(0, r));
                data[idx + 1] = Math.min(255, Math.max(0, g));
                data[idx + 2] = Math.min(255, Math.max(0, b));
            }
        }
    }
    
    // Utility Functions
    enableControls(enabled) {
        const controls = [
            this.bgRemoveBtn, this.enhanceBtn, this.faceDetectBtn,
            this.brightnessSlider, this.contrastSlider, this.saturationSlider,
            this.downloadBtn, this.resetBtn, ...this.filterBtns
        ];
        
        controls.forEach(control => {
            control.disabled = !enabled;
        });
    }
    
    setProcessing(processing) {
        this.isProcessing = processing;
        this.loadingOverlay.style.display = processing ? 'flex' : 'none';
    }
    
    updateModelStatus(status) {
        this.modelStatus.textContent = status;
    }
    
    downloadImage() {
        if (!this.canvas) return;
        
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }
    
    resetImage() {
        if (!this.originalImageData) return;
        
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        // Reset all controls
        this.brightnessSlider.value = 100;
        this.contrastSlider.value = 100;
        this.saturationSlider.value = 100;
        this.brightnessValue.textContent = '100%';
        this.contrastValue.textContent = '100%';
        this.saturationValue.textContent = '100%';
        
        // Remove active filter
        this.filterBtns.forEach(btn => btn.classList.remove('active'));
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AIImageEditor();
});

// Additional utility functions for advanced features
class ImageProcessor {
    static createHistogram(imageData) {
        const histogram = {
            r: new Array(256).fill(0),
            g: new Array(256).fill(0),
            b: new Array(256).fill(0)
        };
        
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            histogram.r[data[i]]++;
            histogram.g[data[i + 1]]++;
            histogram.b[data[i + 2]]++;
        }
        
        return histogram;
    }
    
    static autoEnhance(imageData) {
        const histogram = this.createHistogram(imageData);
        const data = imageData.data;
        
        // Auto-level based on histogram
        const findMinMax = (hist) => {
            let min = 0, max = 255;
            for (let i = 0; i < 256; i++) {
                if (hist[i] > 0) { min = i; break; }
            }
            for (let i = 255; i >= 0; i--) {
                if (hist[i] > 0) { max = i; break; }
            }
            return { min, max };
        };
        
        const rMinMax = findMinMax(histogram.r);
        const gMinMax = findMinMax(histogram.g);
        const bMinMax = findMinMax(histogram.b);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = ((data[i] - rMinMax.min) / (rMinMax.max - rMinMax.min)) * 255;
            data[i + 1] = ((data[i + 1] - gMinMax.min) / (gMinMax.max - gMinMax.min)) * 255;
            data[i + 2] = ((data[i + 2] - bMinMax.min) / (bMinMax.max - bMinMax.min)) * 255;
        }
        
        return imageData;
    }
}
