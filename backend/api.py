import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import tempfile
import time
from emotion_service import predict_emotion_frame, predict_emotion_video

app = FastAPI()

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段用 *
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- 全局变量控制摄像头间隔处理 ----------
last_processed_time = 0
PROCESS_INTERVAL = 0.5  # 秒，每隔 0.5 秒处理一次摄像头帧

# ---------- 健康检查 ----------
@app.get("/")
def health_check():
    return {"status": "ok"}

# ---------- 检测接口 ----------
@app.post("/detect")
async def detect(file: UploadFile = File(...), input_type: str = Form(...)):
    """
    input_type: 'image', 'video', 'camera'
    """
    global last_processed_time

    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)

    # ---------------- 图片 ----------------
    if input_type == "image":
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": "Invalid image"}
        faces = predict_emotion_frame(img)
        return {"frame_count": 1, "results": [{"frame_index":0, "faces": faces}]}

    # ---------------- 视频 ----------------
    elif input_type == "video":
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp_file.write(contents)
        tmp_file.close()
        output = predict_emotion_video(tmp_file.name)
        os.remove(tmp_file.name)
        return {"frame_count": len(output), "results": output}

    # ---------------- 摄像头单帧 ----------------
    elif input_type == "camera":
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": "Invalid frame"}

        now = time.time()
        if now - last_processed_time < PROCESS_INTERVAL:
            # 不处理太频繁的帧，返回空结果
            return {"frame_count": 1, "results": [{"frame_index": 0, "faces": []}]}
        last_processed_time = now

        faces = predict_emotion_frame(img)
        return {"frame_count": 1, "results": [{"frame_index":0, "faces": faces}]}

    else:
        return {"error": "Invalid input_type. Use 'image', 'video', or 'camera'."}
