# Emotion AI Detector - Chrome Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome Extension](https://img.shields.io/badge/chrome_extension-✓-brightgreen)

A Chrome extension for real-time facial emotion detection using AI, supporting image, video, and camera analysis.

## 🌟 Features

### 🖼️ **Image Detection**
- Support for JPG, PNG image formats
- Automatic face detection in images
- Real-time face bounding boxes and emotion labels
- Emotion confidence percentage display

### 🎬 **Video Real-time Detection**
- Support for MP4, WebM video formats
- Real-time detection during video playback
- Adjustable detection frequency (1-30 seconds)
- Real-time progress and statistics display

### 📹 **Camera Real-time Detection**
- Access to computer camera for live detection
- Support for single-frame and continuous detection modes
- Adjustable detection intervals
- Real-time results and statistics display

### ⚙️ **Configuration Options**
- Customizable backend API address
- Adjustable detection frequency
- Configurable confidence threshold
- Automatic settings save

## 📁 Project Structure

```
emotion-detector-extension/
├── manifest.json              # Extension configuration
├── popup.html                # Main extension interface
├── popup.css                 # Stylesheet
├── popup.js                  # Main logic code
├── icons/                    # Extension icons (optional)
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md                 # This file
```

## 🚀 Installation Guide

### Prerequisites
1. **Chrome Browser** (version 88+)
2. **Backend API Service** (FastAPI service running at http://localhost:8000)

### Installation Steps

1. **Clone or Download the Project**
   ```bash
   git clone <repository-url>
   cd emotion-detector-extension
   ```

2. **Prepare Icon Files** (Optional)
   - Place icon files in the `icons` folder
   - Or modify `manifest.json` to remove icon references

3. **Load into Chrome**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the project folder

4. **Start Backend Service**
   - Ensure your FastAPI backend is running
   - Default address: `http://localhost:8000`

## 🔧 Configuration

### API Server Configuration
The extension connects to `http://localhost:8000` by default. If your backend is elsewhere:
1. Click the extension icon to open the interface
2. Modify the API address in the settings section
3. Click "Save Settings"

### Detection Parameters
- **Detection Interval**: 1-30 seconds, controls detection frequency
- **Confidence Threshold**: 50%-100%, filters low-confidence results

### Supported Detection Modes
| Mode | Description | Recommended Interval |
|------|-------------|---------------------|
| Image Mode | Single image analysis | N/A |
| Video Mode | Video real-time detection | 3-10 seconds |
| Camera Mode | Camera live detection | 3-5 seconds |

## 📖 How to Use

### Image Detection
1. Click the extension icon
2. Select "Image" mode
3. Click "Choose Image File" or drag and drop
4. Click "Analyze Image"
5. View detection results and bounding boxes

### Video Detection
1. Select "Video" mode
2. Upload a video file
3. Click "Real-time Detection"
4. The video will play with real-time detection overlays
5. Use controls to pause/stop

### Camera Detection
1. Select "Camera" mode
2. Click "Start Camera"
3. Choose detection mode:
   - **Single Frame**: Click "Capture & Analyze"
   - **Real-time**: Toggle "Real-time Detection"
4. Results update automatically based on interval

## ⚙️ Settings

### Detection Settings
- **Detection Interval**: How often to perform detection (1-30 seconds)
- **Confidence Threshold**: Minimum confidence to display results (50-100%)

### API Settings
- **Server Address**: URL of your FastAPI backend
- **Auto-save**: Settings are automatically saved locally

## 🔧 Development

### File Structure Overview

- `manifest.json`: Chrome extension configuration
- `popup.html`: Main user interface
- `popup.css`: Styling and layout
- `popup.js`: Core functionality and API integration

### Key Functions

1. **Image Analysis**: Sends image data to backend, draws detection results
2. **Video Processing**: Extracts frames, sends for analysis, overlays results
3. **Camera Access**: Captures video stream, periodic frame analysis
4. **Results Display**: Visualizes emotions, confidence, and bounding boxes

### API Integration

The extension expects the backend API to have the following endpoint:
```
POST /detect
Parameters:
  - file: Image/Video file
  - input_type: "image", "video", or "camera"
Response:
  {
    "frame_count": 1,
    "results": [
      {
        "frame_index": 0,
        "faces": [
          {
            "box": [x, y, width, height],
            "emotion": "happy",
            "score": 0.85
          }
        ]
      }
    ]
  }
```

## 🐛 Troubleshooting

### Common Issues

1. **Extension won't load**
   - Check `manifest.json` syntax
   - Ensure all required files exist
   - Reload extension after changes

2. **No detection results**
   - Verify backend API is running
   - Check API address in settings
   - Ensure images contain clear faces

3. **Camera not working**
   - Check camera permissions in Chrome
   - Ensure no other app is using the camera
   - Try restarting Chrome

4. **Video detection slow**
   - Reduce detection frequency
   - Use smaller video files
   - Check network connection to backend

### Debugging Tips

1. Open Chrome Developer Tools (F12)
2. Check Console for error messages
3. Monitor Network tab for API requests
4. Check Application > Storage for settings

## 🔒 Privacy & Security

- **Local Processing**: All detection occurs locally via your backend
- **No Data Collection**: The extension doesn't collect or send personal data
- **Permissions**: Only requires camera access and local storage
- **Open Source**: Full transparency of code functionality

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

For support, please:
1. Check the Troubleshooting section
2. Open an issue on GitHub
3. Provide detailed information about your problem

## 📊 Future Enhancements

Planned features:
- Multiple face tracking
- Emotion trend analysis
- Export detection results
- Batch image processing
- Custom emotion models

---

**Note**: This extension requires a compatible backend API service for emotion detection functionality.