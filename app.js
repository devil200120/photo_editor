class AIImageEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.originalImage = null;
        this.currentImage = null;
        this.history = [];
        this.historyIndex = -1;
        this.models = {
            bodyPix: null,
            blazeFace: null
        };
        this.isProcessing = false;
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        this.maxFileSize = 10485760; // 10MB
        this.maxDimensions = { width: 1920, height: 1080 };
        
        this.init();
    }

    async init() {
        this.initElements();
        this.initEventListeners();
        await this.initTensorFlow();
        this.updateModelStatus();
        this.showToast('AI Image Editor initialized', 'success');
    }

    initElements() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.progressFill = document.getElementById('progressFill');
        this.canvasInfo = document.getElementById('canvasInfo');
        this.imageInfo = document.getElementById('imageInfo');
        this.memoryInfo = document.getElementById('memoryInfo');
        this.toastContainer = document.getElementById('toastContainer');
        
        // Set initial canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.drawPlaceholder();
    }

    drawPlaceholder() {
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#6c757d';
        this.ctx.font = '20px FKGroteskNeue, Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Upload an image to get started', this.canvas.width / 2, this.canvas.height / 2);
    }

    initEventListeners() {
        // File upload events
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // AI feature buttons
        document.getElementById('bgRemove').addEventListener('click', () => this.removeBackground());
        document.getElementById('enhance').addEventListener('click', () => this.enhanceImage());
        document.getElementById('faceDetect').addEventListener('click', () => this.detectFaces());
        document.getElementById('autoCrop').addEventListener('click', () => this.smartCrop());

        // Manual adjustment sliders
        this.initSliders();

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter));
        });

        // Export and history buttons
        document.getElementById('downloadImage').addEventListener('click', () => this.downloadImage());
        document.getElementById('resetImage').addEventListener('click', () => this.resetImage());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
    }

    initSliders() {
        const sliders = ['brightness', 'contrast', 'saturation'];
        sliders.forEach(slider => {
            const element = document.getElementById(slider);
            const valueElement = document.getElementById(`${slider}Value`);
            
            element.addEventListener('input', (e) => {
                const value = e.target.value;
                valueElement.textContent = `${value}%`;
                if (this.currentImage) {
                    this.applyManualAdjustments();
                }
            });
        });
    }

    async initTensorFlow() {
        try {
            this.updateStatus('tfStatus', 'Loading...', 'loading');
            
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded');
            }
            
            await tf.ready();
            this.updateStatus('tfStatus', 'Ready', 'ready');
            
            // Load AI models with proper error handling
            this.loadModels();
            
        } catch (error) {
            console.error('TensorFlow initialization failed:', error);
            this.updateStatus('tfStatus', 'Error', 'error');
            this.showToast('TensorFlow.js failed to load. AI features will be limited.', 'warning');
        }
    }

    async loadModels() {
        // Load BodyPix model
        try {
            this.updateStatus('bodyPixStatus', 'Loading...', 'loading');
            if (typeof bodyPix !== 'undefined') {
                this.models.bodyPix = await bodyPix.load({
                    architecture: 'MobileNetV1',
                    outputStride: 16,
                    multiplier: 0.75,
                    quantBytes: 2
                });
                this.updateStatus('bodyPixStatus', 'Ready', 'ready');
                this.showToast('BodyPix model loaded successfully', 'success');
            } else {
                throw new Error('BodyPix not available');
            }
        } catch (error) {
            console.error('BodyPix loading failed:', error);
            this.updateStatus('bodyPixStatus', 'Error', 'error');
            this.showToast('BodyPix model failed to load', 'warning');
        }

        // Load BlazeFace model
        try {
            this.updateStatus('blazeFaceStatus', 'Loading...', 'loading');
            if (typeof blazeface !== 'undefined') {
                this.models.blazeFace = await blazeface.load();
                this.updateStatus('blazeFaceStatus', 'Ready', 'ready');
                this.showToast('BlazeFace model loaded successfully', 'success');
            } else {
                throw new Error('BlazeFace not available');
            }
        } catch (error) {
            console.error('BlazeFace loading failed:', error);
            this.updateStatus('blazeFaceStatus', 'Error', 'error');
            this.showToast('BlazeFace model failed to load', 'warning');
        }
    }

    updateStatus(elementId, text, status) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.className = `status status--${status}`;
        }
    }

    updateModelStatus() {
        const bgRemoveBtn = document.getElementById('bgRemove');
        const faceDetectBtn = document.getElementById('faceDetect');
        
        // Enable/disable buttons based on model availability and image presence
        if (bgRemoveBtn) {
            bgRemoveBtn.disabled = !this.models.bodyPix || !this.currentImage;
        }
        if (faceDetectBtn) {
            faceDetectBtn.disabled = !this.models.blazeFace || !this.currentImage;
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        this.handleFileSelect(e.dataTransfer.files);
    }

    async handleFileSelect(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        
        // Validate file
        if (!this.validateFile(file)) return;
        
        try {
            this.showLoading('Loading image...');
            await this.loadImage(file);
            this.hideLoading();
            this.showToast('Image loaded successfully!', 'success');
        } catch (error) {
            this.hideLoading();
            console.error('Image loading error:', error);
            this.showToast(`Failed to load image: ${error.message}`, 'error');
        }
    }

    validateFile(file) {
        if (!this.supportedFormats.includes(file.type)) {
            this.showToast('Unsupported file format. Please use JPG, PNG, WebP, or GIF.', 'error');
            return false;
        }
        
        if (file.size > this.maxFileSize) {
            this.showToast('File too large. Maximum size is 10MB.', 'error');
            return false;
        }
        
        return true;
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Clean up previous object URL
                    URL.revokeObjectURL(img.src);
                    
                    // Check dimensions and resize if necessary
                    let { width, height } = img;
                    const aspectRatio = width / height;
                    
                    if (width > this.maxDimensions.width) {
                        width = this.maxDimensions.width;
                        height = width / aspectRatio;
                    }
                    if (height > this.maxDimensions.height) {
                        height = this.maxDimensions.height;
                        width = height * aspectRatio;
                    }
                    
                    // Set canvas size
                    this.canvas.width = width;
                    this.canvas.height = height;
                    
                    // Clear and draw image
                    this.ctx.clearRect(0, 0, width, height);
                    this.ctx.drawImage(img, 0, 0, width, height);
                    
                    // Store original and current image data
                    this.originalImage = this.ctx.getImageData(0, 0, width, height);
                    this.currentImage = this.ctx.getImageData(0, 0, width, height);
                    
                    // Initialize history
                    this.history = [this.cloneImageData(this.originalImage)];
                    this.historyIndex = 0;
                    
                    // Update UI
                    this.updateCanvasInfo(file.name, file.size, width, height);
                    this.enableControls();
                    this.updateMemoryInfo();
                    this.updateModelStatus();
                    
                    resolve();
                } catch (error) {
                    reject(new Error('Failed to process image: ' + error.message));
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image file'));
            };
            
            // Create object URL for the image
            const imageUrl = URL.createObjectURL(file);
            img.src = imageUrl;
        });
    }

    updateCanvasInfo(filename, fileSize, width, height) {
        const sizeText = this.formatFileSize(fileSize);
        this.imageInfo.textContent = `${filename} - ${width}x${height} - ${sizeText}`;
        this.canvasInfo.style.display = 'flex';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateMemoryInfo() {
        if (typeof tf !== 'undefined') {
            try {
                const memInfo = tf.memory();
                this.memoryInfo.textContent = `Memory: ${memInfo.numTensors} tensors, ${this.formatFileSize(memInfo.numBytes)}`;
            } catch (error) {
                this.memoryInfo.textContent = 'Memory info unavailable';
            }
        }
    }

    enableControls() {
        // Enable controls when image is loaded
        const controls = [
            'brightness', 'contrast', 'saturation',
            'downloadImage', 'resetImage', 'undoBtn', 'redoBtn',
            'enhance', 'autoCrop'
        ];
        
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = false;
            }
        });
        
        // Enable filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.disabled = false;
        });
        
        this.updateHistoryButtons();
    }

    async removeBackground() {
        if (!this.models.bodyPix || this.isProcessing || !this.currentImage) {
            this.showToast('Background removal not available. Please ensure BodyPix model is loaded and an image is present.', 'warning');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.showLoading('Removing background...', 0);
            
            const segmentation = await this.models.bodyPix.segmentPerson(this.canvas);
            this.updateProgress(50);
            
            const imageData = this.cloneImageData(this.currentImage);
            const newImageData = this.ctx.createImageData(imageData.width, imageData.height);
            
            for (let i = 0; i < imageData.data.length; i += 4) {
                const pixelIndex = i / 4;
                if (segmentation.data[pixelIndex] === 1) {
                    // Keep person pixels
                    newImageData.data[i] = imageData.data[i];       // R
                    newImageData.data[i + 1] = imageData.data[i + 1]; // G
                    newImageData.data[i + 2] = imageData.data[i + 2]; // B
                    newImageData.data[i + 3] = imageData.data[i + 3]; // A
                } else {
                    // Make background transparent
                    newImageData.data[i] = 255;     // White background
                    newImageData.data[i + 1] = 255;
                    newImageData.data[i + 2] = 255;
                    newImageData.data[i + 3] = 255; // Opaque
                }
            }
            
            this.updateProgress(100);
            this.applyImageData(newImageData);
            this.showToast('Background removed successfully!', 'success');
            
        } catch (error) {
            console.error('Background removal failed:', error);
            this.showToast('Background removal failed. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
            this.updateMemoryInfo();
        }
    }

    async detectFaces() {
        if (!this.models.blazeFace || this.isProcessing || !this.currentImage) {
            this.showToast('Face detection not available. Please ensure BlazeFace model is loaded and an image is present.', 'warning');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.showLoading('Detecting faces...');
            
            const predictions = await this.models.blazeFace.estimateFaces(this.canvas, false);
            
            if (predictions.length > 0) {
                this.drawFaceBoxes(predictions);
                this.showToast(`Found ${predictions.length} face(s)!`, 'success');
            } else {
                this.showToast('No faces detected in the image.', 'info');
            }
            
        } catch (error) {
            console.error('Face detection failed:', error);
            this.showToast('Face detection failed. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
            this.updateMemoryInfo();
        }
    }

    drawFaceBoxes(predictions) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw current image
        tempCtx.putImageData(this.currentImage, 0, 0);
        
        // Draw face boxes
        tempCtx.strokeStyle = '#21808d';
        tempCtx.lineWidth = 3;
        tempCtx.fillStyle = 'rgba(33, 128, 141, 0.2)';
        
        predictions.forEach(prediction => {
            const topLeft = prediction.topLeft;
            const bottomRight = prediction.bottomRight;
            const width = bottomRight[0] - topLeft[0];
            const height = bottomRight[1] - topLeft[1];
            
            tempCtx.fillRect(topLeft[0], topLeft[1], width, height);
            tempCtx.strokeRect(topLeft[0], topLeft[1], width, height);
        });
        
        const newImageData = tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.applyImageData(newImageData);
    }

    enhanceImage() {
        if (this.isProcessing || !this.currentImage) {
            this.showToast('Please load an image first.', 'warning');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.showLoading('Enhancing image...');
            
            // Apply enhancement algorithm
            const imageData = this.cloneImageData(this.currentImage);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Auto-enhance: increase contrast and slightly boost saturation
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Increase contrast
                const contrast = 1.2;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                
                data[i] = Math.min(255, Math.max(0, factor * (r - 128) + 128));
                data[i + 1] = Math.min(255, Math.max(0, factor * (g - 128) + 128));
                data[i + 2] = Math.min(255, Math.max(0, factor * (b - 128) + 128));
            }
            
            this.applyImageData(imageData);
            this.showToast('Image enhanced successfully!', 'success');
            
        } catch (error) {
            console.error('Image enhancement failed:', error);
            this.showToast('Image enhancement failed. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    smartCrop() {
        if (this.isProcessing || !this.currentImage) {
            this.showToast('Please load an image first.', 'warning');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.showLoading('Smart cropping...');
            
            // Simple smart crop: crop to center with golden ratio
            const currentWidth = this.canvas.width;
            const currentHeight = this.canvas.height;
            const aspectRatio = 1.618; // Golden ratio
            
            let newWidth, newHeight;
            if (currentWidth / currentHeight > aspectRatio) {
                newHeight = currentHeight;
                newWidth = newHeight * aspectRatio;
            } else {
                newWidth = currentWidth;
                newHeight = newWidth / aspectRatio;
            }
            
            const x = (currentWidth - newWidth) / 2;
            const y = (currentHeight - newHeight) / 2;
            
            const croppedImageData = this.ctx.getImageData(x, y, newWidth, newHeight);
            
            // Resize canvas and apply cropped image
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.ctx.putImageData(croppedImageData, 0, 0);
            
            this.currentImage = this.ctx.getImageData(0, 0, newWidth, newHeight);
            this.addToHistory(this.cloneImageData(this.currentImage));
            
            this.showToast('Smart crop applied!', 'success');
            
        } catch (error) {
            console.error('Smart crop failed:', error);
            this.showToast('Smart crop failed. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    applyManualAdjustments() {
        if (!this.currentImage || this.isProcessing) return;
        
        const brightness = document.getElementById('brightness').value / 100;
        const contrast = document.getElementById('contrast').value / 100;
        const saturation = document.getElementById('saturation').value / 100;
        
        const imageData = this.cloneImageData(this.currentImage);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply brightness
            r = r * brightness;
            g = g * brightness;
            b = b * brightness;
            
            // Apply contrast
            const contrastFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;
            
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

    applyFilter(filterType) {
        if (!this.currentImage || this.isProcessing) {
            this.showToast('Please load an image first.', 'warning');
            return;
        }
        
        const imageData = this.cloneImageData(this.currentImage);
        const data = imageData.data;
        
        switch (filterType) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    data[i] = data[i + 1] = data[i + 2] = gray;
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
                
            case 'vintage':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.2);
                    data[i + 1] = Math.min(255, data[i + 1] * 1.1);
                    data[i + 2] = Math.min(255, data[i + 2] * 0.8);
                }
                break;
                
            case 'blur':
                // Simple box blur
                this.applyBoxBlur(imageData, 3);
                break;
                
            case 'sharpen':
                this.applySharpen(imageData);
                break;
                
            case 'negative':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                break;
        }
        
        this.applyImageData(imageData);
        this.showToast(`${filterType} filter applied!`, 'success');
        
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
    }

    applyBoxBlur(imageData, radius) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
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
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const original = new Uint8ClampedArray(data);
        
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0, g = 0, b = 0;
                
                for (let ky = 0; ky < 3; ky++) {
                    for (let kx = 0; kx < 3; kx++) {
                        const idx = ((y + ky - 1) * width + (x + kx - 1)) * 4;
                        const weight = kernel[ky * 3 + kx];
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

    applyImageData(imageData) {
        this.ctx.putImageData(imageData, 0, 0);
        this.currentImage = this.cloneImageData(imageData);
        this.addToHistory(this.cloneImageData(imageData));
    }

    addToHistory(imageData) {
        // Remove any history after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(imageData);
        this.historyIndex++;
        
        // Limit history size to prevent memory issues
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const imageData = this.history[this.historyIndex];
            this.ctx.putImageData(imageData, 0, 0);
            this.currentImage = this.cloneImageData(imageData);
            this.updateHistoryButtons();
            this.showToast('Undone', 'info');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const imageData = this.history[this.historyIndex];
            this.ctx.putImageData(imageData, 0, 0);
            this.currentImage = this.cloneImageData(imageData);
            this.updateHistoryButtons();
            this.showToast('Redone', 'info');
        }
    }

    resetImage() {
        if (this.originalImage) {
            this.ctx.putImageData(this.originalImage, 0, 0);
            this.currentImage = this.cloneImageData(this.originalImage);
            this.addToHistory(this.cloneImageData(this.originalImage));
            
            // Reset controls
            document.getElementById('brightness').value = 100;
            document.getElementById('contrast').value = 100;
            document.getElementById('saturation').value = 100;
            document.getElementById('brightnessValue').textContent = '100%';
            document.getElementById('contrastValue').textContent = '100%';
            document.getElementById('saturationValue').textContent = '100%';
            
            // Remove active filter states
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            
            this.showToast('Image reset to original', 'info');
        }
    }

    downloadImage() {
        if (!this.currentImage) {
            this.showToast('Please load an image first.', 'warning');
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.download = `edited-image-${Date.now()}.png`;
            link.href = this.canvas.toDataURL('image/png');
            link.click();
            
            this.showToast('Image downloaded successfully!', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.showToast('Download failed. Please try again.', 'error');
        }
    }

    cloneImageData(imageData) {
        const cloned = new ImageData(imageData.width, imageData.height);
        cloned.data.set(imageData.data);
        return cloned;
    }

    showLoading(text = 'Processing...', progress = 0) {
        if (this.loadingText) this.loadingText.textContent = text;
        if (this.progressFill) this.progressFill.style.width = `${progress}%`;
        if (this.loadingOverlay) this.loadingOverlay.style.display = 'block';
    }

    updateProgress(progress) {
        if (this.progressFill) this.progressFill.style.width = `${progress}%`;
    }

    hideLoading() {
        if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
        if (this.progressFill) this.progressFill.style.width = '0%';
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type} fade-in`;
        
        const header = document.createElement('div');
        header.className = 'toast-header';
        
        const title = document.createElement('div');
        title.className = 'toast-title';
        title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.removeToast(toast);
        
        const body = document.createElement('div');
        body.className = 'toast-body';
        body.textContent = message;
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        toast.appendChild(header);
        toast.appendChild(body);
        
        this.toastContainer.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => this.removeToast(toast), 5000);
    }

    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AIImageEditor();
});