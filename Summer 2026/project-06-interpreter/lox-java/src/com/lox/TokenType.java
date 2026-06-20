package com.lox;

// Every possible token type in the Lox language
// The scanner converts raw source text into a stream of these
// I read through the grammar in chapter 2 before writing any of this

public enum TokenType {
    // Single-character tokens
    LEFT_PAREN, RIGHT_PAREN, LEFT_BRACE, RIGHT_BRACE,
    COMMA, DOT, MINUS, PLUS, SEMICOLON, SLASH, STAR,

    // One or two character tokens
    BANG, BANG_EQUAL,       // ! and !=
    EQUAL, EQUAL_EQUAL,     // = and ==
    GREATER, GREATER_EQUAL, // > and >=
    LESS, LESS_EQUAL,       // < and <=

    // Literals — these carry a value alongside the type
    IDENTIFIER, STRING, NUMBER,

    // Keywords — reserved words in the language
    AND, CLASS, ELSE, FALSE, FUN, FOR, IF, NIL, OR,
    PRINT, RETURN, SUPER, THIS, TRUE, VAR, WHILE,

    // End of file
    EOF
}
