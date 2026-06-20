package com.lox;

// Return is implemented as a Java exception — this is the cleanest way to unwind
// the call stack when a return statement is hit anywhere in a function body.
// I use RuntimeException (unchecked) to avoid adding throws declarations everywhere.

class Return extends RuntimeException {
    final Object value;

    Return(Object value) {
        super(null, null, false, false); // disable stack trace — we just need the value
        this.value = value;
    }
}
