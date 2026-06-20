package com.lox;

import java.util.HashMap;
import java.util.Map;

// Environment stores variables and implements lexical scoping
// Each block/function creates a new Environment with a pointer to its enclosing scope
// Variable lookup walks up the chain until it finds the variable or hits the top

// This is where closures work: a LoxFunction holds a reference to the Environment
// that was active when it was defined, so captured variables stay alive

public class Environment {
    final Environment enclosing; // the outer scope (null for global)
    private final Map<String, Object> values = new HashMap<>();

    // Global scope — no enclosing
    public Environment() {
        enclosing = null;
    }

    // Local scope — always has an enclosing
    public Environment(Environment enclosing) {
        this.enclosing = enclosing;
    }

    // Look up a variable by name, walking up the scope chain if not found here
    public Object get(Token name) {
        if (values.containsKey(name.lexeme)) {
            return values.get(name.lexeme);
        }

        // Recurse up the chain to the enclosing scope
        if (enclosing != null) return enclosing.get(name);

        // Not found anywhere — this is a runtime error
        throw new RuntimeError(name, "Undefined variable '" + name.lexeme + "'.");
    }

    // Define a new variable in the current scope
    // Note: this is different from assign — define always creates in the current scope
    public void define(String name, Object value) {
        values.put(name, value);
    }

    // Assign to an existing variable — must walk up the chain to find it
    public void assign(Token name, Object value) {
        if (values.containsKey(name.lexeme)) {
            values.put(name.lexeme, value);
            return;
        }

        if (enclosing != null) {
            enclosing.assign(name, value);
            return;
        }

        throw new RuntimeError(name, "Undefined variable '" + name.lexeme + "'.");
    }

    // The Resolver pre-computes how many "hops" up the scope chain to find each variable
    // These methods let the interpreter use that pre-computed information for fast lookup

    public Object getAt(int distance, String name) {
        return ancestor(distance).values.get(name);
    }

    public void assignAt(int distance, Token name, Object value) {
        ancestor(distance).values.put(name.lexeme, value);
    }

    // Walk exactly `distance` scopes up the chain
    private Environment ancestor(int distance) {
        Environment environment = this;
        for (int i = 0; i < distance; i++) {
            environment = environment.enclosing;
        }
        return environment;
    }
}
