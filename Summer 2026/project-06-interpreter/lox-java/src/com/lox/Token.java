package com.lox;

// A token is a single meaningful unit of source code
// After scanning, the interpreter never looks at raw characters again — just tokens
// The line number is stored so we can give good error messages

public class Token {
    final TokenType type;
    final String lexeme;   // the raw substring from source (">=", "myVariable", "42.0", etc.)
    final Object literal;  // the parsed value for STRING and NUMBER tokens (null for others)
    final int line;        // which line this token is on (for error reporting)

    public Token(TokenType type, String lexeme, Object literal, int line) {
        this.type = type;
        this.lexeme = lexeme;
        this.literal = literal;
        this.line = line;
    }

    @Override
    public String toString() {
        return type + " " + lexeme + " " + literal;
    }
}
