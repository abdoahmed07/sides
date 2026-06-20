#ifndef clox_common_h
#define clox_common_h

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Debug flags — comment these out for production builds
// #define DEBUG_PRINT_CODE   // print disassembled bytecode after compilation
// #define DEBUG_TRACE_EXECUTION // print each instruction and stack state as the VM runs

// How many entries a hash table can hold before it's considered "too full" and resizes
#define TABLE_MAX_LOAD 0.75

#endif
