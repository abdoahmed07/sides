package com.lox;

import java.util.List;

// Anything in Lox that can be called with () implements this interface
// That means functions AND classes (calling a class creates an instance)

public interface LoxCallable {
    int arity();                                      // how many arguments it expects
    Object call(Interpreter interpreter, List<Object> arguments);
}
