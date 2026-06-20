package com.lox;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// The Scanner (lexer) converts raw source text into a list of tokens
// It's a single pass through the source string, character by character
// I found this easier to understand than I expected — it's mostly a big switch statement

public class Scanner {
    private final String source;
    private final List<Token> tokens = new ArrayList<>();

    private int start   = 0; // start of the current lexeme being scanned
    private int current = 0; // current position in the source
    private int line    = 1; // current line (for error reporting)

    // Reserved keywords — anything that matches one of these is a keyword, not an identifier
    private static final Map<String, TokenType> keywords;
    static {
        keywords = new HashMap<>();
        keywords.put("and",    TokenType.AND);
        keywords.put("class",  TokenType.CLASS);
        keywords.put("else",   TokenType.ELSE);
        keywords.put("false",  TokenType.FALSE);
        keywords.put("for",    TokenType.FOR);
        keywords.put("fun",    TokenType.FUN);
        keywords.put("if",     TokenType.IF);
        keywords.put("nil",    TokenType.NIL);
        keywords.put("or",     TokenType.OR);
        keywords.put("print",  TokenType.PRINT);
        keywords.put("return", TokenType.RETURN);
        keywords.put("super",  TokenType.SUPER);
        keywords.put("this",   TokenType.THIS);
        keywords.put("true",   TokenType.TRUE);
        keywords.put("var",    TokenType.VAR);
        keywords.put("while",  TokenType.WHILE);
    }

    public Scanner(String source) {
        this.source = source;
    }

    public List<Token> scanTokens() {
        while (!isAtEnd()) {
            // We're at the beginning of the next lexeme
            start = current;
            scanToken();
        }

        tokens.add(new Token(TokenType.EOF, "", null, line));
        return tokens;
    }

    private void scanToken() {
        char c = advance();
        switch (c) {
            // Single character tokens — straightforward
            case '(': addToken(TokenType.LEFT_PAREN);  break;
            case ')': addToken(TokenType.RIGHT_PAREN); break;
            case '{': addToken(TokenType.LEFT_BRACE);  break;
            case '}': addToken(TokenType.RIGHT_BRACE); break;
            case ',': addToken(TokenType.COMMA);       break;
            case '.': addToken(TokenType.DOT);         break;
            case '-': addToken(TokenType.MINUS);       break;
            case '+': addToken(TokenType.PLUS);        break;
            case ';': addToken(TokenType.SEMICOLON);   break;
            case '*': addToken(TokenType.STAR);        break;

            // One or two character tokens — check the next char to decide
            case '!': addToken(match('=') ? TokenType.BANG_EQUAL    : TokenType.BANG);    break;
            case '=': addToken(match('=') ? TokenType.EQUAL_EQUAL   : TokenType.EQUAL);   break;
            case '<': addToken(match('=') ? TokenType.LESS_EQUAL    : TokenType.LESS);    break;
            case '>': addToken(match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER); break;

            // Comments start with // and go to end of line — I just consume and ignore them
            case '/':
                if (match('/')) {
                    while (peek() != '\n' && !isAtEnd()) advance();
                } else {
                    addToken(TokenType.SLASH);
                }
                break;

            // Ignore whitespace
            case ' ': case '\r': case '\t': break;
            case '\n': line++; break;

            // String literals — delimited by double quotes
            case '"': string(); break;

            default:
                if (isDigit(c)) {
                    number();
                } else if (isAlpha(c)) {
                    identifier();
                } else {
                    Lox.error(line, "Unexpected character.");
                }
                break;
        }
    }

    // Scan a string literal — reads until the closing "
    private void string() {
        while (peek() != '"' && !isAtEnd()) {
            if (peek() == '\n') line++;
            advance();
        }

        if (isAtEnd()) {
            Lox.error(line, "Unterminated string.");
            return;
        }

        advance(); // consume the closing "

        // Trim the surrounding quotes to get the actual string value
        String value = source.substring(start + 1, current - 1);
        addToken(TokenType.STRING, value);
    }

    // Scan a number literal — integers and decimals (e.g., 123, 45.67)
    private void number() {
        while (isDigit(peek())) advance();

        // Look for a decimal part
        if (peek() == '.' && isDigit(peekNext())) {
            advance(); // consume the '.'
            while (isDigit(peek())) advance();
        }

        addToken(TokenType.NUMBER, Double.parseDouble(source.substring(start, current)));
    }

    // Scan an identifier or keyword
    private void identifier() {
        while (isAlphaNumeric(peek())) advance();

        String text = source.substring(start, current);
        // If it's a known keyword, use that token type; otherwise it's a user identifier
        TokenType type = keywords.getOrDefault(text, TokenType.IDENTIFIER);
        addToken(type);
    }

    // Conditional advance — consume the next character only if it matches expected
    private boolean match(char expected) {
        if (isAtEnd()) return false;
        if (source.charAt(current) != expected) return false;
        current++;
        return true;
    }

    // Look at the current character without consuming it
    private char peek() {
        if (isAtEnd()) return '\0';
        return source.charAt(current);
    }

    // Look two characters ahead (used for detecting ".5" in numbers)
    private char peekNext() {
        if (current + 1 >= source.length()) return '\0';
        return source.charAt(current + 1);
    }

    private char advance() { return source.charAt(current++); }
    private boolean isAtEnd() { return current >= source.length(); }
    private boolean isDigit(char c) { return c >= '0' && c <= '9'; }
    private boolean isAlpha(char c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_'; }
    private boolean isAlphaNumeric(char c) { return isAlpha(c) || isDigit(c); }

    private void addToken(TokenType type) { addToken(type, null); }
    private void addToken(TokenType type, Object literal) {
        String text = source.substring(start, current);
        tokens.add(new Token(type, text, literal, line));
    }
}
