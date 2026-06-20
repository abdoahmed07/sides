# PicoCTF — Caesar Cipher 1 (Cryptography)

**Category:** Cryptography
**Points:** 100

## What the challenge was

A string of ciphertext that was encrypted with a Caesar cipher (rotate each letter by a fixed number).

Ciphertext: `dscvlyapkzh{z0lv_0n_czr_p0yviyqfl}` (example — the actual one from the challenge)

## How I solved it

A Caesar cipher has only 25 possible shifts (ROT-1 through ROT-25), so I just tried all of them:

```python
ciphertext = "dscvlyapkzh{z0lv_0n_czr_p0yviyqfl}"
for shift in range(1, 26):
    decrypted = ""
    for c in ciphertext:
        if c.isalpha():
            base = ord('a') if c.islower() else ord('A')
            decrypted += chr((ord(c) - base - shift) % 26 + base)
        else:
            decrypted += c  # preserve non-letter characters
    print(f"ROT-{shift}: {decrypted}")
```

One of the outputs was clearly English: `picoctf{...}`. That was the flag.

## Frequency analysis

If I couldn't brute-force (e.g., for a longer substitution cipher), I'd use frequency analysis: in English text, the letter 'e' appears most often (~12.7%), followed by 't', 'a', 'o'. If I count which letters appear most in the ciphertext, the most frequent one is probably 'e', which tells me the shift.

## What I learned

A cipher's security comes from the number of possible keys (the keyspace). Caesar cipher has a keyspace of 25 — trivially small. AES-256 has a keyspace of 2^256 — infeasible to brute-force even with all the computers on Earth. Encoding (base64, hex) is not encryption — it has a keyspace of 1.
