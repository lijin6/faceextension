import cv2
import numpy as np
from keras.models import load_model
from utils.datasets import get_labels
from utils.inference import detect_faces, apply_offsets, load_detection_model
from utils.preprocessor import preprocess_input

DETECTION_MODEL_PATH = "./trained_models/detection_models/haarcascade_frontalface_default.xml"
EMOTION_MODEL_PATH = "./trained_models/emotion_models/fer2013_mini_XCEPTION.102-0.66.hdf5"

face_detection = load_detection_model(DETECTION_MODEL_PATH)
emotion_classifier = load_model(EMOTION_MODEL_PATH, compile=False)
emotion_labels = get_labels("fer2013")
emotion_target_size = emotion_classifier.input_shape[1:3]
emotion_offsets = (0, 0)

def predict_emotion_frame(image_bgr: np.ndarray):
    """单帧图像推理"""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(face_detection, gray)
    results = []

    for (x, y, w, h) in faces:
        x1, x2, y1, y2 = apply_offsets((x, y, w, h), emotion_offsets)
        gray_face = gray[y1:y2, x1:x2]

        if gray_face.size == 0:
            continue

        gray_face = cv2.resize(gray_face, emotion_target_size)
        gray_face = preprocess_input(gray_face, True)
        gray_face = np.expand_dims(gray_face, 0)
        gray_face = np.expand_dims(gray_face, -1)

        preds = emotion_classifier.predict(gray_face, verbose=0)
        emotion = emotion_labels[int(np.argmax(preds))]
        score = float(np.max(preds))

        results.append({"box": [int(x), int(y), int(w), int(h)], "emotion": emotion, "score": score})
    return results

def predict_emotion_video(video_path: str):
    """视频文件推理，返回每帧结果"""
    import os
    import tempfile

    cap = cv2.VideoCapture(video_path)
    frame_index = 0
    output = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        faces = predict_emotion_frame(frame)
        output.append({"frame_index": frame_index, "faces": faces})
        frame_index += 1

    cap.release()
    return output
