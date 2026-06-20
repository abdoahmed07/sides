# Neural Network from Scratch

A feedforward neural network implemented using only Python and NumPy — no PyTorch, no TensorFlow, no Keras.

**Live demo:** [your-app.railway.app](https://your-app.railway.app) — draw a digit and see it classified in real time.

## Results

| Dataset | Accuracy |
|---------|---------|
| MNIST (handwritten digits) | **97.8%** |
| Fashion-MNIST (clothing items) | **89.2%** |

## Running it

```bash
pip install numpy matplotlib pillow flask python-mnist

# Download MNIST data
python -c "from mnist import MNIST; MNIST('./data/mnist').load_training()"

# Train on MNIST (~5 minutes)
python train_mnist.py

# Run the web interface
cd webapp && python app.py
# Open http://localhost:5000
```

## Architecture

```
Input (784) → Dense 256 ReLU → Dense 128 ReLU → Output 10 Softmax
```

| File | Description |
|------|-------------|
| `neuralnet/layer.py` | Fully-connected layer with forward/backward passes |
| `neuralnet/activations.py` | ReLU, sigmoid, softmax and their derivatives |
| `neuralnet/loss.py` | Categorical cross-entropy + gradient |
| `neuralnet/network.py` | Assembles layers, runs training loop with mini-batch SGD |
| `train_mnist.py` | Training script for MNIST |
| `train_fashion.py` | Training script for Fashion-MNIST |
| `webapp/app.py` | Flask backend: accepts canvas image, returns prediction |
| `webapp/static/index.html` | Frontend: canvas drawing + probability display |

## How backpropagation actually works (plain language)

A neural network is a function with millions of parameters (weights). Training means finding
parameter values that minimize the loss (error) on the training data.

**Forward pass:** Input flows through each layer, producing an output (the prediction).

**Loss:** We measure how wrong the prediction is. For multi-class classification, I use
categorical cross-entropy: `-sum(true_label * log(predicted_prob))`.

**Backward pass (backpropagation):** To minimize the loss, we need to know how much each
weight contributes to the error. The chain rule from calculus lets us compute this.

Starting from the output layer and working backwards:
- At the output layer, the gradient of `cross_entropy(softmax(z))` simplifies to
  `predictions - true_labels` (I derived this by hand — it's a beautiful simplification).
- At each hidden layer, we multiply the incoming gradient by the layer's activation derivative
  to get the gradient for that layer's weights.
- We then use these gradients to update the weights: `W = W - lr * dL/dW`.

**Why mini-batches:** Processing one sample at a time (`batch_size=1`) gives noisy gradient
estimates. Processing the full dataset at once is accurate but slow. Mini-batches (32-256
samples) are a sweet spot that's fast and has enough variance to escape local minima.

**Why weight initialization matters:** If all weights start at zero, every neuron in a layer
computes the same output and receives the same gradient — the network can't differentiate
between neurons. I use He initialization (`W ~ N(0, sqrt(2/n))`) which is designed for ReLU
layers and keeps gradient magnitudes stable during early training.
