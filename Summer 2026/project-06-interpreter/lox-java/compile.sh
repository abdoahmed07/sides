#!/bin/bash
# Compile and run the Lox interpreter
# Usage: ./compile.sh [script.lox]

mkdir -p out
javac -d out src/com/lox/*.java

if [ $? -ne 0 ]; then
    echo "Compilation failed."
    exit 1
fi

if [ -n "$1" ]; then
    java -cp out com.lox.Lox "$1"
else
    echo "Compiled. Run with: java -cp out com.lox.Lox [script.lox]"
    echo "Or REPL:            java -cp out com.lox.Lox"
fi
