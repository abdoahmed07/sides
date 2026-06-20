package com.lox;

import java.util.List;

// A first-class Lox function — stores its declaration AST node and the closure environment
// The closure captures the scope where the function was defined, not where it's called.
// That's how closures work: makeCounter() returns a function that "remembers" count.

public class LoxFunction implements LoxCallable {
    private final Stmt.Function declaration;
    private final Environment closure;     // the scope where this function was defined
    private final boolean isInitializer;   // init() needs special return handling

    public LoxFunction(Stmt.Function declaration, Environment closure, boolean isInitializer) {
        this.declaration = declaration;
        this.closure = closure;
        this.isInitializer = isInitializer;
    }

    // bind() creates a new function with "this" added to its closure — used for methods
    public LoxFunction bind(LoxInstance instance) {
        Environment environment = new Environment(closure);
        environment.define("this", instance);
        return new LoxFunction(declaration, environment, isInitializer);
    }

    @Override
    public int arity() {
        return declaration.params.size();
    }

    @Override
    public Object call(Interpreter interpreter, List<Object> arguments) {
        // Each function call gets its own environment — that's how local variables work
        Environment environment = new Environment(closure);
        for (int i = 0; i < declaration.params.size(); i++) {
            environment.define(declaration.params.get(i).lexeme, arguments.get(i));
        }

        try {
            interpreter.executeBlock(declaration.body, environment);
        } catch (Return returnValue) {
            // init() always returns "this" even if there's an explicit return
            if (isInitializer) return closure.getAt(0, "this");
            return returnValue.value;
        }

        if (isInitializer) return closure.getAt(0, "this");
        return null;
    }

    @Override
    public String toString() {
        return "<fn " + declaration.name.lexeme + ">";
    }
}
