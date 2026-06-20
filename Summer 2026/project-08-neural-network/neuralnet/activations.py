"""
Activation functions and their derivatives.

I derived each derivative on paper before implementing it.
The derivative is needed for backpropagation — it tells us how much
a small change in the layer's output affects the loss.
"""

import numpy as np


def relu(z):
    """ReLU — max(0, z). Simple and effective for hidden layers."""
    return np.maximum(0, z)


def relu_derivative(z):
    """Derivative of ReLU: 1 where z > 0, 0 elsewhere.
    I compute this from the pre-activation z, not the post-activation output."""
    return (z > 0).astype(float)


def sigmoid(z):
    """Sigmoid — squashes any value to (0, 1). Useful for binary classification."""
    # Clip z to prevent overflow in exp for very negative values
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))


def sigmoid_derivative(z):
    """Derivative of sigmoid: sigma(z) * (1 - sigma(z))"""
    s = sigmoid(z)
    return s * (1 - s)


def softmax(z):
    """Softmax — converts a vector of raw scores to a probability distribution.
    The output sums to 1, which makes it great for multi-class classification.

    I subtract the max before exponentiating to prevent numerical overflow.
    This is a standard trick — the math works out the same but avoids inf values.
    """
    # z shape: (batch_size, num_classes)
    # Keep dims for broadcasting
    shifted = z - np.max(z, axis=1, keepdims=True)
    exp_z = np.exp(shifted)
    return exp_z / np.sum(exp_z, axis=1, keepdims=True)


# Note: I don't implement a standalone softmax_derivative because in practice,
# the softmax derivative is always combined with cross-entropy loss in backprop.
# The combined gradient simplifies to (predictions - true_labels) / batch_size,
# which is much cleaner. See loss.py for the explanation.
