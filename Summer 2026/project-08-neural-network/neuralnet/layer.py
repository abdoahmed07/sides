"""
A single fully-connected (dense) layer.

A layer has weights W (shape: input_size x output_size) and biases b (shape: 1 x output_size).
Forward pass: Z = X @ W + b, then A = activation(Z)
Backward pass: compute gradients dW, db, and dA_prev (to pass to the previous layer)
"""

import numpy as np
from .activations import relu, relu_derivative, sigmoid, sigmoid_derivative, softmax


class Layer:
    def __init__(self, input_size: int, output_size: int, activation: str = "relu"):
        """
        Initialize weights using He initialization for ReLU, Xavier for others.
        Good weight initialization is crucial — bad init leads to vanishing/exploding gradients.

        He init: W ~ N(0, sqrt(2/input_size)) — designed for ReLU layers
        Xavier init: W ~ N(0, sqrt(1/input_size)) — designed for sigmoid/tanh layers
        """
        self.input_size  = input_size
        self.output_size = output_size
        self.activation  = activation

        if activation == "relu":
            # He initialization
            self.W = np.random.randn(input_size, output_size) * np.sqrt(2.0 / input_size)
        else:
            # Xavier initialization
            self.W = np.random.randn(input_size, output_size) * np.sqrt(1.0 / input_size)

        self.b = np.zeros((1, output_size))

        # Cache for backprop — I store the pre-activation Z and input X from the forward pass
        # so I can compute gradients without recomputing them
        self._cache_X = None
        self._cache_Z = None

    def forward(self, X: np.ndarray) -> np.ndarray:
        """
        Forward pass: Z = X @ W + b, A = activation(Z)

        X shape: (batch_size, input_size)
        Returns A shape: (batch_size, output_size)
        """
        self._cache_X = X
        Z = X @ self.W + self.b
        self._cache_Z = Z

        if self.activation == "relu":
            return relu(Z)
        elif self.activation == "sigmoid":
            return sigmoid(Z)
        elif self.activation == "softmax":
            return softmax(Z)
        else:
            raise ValueError(f"Unknown activation: {self.activation}")

    def backward(self, dA: np.ndarray) -> np.ndarray:
        """
        Backward pass — compute gradients.

        dA: gradient of the loss with respect to this layer's OUTPUT
            shape: (batch_size, output_size)

        Returns: gradient with respect to this layer's INPUT
                 shape: (batch_size, input_size) — passed to the previous layer

        Chain rule:
            dZ = dA * activation'(Z)     (element-wise)
            dW = X.T @ dZ / batch_size   (averaged over the batch)
            db = sum(dZ) / batch_size
            dX = dZ @ W.T               (for the previous layer)
        """
        batch_size = self._cache_X.shape[0]

        if self.activation == "relu":
            dZ = dA * relu_derivative(self._cache_Z)
        elif self.activation == "sigmoid":
            dZ = dA * sigmoid_derivative(self._cache_Z)
        elif self.activation == "softmax":
            # For softmax + cross-entropy, dA is already (predictions - labels) / batch_size
            # (computed in the loss function). So we just pass it through.
            dZ = dA
        else:
            raise ValueError(f"Unknown activation: {self.activation}")

        # Gradients — I average over the batch to make the learning rate batch-size independent
        self.dW = self._cache_X.T @ dZ / batch_size
        self.db = np.sum(dZ, axis=0, keepdims=True) / batch_size

        # Gradient for the previous layer
        dX = dZ @ self.W.T
        return dX
