#pragma once
#include <functional>
#include <stdexcept>
#include <string>

// ─────────────────────────────────────────────────────────────────────────────
// Manual FIFO Queue  (singly-linked list)
// ─────────────────────────────────────────────────────────────────────────────
template<typename T>
class Queue {
public:
    struct Node {
        T      data;
        Node*  next;
        explicit Node(const T& d) : data(d), next(nullptr) {}
    };

private:
    Node* _front;
    Node* _rear;
    int   _size;

public:
    Queue()  : _front(nullptr), _rear(nullptr), _size(0) {}

    ~Queue() { clear(); }

    // Non-copyable, movable
    Queue(const Queue&)            = delete;
    Queue& operator=(const Queue&) = delete;

    Queue(Queue&& o) noexcept
        : _front(o._front), _rear(o._rear), _size(o._size) {
        o._front = o._rear = nullptr;
        o._size = 0;
    }

    void enqueue(const T& item) {
        Node* node = new Node(item);
        if (_rear) _rear->next = node;
        else       _front = node;
        _rear = node;
        ++_size;
    }

    T dequeue() {
        if (isEmpty()) throw std::runtime_error("Queue underflow");
        Node* tmp  = _front;
        T     data = tmp->data;
        _front     = _front->next;
        if (!_front) _rear = nullptr;
        delete tmp;
        --_size;
        return data;
    }

    const T& peek() const {
        if (isEmpty()) throw std::runtime_error("Queue is empty");
        return _front->data;
    }

    T& peekMutable() {
        if (isEmpty()) throw std::runtime_error("Queue is empty");
        return _front->data;
    }

    bool isEmpty() const { return _size == 0; }
    int  size()    const { return _size; }

    const Node* head() const { return _front; }
    Node*       head()       { return _front; }

    void clear() {
        while (_front) {
            Node* tmp = _front;
            _front    = _front->next;
            delete tmp;
        }
        _rear  = nullptr;
        _size  = 0;
    }

    // Apply a function to every element (read-only traversal)
    template<typename Fn>
    void forEach(Fn fn) const {
        for (const Node* n = _front; n; n = n->next)
            fn(n->data);
    }

    // Mutable traversal
    template<typename Fn>
    void forEachMut(Fn fn) {
        for (Node* n = _front; n; n = n->next)
            fn(n->data);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Manual Priority Queue  (sorted singly-linked list)
//
//   comparator(a, b) == true  →  a has HIGHER priority than b
//                                (a appears earlier in the list)
//
// Insertion is O(n); suitable for airport-scale queues (dozens of planes).
// Ties preserve insertion order (stable).
// ─────────────────────────────────────────────────────────────────────────────
template<typename T>
class PriorityQueue {
public:
    struct Node {
        T      data;
        Node*  next;
        explicit Node(const T& d) : data(d), next(nullptr) {}
    };

private:
    Node* _head;
    int   _size;
    std::function<bool(const T&, const T&)> _cmp;

public:
    explicit PriorityQueue(std::function<bool(const T&, const T&)> cmp)
        : _head(nullptr), _size(0), _cmp(std::move(cmp)) {}

    ~PriorityQueue() { clear(); }

    PriorityQueue(const PriorityQueue&)            = delete;
    PriorityQueue& operator=(const PriorityQueue&) = delete;

    void enqueue(const T& item) {
        Node* node = new Node(item);

        // Insert before the first element with strictly lower priority
        if (!_head || _cmp(item, _head->data)) {
            node->next = _head;
            _head      = node;
        } else {
            Node* cur = _head;
            // Advance while cur->next has >= priority (stable: don't jump over equals)
            while (cur->next && !_cmp(item, cur->next->data))
                cur = cur->next;
            node->next = cur->next;
            cur->next  = node;
        }
        ++_size;
    }

    T dequeue() {
        if (isEmpty()) throw std::runtime_error("Priority queue underflow");
        Node* tmp  = _head;
        T     data = tmp->data;
        _head      = _head->next;
        delete tmp;
        --_size;
        return data;
    }

    const T& peek() const {
        if (isEmpty()) throw std::runtime_error("Priority queue is empty");
        return _head->data;
    }

    bool isEmpty() const { return _size == 0; }
    int  size()    const { return _size; }

    const Node* head() const { return _head; }
    Node*       head()       { return _head; }

    void clear() {
        while (_head) {
            Node* tmp = _head;
            _head     = _head->next;
            delete tmp;
        }
        _size = 0;
    }

    template<typename Fn>
    void forEach(Fn fn) const {
        for (const Node* n = _head; n; n = n->next)
            fn(n->data);
    }

    template<typename Fn>
    void forEachMut(Fn fn) {
        for (Node* n = _head; n; n = n->next)
            fn(n->data);
    }
};
