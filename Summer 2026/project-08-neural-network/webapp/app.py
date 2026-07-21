"""
Flask web app — accepts a canvas drawing, runs it through the MNIST model, returns prediction.
"""

import os
import base64
import io
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory

# Import neuralnet from parent directory
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from neuralnet.layer import Layer
from neuralnet.network import NeuralNetwork

app = Flask(__name__, static_folder="static")

# ---- Load the trained MNIST model on startup ----
# I initialize the same architecture as in train_mnist.py then load saved weights
model = NeuralNetwork(
    layers=[
        Layer(784, 256, activation="relu"),
        Layer(256, 128, activation="relu"),
        Layer(128, 10,  activation="softmax"),
    ]
)

weights_path = os.path.join(os.path.dirname(__file__), "../weights/mnist_weights.npz")
if os.path.exists(weights_path):
    model.load(weights_path)
    print("Model weights loaded.")
else:
    print("WARNING: No saved weights found. Train the model first with train_mnist.py")


def preprocess_canvas(image_data_base64: str) -> np.ndarray:
    """
    Convert a base64-encoded PNG canvas image to the format the model expects:
    - 28x28 pixels
    - Grayscale
    - Normalized to [0, 1]
    - Flattened to shape (1, 784)

    The canvas draws white strokes on a black background (MNIST convention).
    """
    # Decode base64 PNG
    image_data = base64.b64decode(image_data_base64.split(",")[1])
    image = Image.open(io.BytesIO(image_data))

    # Convert to grayscale
    image = image.convert("L")
    arr = np.array(image, dtype=float)

    # Crop tightly around the drawn digit (find bounding box of non-black pixels)
    threshold = 30  # pixels brighter than this are considered part of the digit
    rows = np.any(arr > threshold, axis=1)
    cols = np.any(arr > threshold, axis=0)

    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        # Add padding around the bounding box (20% of the digit size)
        h, w = rmax - rmin, cmax - cmin
        pad = max(int(max(h, w) * 0.2), 4)
        rmin = max(rmin - pad, 0)
        rmax = min(rmax + pad, arr.shape[0] - 1)
        cmin = max(cmin - pad, 0)
        cmax = min(cmax + pad, arr.shape[1] - 1)

        arr = arr[rmin:rmax+1, cmin:cmax+1]

        # Make it square by padding the shorter side
        h, w = arr.shape
        if h != w:
            size = max(h, w)
            square = np.zeros((size, size), dtype=float)
            row_off = (size - h) // 2
            col_off = (size - w) // 2
            square[row_off:row_off+h, col_off:col_off+w] = arr
            arr = square

    # Resize to 28x28 and normalize to [0, 1]
    image = Image.fromarray(arr.astype(np.uint8))
    image = image.resize((28, 28), Image.LANCZOS)
    arr = np.array(image, dtype=float) / 255.0

    # Flatten to (1, 784)
    return arr.flatten().reshape(1, 784)


@app.route("/")
def index():
    """Serve the frontend HTML."""
    return send_from_directory("static", "index.html")


@app.route("/predict", methods=["POST"])
def predict():
    """
    POST /predict
    Body: { "image": "<base64 PNG data URL>" }
    Returns: { "digit": 3, "confidence": 0.987, "probabilities": [0.001, ..., 0.987, ...] }
    """
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    try:
        x = preprocess_canvas(data["image"])
        probabilities = model.forward(x)
        digit     = int(np.argmax(probabilities))
        confidence = float(probabilities[0, digit])

        return jsonify({
            "digit":         digit,
            "confidence":    round(confidence * 100, 1),
            "probabilities": [round(float(p) * 100, 2) for p in probabilities[0]],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
