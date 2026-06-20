package com.lox;

import java.util.HashMap;
import java.util.Map;

// A runtime instance of a Lox class — basically just a map of field names to values
// Methods are looked up on the class, not stored per-instance (they're shared)

public class LoxInstance {
    private LoxClass klass;
    private final Map<String, Object> fields = new HashMap<>();

    public LoxInstance(LoxClass klass) {
        this.klass = klass;
    }

    // Property access: instance.name — checks fields first, then methods
    public Object get(Token name) {
        if (fields.containsKey(name.lexeme)) {
            return fields.get(name.lexeme);
        }

        // Methods are bound to this instance so "this" works inside them
        LoxFunction method = klass.findMethod(name.lexeme);
        if (method != null) return method.bind(this);

        throw new RuntimeError(name, "Undefined property '" + name.lexeme + "'.");
    }

    // Property assignment: instance.name = value
    public void set(Token name, Object value) {
        fields.put(name.lexeme, value);
    }

    @Override
    public String toString() {
        return klass.name + " instance";
    }
}
