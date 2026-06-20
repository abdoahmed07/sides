# PicoCTF — Insp3ct0r (Web Exploitation)

**Category:** Web Exploitation
**Points:** 50

## What the challenge was

The challenge had a webpage with nothing obviously useful on it. The description said something about "how pretty" the page was. The hint was basically: look closer.

## How I found it

Right-click → View Page Source. Looking at the HTML I found a comment:

```html
<!-- Part 1: picoCTF{tru3_d3 -->
```

Then I opened the browser DevTools, looked at the CSS file:

```css
/* Part 2: t3ct1ve_0r_ju5t */
```

And in the JavaScript file:

```javascript
// Part 3: sp3c1al_sk1lls}
```

Flag: `picoCTF{tru3_d3t3ct1ve_0r_ju5t_sp3c1al_sk1lls}`

## What I learned

Developers hide things in HTML comments, CSS comments, and JS comments all the time — either intentionally (bad) or by accident. In real engagements, "view source" is always one of the first things you do. Also: never put anything in client-side code you wouldn't put on a billboard. The client gets everything.
