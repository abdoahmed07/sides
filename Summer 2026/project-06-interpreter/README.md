# Lox Interpreter + Bytecode VM

A complete implementation of the Lox programming language, built following
[Crafting Interpreters](https://craftinginterpreters.com) by Robert Nystrom.

Two implementations:
- **`lox-java/`** — Tree-walking interpreter (Part 2 of the book)
- **`lox-c/`** — Bytecode compiler + virtual machine with garbage collector (Part 3)

## Running it

```bash
# Java interpreter
cd lox-java
javac src/com/lox/*.java -d out
java -cp out com.lox.Lox          # REPL
java -cp out com.lox.Lox example.lox  # run a file

# C VM (the real one — faster)
cd lox-c/src
make
./clox                # REPL
./clox ../example.lox # run a file
```

## Example

```lox
// Closures work
fun makeCounter() {
    var count = 0;
    fun increment() {
        count = count + 1;
        return count;
    }
    return increment;
}

var c = makeCounter();
print c();  // 1
print c();  // 2

// Classes with inheritance
class Dog < Animal {
    speak() { print this.name + " barks."; }
}
```

See `example.lox` for a full demo of all features.

## Architecture

### Java interpreter (lox-java)
| File | Role |
|------|------|
| Scanner.java | Lexer: source text → tokens |
| Parser.java | Parser: tokens → AST |
| Resolver.java | Semantic analysis: variable scope, closures |
| Interpreter.java | Tree-walking evaluator |
| Environment.java | Scope chain for variable lookup |

### C VM (lox-c)
| File | Role |
|------|------|
| scanner.c | Same as Java scanner but for the bytecode compiler |
| compiler.c | Single-pass compiler: source → bytecode chunks |
| vm.c | Stack-based bytecode interpreter |
| object.c | Heap objects: strings, functions, closures, classes, instances |
| memory.c | Allocator + garbage collector |
| table.c | Hash table (open addressing, FNV-1a hashing) |
| chunk.c | Bytecode chunk (dynamic array of instructions) |

## What I learned from this project

**The Visitor pattern finally made sense.** I'd seen it described in textbooks but never
understood why you'd want it. The interpreter uses it to add `interpret`, `print`, and
`resolve` operations to the AST without modifying the AST node classes. Once I built it, I
got it.

**Closures are surprisingly subtle.** The Java version stores the closing Environment in the
function object, which is conceptually clean but wastes memory. The C VM uses "upvalues" — a
smarter scheme where captured variables live on the stack until the closure outlives the
scope, then get moved to the heap. Reading the upvalue chapter three times was worth it.

**The garbage collector was the hardest part.** A mark-sweep GC in C requires very careful
bookkeeping — you can't let the GC run at a moment when the compiler has a reference to an
object that isn't reachable from the roots yet. The book calls these "GC hazard" moments and
I hit every one of them.

**Writing a hash table from scratch taught me more about hash maps than years of using them.**
I now understand load factors, open addressing, tombstone deletion, and why string interning
makes equality checks O(1) rather than O(n).

## Custom extension — String Interpolation

I added f-string style interpolation to the C VM:

```lox
var name = "world";
print f"Hello, {name}!";  // Hello, world!
```

Implementation: in the scanner, `f"..."` strings are detected and the `{...}` sections are
compiled as expressions. The result of each expression is converted to a string and
concatenated, using the existing string concatenation instruction (`OP_ADD`).
