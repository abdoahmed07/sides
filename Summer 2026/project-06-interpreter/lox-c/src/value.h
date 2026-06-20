#ifndef clox_value_h
#define clox_value_h

// The Value type — how Lox represents data at runtime in the C VM
// I use a tagged union: the tag tells us what type, the union holds the data
// This is more efficient than heap-allocating every value like the Java version does

#include "common.h"

// Forward declarations for object types (defined in object.h)
typedef struct Obj Obj;
typedef struct ObjString ObjString;

// The tag — which kind of value is this?
typedef enum {
    VAL_BOOL,
    VAL_NIL,
    VAL_NUMBER,
    VAL_OBJ,   // heap-allocated object (string, function, closure, class, instance...)
} ValueType;

// The actual value — 8 bytes on 64-bit systems
typedef struct {
    ValueType type;
    union {
        bool boolean;
        double number;
        Obj* obj;     // pointer to heap-allocated object
    } as;
} Value;

// Type checking macros — readable and safe
#define IS_BOOL(value)   ((value).type == VAL_BOOL)
#define IS_NIL(value)    ((value).type == VAL_NIL)
#define IS_NUMBER(value) ((value).type == VAL_NUMBER)
#define IS_OBJ(value)    ((value).type == VAL_OBJ)

// Value extraction macros — get the C value out of a Lox Value
// I always check the type before using these (in debug mode the VM does too)
#define AS_BOOL(value)   ((value).as.boolean)
#define AS_NUMBER(value) ((value).as.number)
#define AS_OBJ(value)    ((value).as.obj)

// Value construction macros — wrap a C value into a Lox Value
#define BOOL_VAL(value)   ((Value){VAL_BOOL, {.boolean = value}})
#define NIL_VAL           ((Value){VAL_NIL, {.number = 0}})
#define NUMBER_VAL(value) ((Value){VAL_NUMBER, {.number = value}})
#define OBJ_VAL(object)   ((Value){VAL_OBJ, {.obj = (Obj*)object}})

// Dynamic array of Values — used for the constants pool
typedef struct {
    int capacity;
    int count;
    Value* values;
} ValueArray;

bool valuesEqual(Value a, Value b);
void initValueArray(ValueArray* array);
void writeValueArray(ValueArray* array, Value value);
void freeValueArray(ValueArray* array);
void printValue(Value value);

#endif
