package com.lox;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

// Entry point — runs a .lox file or starts an interactive REPL
// Error handling is centralized here so the interpreter stays clean

public class Lox {
    private static final Interpreter interpreter = new Interpreter();

    // These flags prevent running code after a parse or runtime error
    static boolean hadError        = false;
    static boolean hadRuntimeError = false;

    public static void main(String[] args) throws IOException {
        if (args.length > 1) {
            System.out.println("Usage: lox [script]");
            System.exit(64); // UNIX exit code 64 = usage error
        } else if (args.length == 1) {
            runFile(args[0]);
        } else {
            runPrompt(); // interactive REPL
        }
    }

    // Run a .lox source file
    private static void runFile(String path) throws IOException {
        byte[] bytes = Files.readAllBytes(Paths.get(path));
        run(new String(bytes, Charset.defaultCharset()));

        if (hadError)        System.exit(65);
        if (hadRuntimeError) System.exit(70);
    }

    // Interactive REPL — read a line, execute it, print the result, repeat
    private static void runPrompt() throws IOException {
        InputStreamReader input = new InputStreamReader(System.in);
        BufferedReader reader = new BufferedReader(input);

        while (true) {
            System.out.print("> ");
            String line = reader.readLine();
            if (line == null) break; // Ctrl+D exits
            run(line);
            hadError = false; // reset error flag so REPL keeps running after an error
        }
    }

    static void run(String source) {
        Scanner scanner = new Scanner(source);
        List<Token> tokens = scanner.scanTokens();

        Parser parser = new Parser(tokens);
        List<Stmt> statements = parser.parse();

        if (hadError) return; // don't interpret if parsing failed

        Resolver resolver = new Resolver(interpreter);
        resolver.resolve(statements);

        if (hadError) return; // don't interpret if resolution failed

        interpreter.interpret(statements);
    }

    // Scan/parse errors — reported by line number
    static void error(int line, String message) {
        report(line, "", message);
    }

    // Parse errors — reported with the problematic token
    static void error(Token token, String message) {
        if (token.type == TokenType.EOF) {
            report(token.line, " at end", message);
        } else {
            report(token.line, " at '" + token.lexeme + "'", message);
        }
    }

    // Runtime errors
    static void runtimeError(RuntimeError error) {
        System.err.println(error.getMessage() + "\n[line " + error.token.line + "]");
        hadRuntimeError = true;
    }

    private static void report(int line, String where, String message) {
        System.err.println("[line " + line + "] Error" + where + ": " + message);
        hadError = true;
    }
}
