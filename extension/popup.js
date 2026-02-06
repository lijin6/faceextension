// Chrome扩展popup.js - 真正的实时检测系统
let currentMode = 'image';
let cameraStream = null;
let videoFile = null;
let isRealTime = false;
let realTimeInterval = null;
let apiUrl = 'http://localhost:8000';
let currentDetection = null;
let lastFrameTime = 0;
let frameInterval = 1000; // 10秒一帧

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadApiUrl();
    
    // 模式切换
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;
            switchMode(mode);
        });
    });
    
    // 图片上传
    document.getElementById('imageInput').addEventListener('change', handleImageUpload);
    document.getElementById('analyzeImageBtn').addEventListener('click', analyzeImage);
    
    // 视频上传
    document.getElementById('videoInput').addEventListener('change', handleVideoUpload);
    document.getElementById('analyzeVideoBtn').addEventListener('click', analyzeVideo);
    document.getElementById('stopVideoBtn').addEventListener('click', stopVideoAnalysis);
    
    // 摄像头控制
    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('captureFrameBtn').addEventListener('click', captureAndAnalyzeFrame);
    
    // 实时检测
    document.getElementById('realTimeToggle').addEventListener('change', toggleRealTime);
    
    // API地址保存
    document.getElementById('apiUrl').addEventListener('change', saveApiUrl);
    
    // 初始化
    switchMode('image');
});

// ==================== 配置和模式切换 ====================
function loadApiUrl() {
    try {
        const savedUrl = localStorage.getItem('emotionDetector_apiUrl') || 'http://localhost:8000';
        apiUrl = savedUrl;
        document.getElementById('apiUrl').value = apiUrl;
    } catch (e) {
        console.log('使用默认API地址');
    }
}

function saveApiUrl() {
    apiUrl = document.getElementById('apiUrl').value.trim() || 'http://localhost:8000';
    document.getElementById('apiUrl').value = apiUrl;
    localStorage.setItem('emotionDetector_apiUrl', apiUrl);
}

function switchMode(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    document.querySelectorAll('.mode-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(`${mode}Section`).style.display = 'block';
    
    // 停止所有正在进行的操作
    stopAllDetections();
    clearAllOverlays();
    clearResults();
    
    showStatus('请选择文件或开启摄像头', 'info');
}

function stopAllDetections() {
    stopVideoAnalysis();
    stopRealTime();
    if (cameraStream && currentMode !== 'camera') {
        stopCamera();
    }
}

function clearAllOverlays() {
    // 清除所有覆盖层
    const overlays = document.querySelectorAll('.detection-overlay');
    overlays.forEach(overlay => overlay.remove());
    
    // 重置视频状态
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) {
        videoPreview.pause();
        videoPreview.currentTime = 0;
    }
}

// ==================== 画布绘制系统 ====================
// 创建或获取覆盖层
function getOrCreateOverlay(container, mediaElement, id) {
    let overlay = document.getElementById(id);
    
    if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.id = id;
        overlay.className = 'detection-overlay';
        
        // 设置覆盖层样式
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        
        // 设置容器样式
        container.style.position = 'relative';
        container.appendChild(overlay);
    }
    
    return overlay;
}

// 更新覆盖层尺寸
function updateOverlaySize(overlay, mediaElement) {
    if (!overlay || !mediaElement) return;
    
    const rect = mediaElement.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
}

// 绘制检测框
function drawFaceDetection(overlay, mediaElement, faces, originalWidth, originalHeight) {
    if (!overlay || !mediaElement || !faces) return;
    
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    // 更新覆盖层尺寸
    updateOverlaySize(overlay, mediaElement);
    
    // 获取显示尺寸
    const displayWidth = overlay.width;
    const displayHeight = overlay.height;
    
    // 清空画布
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // 如果没有检测到人脸，返回
    if (!Array.isArray(faces) || faces.length === 0) {
        return;
    }
    
    // 计算缩放比例
    const scaleX = displayWidth / originalWidth;
    const scaleY = displayHeight / originalHeight;
    
    console.log(`绘制人脸: 原始尺寸(${originalWidth}x${originalHeight}) -> 显示尺寸(${displayWidth}x${displayHeight})`);
    console.log(`缩放比例: scaleX=${scaleX}, scaleY=${scaleY}`);
    
    faces.forEach((face, index) => {
        if (face.box && Array.isArray(face.box) && face.box.length === 4) {
            const [x, y, width, height] = face.box;
            
            // 缩放坐标
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;
            
            console.log(`人脸${index + 1}: 原始(${x},${y},${width},${height}) -> 缩放(${scaledX},${scaledY},${scaledWidth},${scaledHeight})`);
            
            // 绘制人脸框
            ctx.strokeStyle = '#FF5252';
            ctx.lineWidth = 3;
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            
            // 获取情绪信息
            const emotion = face.emotion || 'unknown';
            const score = face.score ? Math.round(face.score * 100) : 0;
            
            // 绘制情绪标签
            drawEmotionLabel(ctx, scaledX, scaledY, scaledWidth, emotion, score);
        }
    });
}

// 绘制情绪标签
function drawEmotionLabel(ctx, x, y, width, emotion, score) {
    const labelText = `${emotion} ${score}%`;
    ctx.font = 'bold 16px Arial';
    const textWidth = ctx.measureText(labelText).width;
    const labelHeight = 30;
    const labelWidth = Math.max(width, textWidth + 20);
    
    // 标签背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight);
    
    // 情绪文本
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(labelText, x + 10, y - 10);
    
    // 表情图标
    const emoji = getEmotionEmoji(emotion);
    if (emoji) {
        ctx.font = '20px Arial';
        ctx.fillText(emoji, x + labelWidth - 25, y - labelHeight + 20);
    }
}

// 获取情绪表情符号
function getEmotionEmoji(emotion) {
    const emojis = {
        'happy': '😊', 'happiness': '😊',
        'sad': '😢', 'sadness': '😢',
        'anger': '😠', 'angry': '😠',
        'disgust': '🤢',
        'fear': '😨',
        'surprise': '😲', 'surprised': '😲',
        'neutral': '😐'
    };
    return emojis[emotion.toLowerCase()] || '😀';
}

// ==================== 图片检测功能 ====================
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        preview.onload = function() {
            document.getElementById('analyzeImageBtn').disabled = false;
            showStatus('图片已加载', 'info');
        };
    };
    reader.readAsDataURL(file);
}

async function analyzeImage() {
    const fileInput = document.getElementById('imageInput');
    if (!fileInput.files.length) {
        showStatus('请先选择图片', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('input_type', 'image');
    
    showStatus('正在分析图片...', 'info');
    document.getElementById('analyzeImageBtn').disabled = true;
    
    try {
        const response = await fetch(`${apiUrl}/detect`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('图片分析结果:', result);
        currentDetection = result;
        
        // 绘制检测结果
        drawImageDetection(result);
        
        // 显示分析结果
        displayResults(result);
        
        showStatus('图片分析完成', 'success');
    } catch (error) {
        console.error('分析失败:', error);
        showStatus(`分析失败: ${error.message}`, 'error');
    } finally {
        document.getElementById('analyzeImageBtn').disabled = false;
    }
}

function drawImageDetection(data) {
    const preview = document.getElementById('preview');
    const container = preview.parentElement;
    
    // 等待图片加载
    if (!preview.complete) {
        preview.onload = () => drawImageDetection(data);
        return;
    }
    
    // 创建覆盖层
    const overlay = getOrCreateOverlay(container, preview, 'imageOverlay');
    
    // 获取图片原始尺寸
    const imgWidth = preview.naturalWidth || preview.width;
    const imgHeight = preview.naturalHeight || preview.height;
    
    // 绘制人脸框
    if (data.results && data.results.length > 0) {
        const faces = data.results[0].faces || [];
        drawFaceDetection(overlay, preview, faces, imgWidth, imgHeight);
    }
}

// ==================== 视频实时检测功能 ====================
function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    videoFile = file;
    const videoPreview = document.getElementById('videoPreview');
    const videoUrl = URL.createObjectURL(file);
    
    // 重置视频
    videoPreview.src = '';
    videoPreview.src = videoUrl;
    videoPreview.style.display = 'block';
    
    // 等待视频加载
    videoPreview.addEventListener('loadedmetadata', function() {
        const duration = Math.round(videoPreview.duration);
        document.getElementById('videoDuration').textContent = duration;
        
        document.getElementById('videoInfo').style.display = 'flex';
        document.getElementById('videoProgressBar').style.display = 'block';
        document.getElementById('analyzeVideoBtn').disabled = false;
        
        showStatus(`视频已加载 (${duration}秒)`, 'info');
    });
}

function analyzeVideo() {
    if (!videoFile) {
        showStatus('请先选择视频文件', 'error');
        return;
    }
    
    const videoPreview = document.getElementById('videoPreview');
    const container = videoPreview.parentElement;
    
    // 创建覆盖层
    const overlay = getOrCreateOverlay(container, videoPreview, 'videoOverlay');
    
    // 开始播放视频
    videoPreview.currentTime = 0;
    videoPreview.play();
    
    showStatus('开始视频实时检测...', 'info');
    document.getElementById('analyzeVideoBtn').disabled = true;
    document.getElementById('stopVideoBtn').disabled = false;
    
    // 开始实时检测循环
    startVideoRealTimeDetection(videoPreview, overlay);
}

// 视频实时检测循环
function startVideoRealTimeDetection(videoPreview, overlay) {
    let isAnalyzing = false;
    
    // 设置检测间隔
    const detectionInterval = setInterval(async () => {
        if (videoPreview.paused || videoPreview.ended) {
            return;
        }
        
        // 防止重复检测
        if (isAnalyzing) return;
        isAnalyzing = true;
        
        try {
            // 捕获当前视频帧
            const canvas = document.createElement('canvas');
            canvas.width = videoPreview.videoWidth;
            canvas.height = videoPreview.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
            
            // 转换为Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.7);
            });
            
            // 发送检测请求
            const formData = new FormData();
            formData.append('file', blob, 'video_frame.jpg');
            formData.append('input_type', 'image');
            
            const response = await fetch(`${apiUrl}/detect`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('视频实时检测结果:', result);
                
                // 绘制检测框
                if (result.results && result.results.length > 0) {
                    const faces = result.results[0].faces || [];
                    drawFaceDetection(overlay, videoPreview, faces, 
                                     videoPreview.videoWidth, videoPreview.videoHeight);
                    
                    // 更新显示结果
                    displayVideoResult(result, videoPreview.currentTime);
                }
            }
        } catch (error) {
            console.error('视频检测错误:', error);
        } finally {
            isAnalyzing = false;
        }
    }, frameInterval); // 每10秒检测一次
    
    // 保存interval以便停止
    window.videoDetectionInterval = detectionInterval;
    
    // 监听视频进度
    videoPreview.addEventListener('timeupdate', function() {
        const progressPercent = (videoPreview.currentTime / videoPreview.duration) * 100;
        document.getElementById('videoProgressFill').style.width = `${progressPercent}%`;
    });
}

function displayVideoResult(result, currentTime) {
    const container = document.getElementById('resultsContainer');
    let html = '';
    
    if (result.results && result.results.length > 0) {
        const faces = result.results[0].faces || [];
        
        html += `<div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <strong>⏰ ${formatTime(currentTime)} | 检测到 ${faces.length} 个人脸</strong>
        </div>`;
        
        faces.forEach((face, index) => {
            const emotion = face.emotion || '未知';
            const score = face.score ? (face.score * 100).toFixed(1) : '0';
            const emoji = getEmotionEmoji(emotion);
            
            html += `<div style="margin: 5px 0; padding: 10px; background: white; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">${emoji}</span>
                    <div style="flex: 1;">
                        <strong>${emotion}</strong>
                        <div style="font-size: 12px; color: #666;">置信度</div>
                    </div>
                    <strong style="font-size: 18px;">${score}%</strong>
                </div>
            </div>`;
        });
    } else {
        html = '<div style="padding: 10px; text-align: center; color: #666;">当前帧无检测结果</div>';
    }
    
    container.innerHTML = html;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function stopVideoAnalysis() {
    // 停止检测循环
    if (window.videoDetectionInterval) {
        clearInterval(window.videoDetectionInterval);
        window.videoDetectionInterval = null;
    }
    
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) videoPreview.pause();
    
    document.getElementById('analyzeVideoBtn').disabled = false;
    document.getElementById('stopVideoBtn').disabled = true;
    
    // 清除覆盖层
    const overlay = document.getElementById('videoOverlay');
    if (overlay) overlay.remove();
    
    showStatus('视频检测已停止', 'info');
}

// ==================== 摄像头实时检测功能 ====================
async function startCamera() {
    try {
        const cameraPreview = document.getElementById('cameraPreview');

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        cameraPreview.srcObject = cameraStream;
        cameraPreview.muted = true;
        cameraPreview.playsInline = true;
        cameraPreview.style.display = 'block';

        // 🔥 关键：popup 中必须手动 play
        await cameraPreview.play();

        cameraPreview.onloadedmetadata = () => {
            const container = cameraPreview.parentElement;
            getOrCreateOverlay(container, cameraPreview, 'cameraOverlay');

            document.getElementById('startCameraBtn').disabled = true;
            document.getElementById('stopCameraBtn').disabled = false;
            document.getElementById('captureFrameBtn').disabled = false;
            document.getElementById('realTimeToggle').disabled = false;

            showStatus('摄像头已开启', 'success');
        };

    } catch (error) {
        console.error('摄像头错误 name:', error.name);
        console.error('摄像头错误 message:', error.message);
        console.error('摄像头错误:', error);
        showStatus(`摄像头错误: ${error.name}`, 'error');
    }
}


function stopCamera() {
    stopRealTime();
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    const cameraPreview = document.getElementById('cameraPreview');
    if (cameraPreview) {
        cameraPreview.srcObject = null;
        cameraPreview.style.display = 'none';
    }
    
    // 清除覆盖层
    const overlay = document.getElementById('cameraOverlay');
    if (overlay) overlay.remove();
    
    document.getElementById('startCameraBtn').disabled = false;
    document.getElementById('stopCameraBtn').disabled = true;
    document.getElementById('captureFrameBtn').disabled = true;
    document.getElementById('realTimeToggle').disabled = true;
    document.getElementById('realTimeToggle').checked = false;
    
    showStatus('摄像头已关闭', 'info');
}

// 单帧分析
async function captureAndAnalyzeFrame() {
    if (!cameraStream) {
        showStatus('请先开启摄像头', 'error');
        return;
    }
    
    const video = document.getElementById('cameraPreview');
    const container = video.parentElement;
    
    if (!video.videoWidth || !video.videoHeight) {
        showStatus('摄像头未准备好', 'error');
        return;
    }
    
    showStatus('正在分析...', 'info');
    document.getElementById('captureFrameBtn').disabled = true;
    
    try {
        // 捕获当前帧
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 转换为Blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.8);
        });
        
        // 发送分析请求
        const formData = new FormData();
        formData.append('file', blob, 'camera_frame.jpg');
        formData.append('input_type', 'image');
        
        const response = await fetch(`${apiUrl}/detect`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('摄像头分析结果:', result);
        
        // 创建或获取覆盖层
        const overlay = getOrCreateOverlay(container, video, 'cameraOverlay');
        
        // 绘制检测框
        if (result.results && result.results.length > 0) {
            const faces = result.results[0].faces || [];
            drawFaceDetection(overlay, video, faces, video.videoWidth, video.videoHeight);
        }
        
        // 显示结果
        displayResults(result);
        
        showStatus('分析完成', 'success');
    } catch (error) {
        console.error('分析失败:', error);
        showStatus(`分析失败: ${error.message}`, 'error');
    } finally {
        document.getElementById('captureFrameBtn').disabled = false;
    }
}

// ==================== 摄像头实时检测 ====================
function toggleRealTime(event) {
    isRealTime = event.target.checked;
    
    if (isRealTime) {
        startCameraRealTimeDetection();
    } else {
        stopRealTime();
    }
}

function startCameraRealTimeDetection() {
    const cameraPreview = document.getElementById('cameraPreview');
    const container = cameraPreview.parentElement;
    
    // 创建覆盖层
    const overlay = getOrCreateOverlay(container, cameraPreview, 'cameraOverlay');
    
    showStatus('开始实时检测...', 'info');
    
    // 每隔10秒检测一次
    realTimeInterval = setInterval(async () => {
        if (!cameraStream) {
            stopRealTime();
            return;
        }
        
        const video = document.getElementById('cameraPreview');
        
        if (!video.videoWidth || !video.videoHeight) return;
        
        try {
            // 捕获当前帧
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 转换为Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.7);
            });
            
            // 发送检测请求
            const formData = new FormData();
            formData.append('file', blob, 'realtime_frame.jpg');
            formData.append('input_type', 'image');
            
            const response = await fetch(`${apiUrl}/detect`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('实时检测结果:', result);
                
                // 绘制检测框
                if (result.results && result.results.length > 0) {
                    const faces = result.results[0].faces || [];
                    drawFaceDetection(overlay, video, faces, video.videoWidth, video.videoHeight);
                    
                    // 显示结果
                    displayRealTimeResults(result);
                }
            }
        } catch (error) {
            console.error('实时检测错误:', error);
        }
    }, frameInterval);
    
    document.getElementById('captureFrameBtn').disabled = true;
}

function stopRealTime() {
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
        realTimeInterval = null;
    }
    
    document.getElementById('captureFrameBtn').disabled = false;
    document.getElementById('realTimeToggle').checked = false;
    
    showStatus('实时检测已停止', 'info');
}

function displayRealTimeResults(result) {
    const container = document.getElementById('resultsContainer');
    let html = '';
    
    if (result.results && result.results.length > 0) {
        const faces = result.results[0].faces || [];
        
        html += `<div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <strong>⏰ ${new Date().toLocaleTimeString()} | 检测到 ${faces.length} 个人脸</strong>
        </div>`;
        
        faces.forEach((face, index) => {
            const emotion = face.emotion || '未知';
            const score = face.score ? (face.score * 100).toFixed(1) : '0';
            const emoji = getEmotionEmoji(emotion);
            
            html += `<div style="margin: 5px 0; padding: 10px; background: white; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">${emoji}</span>
                    <div style="flex: 1;">
                        <strong>${emotion}</strong>
                        <div style="font-size: 12px; color: #666;">置信度</div>
                    </div>
                    <strong style="font-size: 18px;">${score}%</strong>
                </div>
            </div>`;
        });
    } else {
        html = '<div style="padding: 10px; text-align: center; color: #666;">未检测到人脸</div>';
    }
    
    container.innerHTML = html;
}

// ==================== 通用显示功能 ====================
function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    
    if (!data || !data.results || data.results.length === 0) {
        container.innerHTML = `<div style="padding: 15px; text-align: center; color: #666;">
            无检测结果
        </div>`;
        return;
    }
    
    const latestResult = data.results[data.results.length - 1];
    let html = '';
    
    if (latestResult.faces && latestResult.faces.length > 0) {
        latestResult.faces.forEach((face, index) => {
            const emotion = face.emotion || '未知';
            const score = face.score ? (face.score * 100).toFixed(1) : '0';
            const emoji = getEmotionEmoji(emotion);
            
            html += `<div style="margin: 10px 0; padding: 15px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="font-size: 24px; margin-right: 10px;">${emoji}</div>
                    <div style="font-weight: bold; font-size: 16px; color: #333;">人脸 ${index + 1}</div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin: 10px 0;">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 12px; height: 12px; background-color: #4CAF50; border-radius: 50%; margin-right: 8px;"></div>
                        <div>
                            <strong style="font-size: 14px;">${emotion}</strong>
                            <div style="font-size: 12px; color: #888;">置信度</div>
                        </div>
                    </div>
                    <div style="font-weight: bold; color: #4CAF50; font-size: 18px;">
                        ${score}%
                    </div>
                </div>
            </div>`;
        });
    } else {
        html = '<div style="padding: 15px; text-align: center; color: #666;">未检测到人脸</div>';
    }
    
    container.innerHTML = html;
}

function clearResults() {
    document.getElementById('resultsContainer').innerHTML = 
        '<div style="text-align: center; color: #999; padding: 30px;">检测结果将显示在这里</div>';
}

function showStatus(message, type) {
    const status = document.getElementById('statusMessage');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        if (status.textContent === message) {
            status.style.display = 'none';
        }
    }, type === 'error' ? 8000 : 5000);
}