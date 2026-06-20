package com.lox;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Stack;

// Semantic analysis pass — walks the AST after parsing but before interpreting
// Two jobs:
//   1. Resolve variable bindings: compute how many scopes up each variable lives
//      and tell the interpreter so it can look them up without searching at runtime
//   2. Detect errors: using 'this' outside a class, returning outside a function, etc.
//
// The "distance" for a variable is how many scope hops to get from the usage to the definition.
// Distance 0 = current scope, 1 = one scope up, etc.

public class Resolver implements Expr.Visitor<Void>, Stmt.Visitor<Void> {
    private final Interpreter interpreter;
    private final Stack<Map<String, Boolean>> scopes = new Stack<>();

    // Track what kind of scope we're in for error detection
    private enum FunctionType { NONE, FUNCTION, INITIALIZER, METHOD }
    private enum ClassType    { NONE, CLASS, SUBCLASS }

    private FunctionType currentFunction = FunctionType.NONE;
    private ClassType    currentClass    = ClassType.NONE;

    public Resolver(Interpreter interpreter) {
        this.interpreter = interpreter;
    }

    public void resolve(List<Stmt> statements) {
        for (Stmt statement : statements) resolve(statement);
    }

    // ---- Statement visitors ----

    @Override
    public Void visitBlockStmt(Stmt.Block stmt) {
        beginScope();
        resolve(stmt.statements);
        endScope();
        return null;
    }

    @Override
    public Void visitVarStmt(Stmt.Var stmt) {
        // Declare first (before resolving the initializer) so we can detect: var a = a;
        declare(stmt.name);
        if (stmt.initializer != null) resolve(stmt.initializer);
        define(stmt.name);
        return null;
    }

    @Override
    public Void visitFunctionStmt(Stmt.Function stmt) {
        declare(stmt.name);
        define(stmt.name); // define before resolving body so function can call itself recursively
        resolveFunction(stmt, FunctionType.FUNCTION);
        return null;
    }

    @Override
    public Void visitExpressionStmt(Stmt.Expression stmt) { resolve(stmt.expression); return null; }

    @Override
    public Void visitIfStmt(Stmt.If stmt) {
        resolve(stmt.condition);
        resolve(stmt.thenBranch);
        if (stmt.elseBranch != null) resolve(stmt.elseBranch);
        return null;
    }

    @Override
    public Void visitPrintStmt(Stmt.Print stmt)   { resolve(stmt.expression); return null; }

    @Override
    public Void visitReturnStmt(Stmt.Return stmt) {
        if (currentFunction == FunctionType.NONE) {
            Lox.error(stmt.keyword, "Can't return from top-level code.");
        }
        if (stmt.value != null) {
            if (currentFunction == FunctionType.INITIALIZER) {
                Lox.error(stmt.keyword, "Can't return a value from an initializer.");
            }
            resolve(stmt.value);
        }
        return null;
    }

    @Override
    public Void visitWhileStmt(Stmt.While stmt) {
        resolve(stmt.condition);
        resolve(stmt.body);
        return null;
    }

    @Override
    public Void visitClassStmt(Stmt.Class stmt) {
        ClassType enclosingClass = currentClass;
        currentClass = ClassType.CLASS;

        declare(stmt.name);
        define(stmt.name);

        if (stmt.superclass != null) {
            if (stmt.name.lexeme.equals(stmt.superclass.name.lexeme)) {
                Lox.error(stmt.superclass.name, "A class can't inherit from itself.");
            }
            currentClass = ClassType.SUBCLASS;
            resolve(stmt.superclass);
            // Create a scope for "super" inside all methods
            beginScope();
            scopes.peek().put("super", true);
        }

        // Create a scope for "this" inside all methods
        beginScope();
        scopes.peek().put("this", true);

        for (Stmt.Function method : stmt.methods) {
            FunctionType declaration = method.name.lexeme.equals("init")
                ? FunctionType.INITIALIZER : FunctionType.METHOD;
            resolveFunction(method, declaration);
        }

        endScope();
        if (stmt.superclass != null) endScope();
        currentClass = enclosingClass;
        return null;
    }

    // ---- Expression visitors ----

    @Override
    public Void visitVariableExpr(Expr.Variable expr) {
        // If the variable is declared but not yet defined, it's being used in its own initializer
        if (!scopes.isEmpty() && scopes.peek().get(expr.name.lexeme) == Boolean.FALSE) {
            Lox.error(expr.name, "Can't read local variable in its own initializer.");
        }
        resolveLocal(expr, expr.name);
        return null;
    }

    @Override
    public Void visitAssignExpr(Expr.Assign expr) {
        resolve(expr.value);
        resolveLocal(expr, expr.name);
        return null;
    }

    @Override
    public Void visitBinaryExpr(Expr.Binary expr)   { resolve(expr.left); resolve(expr.right); return null; }
    @Override
    public Void visitCallExpr(Expr.Call expr)        { resolve(expr.callee); for (Expr a : expr.arguments) resolve(a); return null; }
    @Override
    public Void visitGetExpr(Expr.Get expr)          { resolve(expr.object); return null; }
    @Override
    public Void visitGroupingExpr(Expr.Grouping expr){ resolve(expr.expression); return null; }
    @Override
    public Void visitLiteralExpr(Expr.Literal expr)  { return null; }
    @Override
    public Void visitLogicalExpr(Expr.Logical expr)  { resolve(expr.left); resolve(expr.right); return null; }

    @Override
    public Void visitSetExpr(Expr.Set expr) {
        resolve(expr.value);
        resolve(expr.object);
        return null;
    }

    @Override
    public Void visitSuperExpr(Expr.Super expr) {
        if (currentClass != ClassType.SUBCLASS) {
            Lox.error(expr.keyword, "Can't use 'super' outside of a subclass.");
        }
        resolveLocal(expr, expr.keyword);
        return null;
    }

    @Override
    public Void visitThisExpr(Expr.This expr) {
        if (currentClass == ClassType.NONE) {
            Lox.error(expr.keyword, "Can't use 'this' outside of a class.");
            return null;
        }
        resolveLocal(expr, expr.keyword);
        return null;
    }

    @Override
    public Void visitUnaryExpr(Expr.Unary expr) { resolve(expr.right); return null; }

    // ---- Helpers ----

    private void resolve(Stmt stmt)    { stmt.accept(this); }
    private void resolve(Expr expr)    { expr.accept(this); }

    private void resolveFunction(Stmt.Function function, FunctionType type) {
        FunctionType enclosingFunction = currentFunction;
        currentFunction = type;

        beginScope();
        for (Token param : function.params) {
            declare(param);
            define(param);
        }
        resolve(function.body);
        endScope();

        currentFunction = enclosingFunction;
    }

    private void beginScope() { scopes.push(new HashMap<>()); }
    private void endScope()   { scopes.pop(); }

    private void declare(Token name) {
        if (scopes.isEmpty()) return;
        Map<String, Boolean> scope = scopes.peek();
        if (scope.containsKey(name.lexeme)) {
            Lox.error(name, "Already a variable with this name in this scope.");
        }
        scope.put(name.lexeme, false); // false = declared but not yet defined
    }

    private void define(Token name) {
        if (scopes.isEmpty()) return;
        scopes.peek().put(name.lexeme, true); // true = fully initialized
    }

    private void resolveLocal(Expr expr, Token name) {
        // Walk from innermost scope outward, counting hops
        for (int i = scopes.size() - 1; i >= 0; i--) {
            if (scopes.get(i).containsKey(name.lexeme)) {
                interpreter.resolve(expr, scopes.size() - 1 - i);
                return;
            }
        }
        // Not found in any local scope — must be a global
    }
}
