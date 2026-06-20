package com.lox;

import java.util.List;

// Abstract Syntax Tree node types
// Each expression type is a static inner class that extends Expr
// The Visitor pattern lets us add new operations (interpret, print, resolve) without
// modifying these classes — all the logic stays in the visitor

// I generated the boilerplate for these with a script (see tools/GenerateAst.java)
// but it's important to understand the structure: each Expr subclass holds exactly
// the data needed for that expression type

public abstract class Expr {

    // The visitor interface — implemented by Interpreter, AstPrinter, Resolver
    public interface Visitor<R> {
        R visitAssignExpr(Assign expr);
        R visitBinaryExpr(Binary expr);
        R visitCallExpr(Call expr);
        R visitGetExpr(Get expr);
        R visitGroupingExpr(Grouping expr);
        R visitLiteralExpr(Literal expr);
        R visitLogicalExpr(Logical expr);
        R visitSetExpr(Set expr);
        R visitSuperExpr(Super expr);
        R visitThisExpr(This expr);
        R visitUnaryExpr(Unary expr);
        R visitVariableExpr(Variable expr);
    }

    public abstract <R> R accept(Visitor<R> visitor);

    // Assignment: variable = value
    public static class Assign extends Expr {
        public final Token name;
        public final Expr value;
        public Assign(Token name, Expr value) { this.name = name; this.value = value; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitAssignExpr(this); }
    }

    // Binary: left op right (e.g., 1 + 2, a > b)
    public static class Binary extends Expr {
        public final Expr left;
        public final Token operator;
        public final Expr right;
        public Binary(Expr left, Token operator, Expr right) {
            this.left = left; this.operator = operator; this.right = right;
        }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitBinaryExpr(this); }
    }

    // Call: callee(arguments...)
    public static class Call extends Expr {
        public final Expr callee;
        public final Token paren;     // the closing paren — stored for error reporting
        public final List<Expr> arguments;
        public Call(Expr callee, Token paren, List<Expr> arguments) {
            this.callee = callee; this.paren = paren; this.arguments = arguments;
        }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitCallExpr(this); }
    }

    // Get: object.field
    public static class Get extends Expr {
        public final Expr object;
        public final Token name;
        public Get(Expr object, Token name) { this.object = object; this.name = name; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitGetExpr(this); }
    }

    // Grouping: (expression) — parentheses just wrap another expression
    public static class Grouping extends Expr {
        public final Expr expression;
        public Grouping(Expr expression) { this.expression = expression; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitGroupingExpr(this); }
    }

    // Literal: 42, "hello", true, nil
    public static class Literal extends Expr {
        public final Object value;
        public Literal(Object value) { this.value = value; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitLiteralExpr(this); }
    }

    // Logical: left and/or right — short-circuits, unlike Binary
    public static class Logical extends Expr {
        public final Expr left;
        public final Token operator;
        public final Expr right;
        public Logical(Expr left, Token operator, Expr right) {
            this.left = left; this.operator = operator; this.right = right;
        }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitLogicalExpr(this); }
    }

    // Set: object.field = value
    public static class Set extends Expr {
        public final Expr object;
        public final Token name;
        public final Expr value;
        public Set(Expr object, Token name, Expr value) {
            this.object = object; this.name = name; this.value = value;
        }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitSetExpr(this); }
    }

    // Super: super.method
    public static class Super extends Expr {
        public final Token keyword;
        public final Token method;
        public Super(Token keyword, Token method) { this.keyword = keyword; this.method = method; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitSuperExpr(this); }
    }

    // This: reference to current class instance
    public static class This extends Expr {
        public final Token keyword;
        public This(Token keyword) { this.keyword = keyword; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitThisExpr(this); }
    }

    // Unary: -value or !value
    public static class Unary extends Expr {
        public final Token operator;
        public final Expr right;
        public Unary(Token operator, Expr right) { this.operator = operator; this.right = right; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitUnaryExpr(this); }
    }

    // Variable: reading a variable's value
    public static class Variable extends Expr {
        public final Token name;
        public Variable(Token name) { this.name = name; }
        @Override public <R> R accept(Visitor<R> visitor) { return visitor.visitVariableExpr(this); }
    }
}
