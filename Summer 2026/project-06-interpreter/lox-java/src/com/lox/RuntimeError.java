package com.lox;

// Runtime error — thrown when the interpreter encounters something like dividing by zero
// I extend RuntimeException so I can throw it without Java's checked exception boilerplate
// The token is stored so I can report the exact location of the error

public class RuntimeError extends RuntimeException {
    final Token token;

    public RuntimeError(Token token, String message) {
        super(message);
        this.token = token;
    }
}
