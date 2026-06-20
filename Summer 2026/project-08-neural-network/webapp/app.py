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

    # Convert to grayscale and resize to 28x28
    image = image.convert("L")
    image = image.resize((28, 28), Image.LANCZOS)

    # Convert to numpy array and normalize
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
