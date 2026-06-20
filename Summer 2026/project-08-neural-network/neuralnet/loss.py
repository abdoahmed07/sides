"""
Loss functions.

I'm using categorical cross-entropy, which is the standard for multi-class classification.
The key insight: when combined with softmax, the gradient simplifies beautifully.
"""

import numpy as np


def cross_entropy_loss(predictions: np.ndarray, labels: np.ndarray) -> float:
    """
    Categorical cross-entropy: -sum(labels * log(predictions)) / batch_size

    predictions: softmax output, shape (batch_size, num_classes)
    labels:      one-hot encoded, shape (batch_size, num_classes)

    I clip predictions to avoid log(0) which would give -inf.
    """
    eps = 1e-15
    predictions = np.clip(predictions, eps, 1 - eps)
    loss = -np.sum(labels * np.log(predictions)) / predictions.shape[0]
    return float(loss)


def cross_entropy_gradient(predictions: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """
    Gradient of cross-entropy loss combined with softmax output.

    The gradient of cross-entropy(softmax(z)) with respect to z simplifies to:
        dL/dz = predictions - labels
    (divided by batch_size for the mean)

    I derived this by hand in my notebook. The full derivation:
    - dL/d(softmax_k) = -labels_k / predictions_k
    - d(softmax_k)/d(z_j) = softmax_k * (delta_kj - softmax_j)
    - Combining these (summing over k): dL/dz_j = predictions_j - labels_j

    This is why softmax + cross-entropy is so common — the gradient is clean and simple.
    """
    return (predictions - labels) / predictions.shape[0]
