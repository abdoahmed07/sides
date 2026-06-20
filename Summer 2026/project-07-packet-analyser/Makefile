CC     = gcc
CFLAGS = -std=c11 -Wall -Wextra -O2
LDFLAGS = -lpcap
SRCS   = $(wildcard src/*.c)
TARGET = netwatch

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRCS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

clean:
	rm -f $(TARGET)
