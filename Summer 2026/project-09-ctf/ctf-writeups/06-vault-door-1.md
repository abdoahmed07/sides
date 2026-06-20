# PicoCTF — vault-door-1 (Reverse Engineering)

**Category:** Reverse Engineering
**Points:** 100

## What the challenge was

A compiled Java program that checks if a password is correct. I was given the Java source.

## The vulnerability

The `checkPassword()` function was checking characters of the input at specific hardcoded positions:

```java
public boolean checkPassword(String password) {
    return password.length() == 32 &&
           password.charAt(0)  == 'd' &&
           password.charAt(29) == 'f' &&
           password.charAt(4)  == 'r' &&
           password.charAt(2)  == '5' &&
           // ... many more like this
}
```

## How I solved it

I just read the code and assembled the flag by placing each character at its correct index:

```python
chars = {}
# Parse each "password.charAt(N) == 'C'" line
import re

code = open("VaultDoor1.java").read()
for match in re.finditer(r"charAt\((\d+)\)\s*==\s*'(.)'", code):
    idx, char = int(match.group(1)), match.group(2)
    chars[idx] = char

flag = "".join(chars[i] for i in sorted(chars))
print(f"picoCTF{{{flag}}}")
```

## What I learned

This demonstrates why you never validate secrets client-side. The "check" happened in code the user could read and reverse. Real password validation should happen on a server where the user can't inspect the logic. Any validation that runs in the client (browser JavaScript, downloaded app, Java bytecode) can be reversed — the user has the code.
