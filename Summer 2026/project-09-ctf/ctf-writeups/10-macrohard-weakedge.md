# PicoCTF — MacroHard WeakEdge (Forensics)

**Category:** Forensics
**Points:** 300

## What the challenge was

I was given a `.pptx` file (a PowerPoint presentation). The flag was hidden somewhere inside it.

## Background: what .pptx files actually are

I researched this before solving. A `.pptx` file is actually a ZIP archive containing XML files and media. I can unzip it and explore the contents:

```bash
cp presentation.pptx presentation.zip
unzip presentation.zip -d pptx_contents/
ls pptx_contents/
# ppt/  _rels/  docProps/  [Content_Types].xml
```

## How I found the flag

Inside `ppt/slideMasters/hidden` I found a file with encoded content:

```bash
cat pptx_contents/ppt/slideMasters/hidden
# ZmxhZzogcGljb0NURntIMTFkZTNuX20zc3NhZzNzX2Z0d30=
```

That's base64. Decoding it:

```bash
echo "ZmxhZzogcGljb0NURntIMTFkZTNuX20zc3NhZzNzX2Z0d30=" | base64 -d
# flag: picoCTF{H11de3n_m3ssag3s_ftw}
```

## What I learned

Steganography is hiding data in plain sight inside normal-looking files. Office documents (docx, pptx, xlsx) are ZIP archives — they can easily contain hidden data in non-standard files within the archive that a normal user would never see.

In real forensics work, examining document metadata and internal structure is standard practice. Tools like `binwalk`, `exiftool`, and `strings` are commonly used to look for hidden data in binary files.
