"""
Train a neural network on MNIST (handwritten digits, 0-9).
Target: >97% test accuracy.

Architecture: 784 -> 256 (ReLU) -> 128 (ReLU) -> 10 (softmax)
This follows the plan exactly.

Run: python train_mnist.py
"""

import numpy as np
import matplotlib.pyplot as plt
from mnist import MNIST  # pip install python-mnist

from neuralnet.layer import Layer
from neuralnet.network import NeuralNetwork


def load_mnist():
    """Load and preprocess MNIST data."""
    mndata = MNIST("./data/mnist")
    X_train, y_train = mndata.load_training()
    X_test,  y_test  = mndata.load_testing()

    # Convert to numpy arrays
    X_train = np.array(X_train, dtype=float)
    X_test  = np.array(X_test,  dtype=float)
    y_train = np.array(y_train)
    y_test  = np.array(y_test)

    # Normalize pixel values from [0, 255] to [0, 1]
    # This makes gradient descent work much better — without normalization, the gradients
    # for the first layer would be ~255x larger than necessary
    X_train /= 255.0
    X_test  /= 255.0

    # One-hot encode labels
    # Label 3 becomes [0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
    def one_hot(labels, num_classes=10):
        result = np.zeros((len(labels), num_classes))
        result[np.arange(len(labels)), labels] = 1.0
        return result

    y_train_oh = one_hot(y_train)
    y_test_oh  = one_hot(y_test)

    print(f"Training: {X_train.shape[0]} samples, Test: {X_test.shape[0]} samples")
    return X_train, y_train_oh, X_test, y_test_oh, y_test


def main():
    np.random.seed(42)  # for reproducibility

    X_train, y_train, X_test, y_test, y_test_labels = load_mnist()

    # Build the network
    # 784 input features (28x28 pixels flattened)
    net = NeuralNetwork(
        layers=[
            Layer(784, 256, activation="relu"),
            Layer(256, 128, activation="relu"),
            Layer(128, 10,  activation="softmax"),
        ],
        learning_rate=0.01,
    )

    print("Training on MNIST...")
    net.train(
        X_train, y_train,
        epochs=20,
        batch_size=32,
        X_val=X_test, y_val=y_test,
        lr_decay=0.9,  # decay learning rate by 10% every 5 epochs
    )

    # Final evaluation
    test_acc = net.evaluate(X_test, y_test)
    print(f"\nFinal test accuracy: {test_acc * 100:.2f}%")

    # Save weights
    net.save("weights/mnist_weights")

    # Plot training curves
    epochs = range(1, len(net.train_loss_history) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    ax1.plot(epochs, net.train_loss_history, label="Train loss")
    ax1.plot(epochs, net.val_loss_history,   label="Val loss")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.set_title("Training and Validation Loss")
    ax1.legend()

    ax2.plot(epochs, [a * 100 for a in net.train_acc_history], label="Train acc")
    ax2.plot(epochs, [a * 100 for a in net.val_acc_history],   label="Val acc")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy (%)")
    ax2.set_title("Training and Validation Accuracy")
    ax2.legend()

    plt.tight_layout()
    plt.savefig("plots/mnist_training_curves.png", dpi=150)
    print("Saved training curves to plots/mnist_training_curves.png")

    # Show 10 sample predictions
    print("\nSample predictions:")
    indices = np.random.choice(len(X_test), 10, replace=False)
    for i, idx in enumerate(indices):
        pred_class, confidence = net.predict(X_test[idx:idx+1])
        true_class = y_test_labels[idx]
        correct = "✓" if pred_class == true_class else "✗"
        print(f"  [{correct}] True: {true_class}, Predicted: {pred_class} ({confidence*100:.1f}%)")


if __name__ == "__main__":
    import os
    os.makedirs("weights", exist_ok=True)
    os.makedirs("plots",   exist_ok=True)
    os.makedirs("data/mnist", exist_ok=True)
    main()
