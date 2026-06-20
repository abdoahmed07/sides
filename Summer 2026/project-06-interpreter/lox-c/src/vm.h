#ifndef clox_vm_h
#define clox_vm_h

// The Virtual Machine — executes bytecode chunks produced by the compiler
// It's stack-based: instructions push/pop values on the value stack
// The "instruction pointer" (ip) points to the current bytecode instruction

#include "chunk.h"
#include "table.h"
#include "value.h"
#include "object.h"

// Maximum call stack depth — prevents infinite recursion from blowing the actual stack
#define FRAMES_MAX 64

// Size of the value stack — FRAMES_MAX * 256 slots (one "window" per call frame)
#define STACK_MAX (FRAMES_MAX * UINT8_COUNT)

// A CallFrame represents one function call in progress
// Each frame has its own instruction pointer and its own "window" into the value stack
typedef struct {
    ObjClosure* closure;   // the function being called (wrapped in a closure)
    uint8_t* ip;           // instruction pointer for this frame
    Value* slots;          // points to the first slot on the stack for this call
} CallFrame;

typedef struct {
    CallFrame frames[FRAMES_MAX];  // the call stack
    int frameCount;                // how deep we are

    Value stack[STACK_MAX];        // the value stack
    Value* stackTop;               // pointer to first empty slot (stack grows up)

    Table globals;          // global variable table
    Table strings;          // string intern table (for fast string equality)
    ObjString* initString;  // cached "init" string for class initializers
    ObjUpvalue* openUpvalues;  // linked list of still-open upvalues (captured locals)

    // Garbage collector fields
    size_t bytesAllocated;  // current total heap allocation
    size_t nextGC;          // trigger the next GC when bytesAllocated exceeds this
    Obj* objects;           // linked list of ALL heap-allocated objects (for GC traversal)
    int grayCount;          // GC: number of gray objects in the worklist
    int grayCapacity;
    Obj** grayStack;        // GC: objects that have been reached but not yet scanned
} VM;

typedef enum {
    INTERPRET_OK,
    INTERPRET_COMPILE_ERROR,
    INTERPRET_RUNTIME_ERROR,
} InterpretResult;

extern VM vm;  // global VM instance — single VM for the whole program

void initVM();
void freeVM();
InterpretResult interpret(const char* source);
void push(Value value);
Value pop();

#endif
