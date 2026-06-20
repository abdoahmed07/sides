"""
The neural network — assembles layers, runs forward/backward passes, updates weights.
"""

import numpy as np
from typing import List, Tuple, Optional
from .layer import Layer
from .loss import cross_entropy_loss, cross_entropy_gradient


class NeuralNetwork:
    def __init__(self, layers: List[Layer], learning_rate: float = 0.01):
        """
        layers:        list of Layer objects (input → ... → output)
        learning_rate: step size for SGD updates
        """
        self.layers = layers
        self.lr = learning_rate

        # Track loss and accuracy history for plotting
        self.train_loss_history: List[float] = []
        self.train_acc_history:  List[float] = []
        self.val_loss_history:   List[float] = []
        self.val_acc_history:    List[float] = []

    def forward(self, X: np.ndarray) -> np.ndarray:
        """Run input through all layers in sequence."""
        output = X
        for layer in self.layers:
            output = layer.forward(output)
        return output

    def backward(self, predictions: np.ndarray, labels: np.ndarray) -> None:
        """
        Run backpropagation through all layers in reverse.
        The gradient flows from the output layer back to the input layer.
        Each layer updates its own dW and db, which SGD uses to update W and b.
        """
        # Start with the gradient from the loss function
        grad = cross_entropy_gradient(predictions, labels)

        # Propagate gradient backwards through each layer
        for layer in reversed(self.layers):
            grad = layer.backward(grad)

    def _sgd_update(self) -> None:
        """Stochastic Gradient Descent weight update."""
        for layer in self.layers:
            layer.W -= self.lr * layer.dW
            layer.b -= self.lr * layer.db

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,  # one-hot encoded
        epochs: int = 20,
        batch_size: int = 32,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        lr_decay: float = 1.0,  # multiply lr by this every 5 epochs
    ) -> None:
        """
        Train the network with mini-batch SGD.

        Mini-batches are better than pure stochastic (batch_size=1) because:
        - Vectorized NumPy operations are much faster on batches
        - The gradient estimate is less noisy than a single sample
        - But we still get the generalization benefits of stochasticity vs full-batch

        I shuffle the training data every epoch to prevent the network from
        memorizing the order of samples.
        """
        n_samples = X_train.shape[0]

        for epoch in range(1, epochs + 1):
            # Shuffle training data at the start of each epoch
            perm = np.random.permutation(n_samples)
            X_shuffled = X_train[perm]
            y_shuffled = y_train[perm]

            epoch_loss = 0.0
            n_batches = 0

            # Mini-batch loop
            for start in range(0, n_samples, batch_size):
                X_batch = X_shuffled[start:start + batch_size]
                y_batch = y_shuffled[start:start + batch_size]

                predictions = self.forward(X_batch)
                loss = cross_entropy_loss(predictions, y_batch)
                self.backward(predictions, y_batch)
                self._sgd_update()

                epoch_loss += loss
                n_batches  += 1

            # Record training metrics
            avg_loss = epoch_loss / n_batches
            train_acc = self.evaluate(X_train, y_train)
            self.train_loss_history.append(avg_loss)
            self.train_acc_history.append(train_acc)

            # Learning rate decay every 5 epochs
            if epoch % 5 == 0 and lr_decay < 1.0:
                self.lr *= lr_decay
                print(f"  Learning rate decayed to {self.lr:.6f}")

            # Validation metrics
            val_str = ""
            if X_val is not None and y_val is not None:
                val_preds = self.forward(X_val)
                val_loss  = cross_entropy_loss(val_preds, y_val)
                val_acc   = self.evaluate(X_val, y_val)
                self.val_loss_history.append(val_loss)
                self.val_acc_history.append(val_acc)
                val_str = f"  val_loss: {val_loss:.4f}  val_acc: {val_acc:.4f}"

            print(f"Epoch {epoch:3d}/{epochs}  loss: {avg_loss:.4f}  acc: {train_acc:.4f}{val_str}")

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> float:
        """Accuracy: fraction of correctly classified samples."""
        predictions = self.forward(X)
        predicted_labels = np.argmax(predictions, axis=1)
        true_labels      = np.argmax(y, axis=1)
        return float(np.mean(predicted_labels == true_labels))

    def predict(self, X: np.ndarray) -> Tuple[int, float]:
        """Predict the class and confidence for a single sample."""
        probs = self.forward(X)
        class_idx  = int(np.argmax(probs))
        confidence = float(probs[0, class_idx])
        return class_idx, confidence

    def save(self, path: str) -> None:
        """Save weights to a .npz file."""
        data = {}
        for i, layer in enumerate(self.layers):
            data[f"W{i}"] = layer.W
            data[f"b{i}"] = layer.b
        np.savez(path, **data)
        print(f"Weights saved to {path}.npz")

    def load(self, path: str) -> None:
        """Load weights from a .npz file."""
        data = np.load(path)
        for i, layer in enumerate(self.layers):
            layer.W = data[f"W{i}"]
            layer.b = data[f"b{i}"]
