# PicoCTF — where are the robots (Web Exploitation)

**Category:** Web Exploitation
**Points:** 100

## What the challenge was

A webpage with a basic login form. The challenge description hinted at something "robots" might know.

## How I solved it

`robots.txt` is a file that tells search engine crawlers which pages NOT to index. It's public and readable by anyone. I navigated to `/robots.txt`:

```
User-agent: *
Disallow: /8028f.html
```

The site was trying to hide `/8028f.html` from search engines. Navigating there directly gave me the flag: `picoCTF{ca1cu1at1ng_Mach1n3s_r0b0ts}`

## What I learned

`robots.txt` is one of the most common places attackers look when exploring a web app. The irony is that it's literally a public file listing the pages you want to hide. It's not a security mechanism — it's a convention that search engines follow voluntarily. Sensitive paths should be protected by authentication, not excluded from robots.txt.

In a real pentest, checking robots.txt and sitemap.xml is standard practice during the reconnaissance phase.
