# Build the clox bytecode VM
# Usage: make (release), make debug (debug mode with trace output)

CC      = gcc
CFLAGS  = -std=c11 -Wall -Wextra
SRCS    = $(wildcard *.c)
TARGET  = clox

.PHONY: all debug clean

all: CFLAGS += -O2
all: $(TARGET)

debug: CFLAGS += -g -DDEBUG_PRINT_CODE -DDEBUG_TRACE_EXECUTION
debug: $(TARGET)

$(TARGET): $(SRCS)
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -f $(TARGET)
