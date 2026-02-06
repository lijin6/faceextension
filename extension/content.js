// content.js - 在网页中注入功能
console.log('情感识别内容脚本已加载');

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);
    
    if (request.action === 'injectOverlay') {
        injectCanvasOverlay();
        sendResponse({status: 'success'});
    } else if (request.action === 'clearOverlay') {
        clearCanvasOverlay();
        sendResponse({status: 'success'});
    } else if (request.action === 'updateFaces') {
        updateFaceOverlay(request.data);
        sendResponse({status: 'success'});
    }
    
    return true;
});

// 全局变量
let overlayCanvas = null;
let ctx = null;
let currentFaces = [];

// 注入画布覆盖层
function injectCanvasOverlay() {
    // 如果已经存在，先清除
    clearCanvasOverlay();
    
    // 创建canvas元素
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'emotion-detection-overlay';
    overlayCanvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: 999999;
        pointer-events: none;
        background: transparent;
    `;
    
    // 设置canvas大小
    overlayCanvas.width = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
    
    // 获取上下文
    ctx = overlayCanvas.getContext('2d');
    
    // 添加到页面
    document.body.appendChild(overlayCanvas);
    
    // 监听窗口大小变化
    window.addEventListener('resize', resizeCanvas);
}

// 清除覆盖层
function clearCanvasOverlay() {
    if (overlayCanvas && overlayCanvas.parentNode) {
        overlayCanvas.parentNode.removeChild(overlayCanvas);
    }
    overlayCanvas = null;
    ctx = null;
    currentFaces = [];
}

// 更新人脸检测结果
function updateFaceOverlay(facesData) {
    if (!overlayCanvas || !ctx) return;
    
    currentFaces = facesData;
    drawFaces();
}

// 绘制人脸框和情绪
function drawFaces() {
    if (!ctx) return;
    
    // 清空画布
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    currentFaces.forEach(face => {
        // 获取人脸位置
        let x, y, width, height;
        
        if (Array.isArray(face)) {
            // 数组格式 [x, y, width, height]
            x = face[0];
            y = face[1];
            width = face[2];
            height = face[3];
        } else if (face.box && Array.isArray(face.box)) {
            // 对象包含box数组
            x = face.box[0];
            y = face.box[1];
            width = face.box[2];
            height = face.box[3];
        } else if (face.x !== undefined) {
            // 对象直接包含坐标
            x = face.x;
            y = face.y;
            width = face.width || 0;
            height = face.height || 0;
        } else {
            return; // 无法识别格式
        }
        
        // 绘制人脸框
        ctx.strokeStyle = '#FF5252';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // 绘制标签背景
        const labelHeight = 20;
        ctx.fillStyle = 'rgba(255, 82, 82, 0.8)';
        ctx.fillRect(x, y - labelHeight, width, labelHeight);
        
        // 绘制情绪文本
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        
        let emotionText = '人脸';
        if (face.emotions) {
            // 找出最大概率的情绪
            const emotions = face.emotions;
            const maxEmotion = Object.entries(emotions)
                .reduce((max, [emotion, confidence]) => 
                    confidence > max.confidence ? {emotion, confidence} : max, 
                    {emotion: '', confidence: 0});
            
            if (maxEmotion.emotion) {
                const percent = (maxEmotion.confidence * 100).toFixed(0);
                emotionText = `${maxEmotion.emotion} ${percent}%`;
            }
        } else if (face.emotion) {
            emotionText = face.emotion;
        }
        
        ctx.fillText(emotionText, x + 5, y - 5);
        
        // 绘制情绪详情（可选）
        if (face.emotions && Object.keys(face.emotions).length > 1) {
            drawEmotionDetails(x, y + height, width, face.emotions);
        }
    });
}

// 绘制情绪详情
function drawEmotionDetails(x, y, width, emotions) {
    const detailHeight = 80;
    const detailWidth = Math.min(width, 200);
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, detailWidth, detailHeight);
    
    // 标题
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText('情绪分布:', x + 5, y + 15);
    
    // 绘制情绪条
    const sortedEmotions = Object.entries(emotions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // 只显示前5个
    
    sortedEmotions.forEach(([emotion, confidence], index) => {
        const percent = (confidence * 100).toFixed(1);
        const barY = y + 25 + (index * 10);
        const barWidth = (percent / 100) * (detailWidth - 60);
        
        // 情绪名称
        ctx.fillStyle = 'white';
        ctx.fillText(emotion.slice(0, 10), x + 5, barY + 8);
        
        // 百分比
        ctx.fillText(`${percent}%`, x + detailWidth - 25, barY + 8);
        
        // 进度条背景
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 55, barY + 3, detailWidth - 60, 6);
        
        // 进度条前景
        const color = getEmotionColor(emotion);
        ctx.fillStyle = color;
        ctx.fillRect(x + 55, barY + 3, barWidth, 6);
    });
}

// 获取情绪颜色
function getEmotionColor(emotion) {
    const colors = {
        'anger': '#ff5252',
        'disgust': '#8bc34a',
        'fear': '#ff9800',
        'happy': '#4caf50',
        'sad': '#2196f3',
        'surprise': '#9c27b0',
        'neutral': '#757575',
        'angry': '#ff5252',
        'disgusted': '#8bc34a',
        'fearful': '#ff9800',
        'happy': '#4caf50',
        'sad': '#2196f3',
        'surprised': '#9c27b0',
        'neutral': '#757575'
    };
    
    return colors[emotion.toLowerCase()] || '#4a6ee0';
}

// 调整画布大小
function resizeCanvas() {
    if (overlayCanvas) {
        overlayCanvas.width = window.innerWidth;
        overlayCanvas.height = window.innerHeight;
        drawFaces(); // 重新绘制
    }
}

// 页面加载时自动注入（可选）
window.addEventListener('load', () => {
    setTimeout(() => {
        // 自动寻找页面中的图片和视频
        findAndMonitorMedia();
    }, 1000);
});

// 查找并监控媒体元素
function findAndMonitorMedia() {
    // 查找图片
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.width > 100 && img.height > 100) {
            // 可能包含人脸的大图片
            console.log('找到大图片:', img.src);
        }
    });
    
    // 查找视频
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        console.log('找到视频:', video);
    });
}