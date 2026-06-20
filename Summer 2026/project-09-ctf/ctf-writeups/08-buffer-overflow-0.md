# PicoCTF — buffer overflow 0 (Binary Exploitation)

**Category:** Binary Exploitation
**Points:** 100

## What a stack buffer overflow is

When a C function is called, the processor pushes the return address onto the stack — the memory address to jump back to when the function returns. Local variables are also on the stack.

If a local variable is a fixed-size buffer (like `char buf[16]`) and the program writes more than 16 bytes into it without checking the length (using `gets()` or `strcpy()`), the extra bytes overflow past the buffer and overwrite adjacent memory on the stack — including the return address.

If an attacker controls what's in those extra bytes, they can overwrite the return address with an address of their choosing, redirecting program execution.

## The challenge

The vulnerable code:

```c
void vuln(char *input) {
    char buf[16];
    strcpy(buf, input);  // no bounds checking — if input > 16 bytes, overflow happens
}
```

For this challenge (buffer overflow 0), I just needed to cause a crash (segfault), not redirect execution. Passing more than 16+ bytes of input:

```bash
python3 -c "print('A' * 100)" | ./vuln
# Segmentation fault (core dumped)
```

The flag appeared when the program segfaulted.

## Why this is dangerous

In more advanced challenges (buffer overflow 1 and beyond), instead of crashing, you provide a carefully crafted payload where the extra bytes are the address of a function you want to call. Classic target: a `win()` function that prints the flag but is never called in normal execution.

Defenses: stack canaries (a random value between buffer and return address that the program checks before returning), ASLR (randomizes memory addresses), non-executable stack (NX bit).
