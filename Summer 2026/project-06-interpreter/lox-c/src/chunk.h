#ifndef clox_chunk_h
#define clox_chunk_h

// A chunk is a sequence of bytecode instructions with associated constants
// The VM executes chunks — the compiler produces them
// This is the core data structure that connects the compiler to the VM

#include "common.h"
#include "value.h"

// Every VM instruction is one of these opcodes
// The byte after an opcode is its operand (if it has one)
typedef enum {
    OP_CONSTANT,       // push a constant value onto the stack; operand = index into constants array
    OP_NIL,            // push nil
    OP_TRUE,           // push true
    OP_FALSE,          // push false
    OP_POP,            // discard the top of the stack (for expression statements)
    OP_GET_LOCAL,      // push a local variable's value; operand = stack slot index
    OP_SET_LOCAL,      // set a local variable; operand = stack slot index
    OP_GET_GLOBAL,     // push a global variable's value; operand = name constant index
    OP_DEFINE_GLOBAL,  // define a new global variable
    OP_SET_GLOBAL,     // assign to a global variable
    OP_GET_UPVALUE,    // for closures — read a captured variable
    OP_SET_UPVALUE,    // for closures — write a captured variable
    OP_GET_PROPERTY,   // object field access
    OP_SET_PROPERTY,   // object field assignment
    OP_GET_SUPER,      // super.method
    OP_EQUAL,          // ==
    OP_GREATER,        // >
    OP_LESS,           // <
    OP_ADD,            // + (also string concatenation)
    OP_SUBTRACT,       // -
    OP_MULTIPLY,       // *
    OP_DIVIDE,         // /
    OP_NOT,            // !
    OP_NEGATE,         // unary -
    OP_PRINT,          // print statement
    OP_JUMP,           // unconditional jump; operand = 16-bit offset
    OP_JUMP_IF_FALSE,  // conditional jump
    OP_LOOP,           // jump backwards (for loops)
    OP_CALL,           // call a function; operand = argument count
    OP_INVOKE,         // method call optimization
    OP_SUPER_INVOKE,   // super method call
    OP_CLOSURE,        // create a closure from a function
    OP_CLOSE_UPVALUE,  // move a local captured by a closure from stack to heap
    OP_RETURN,         // return from a function
    OP_CLASS,          // create a class
    OP_INHERIT,        // inherit from a superclass
    OP_METHOD,         // define a method on a class
} OpCode;

// Dynamic array of bytes — grows as the compiler writes instructions
typedef struct {
    int count;
    int capacity;
    uint8_t* code;         // the actual bytecode
    int* lines;            // parallel array: which source line produced each instruction
    ValueArray constants;  // the constants pool for this chunk
} Chunk;

void initChunk(Chunk* chunk);
void freeChunk(Chunk* chunk);
void writeChunk(Chunk* chunk, uint8_t byte, int line);
int addConstant(Chunk* chunk, Value value);

#endif
