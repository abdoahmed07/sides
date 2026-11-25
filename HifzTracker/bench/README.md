# Recognition bench

How well does "Recite and check" follow a recitation? Instead of reciting every page to find out, the bench
recites them for you: professional recitations of every ayah (EveryAyah, the audio the app plays) go through a
speech recognizer, and what it heard goes through the app's own logic (`src/recite/hearing.ts`, the same code
the recite screen runs), as a phone would send it: word by word, with a pause after each ayah.

Each page is recited three times:

- **right**: every word flagged is a false mistake (what makes the app feel wrong);
- **with an ayah skipped** (in the middle of the page): it should be caught;
- **with a look-alike ayah from elsewhere said in place of the right one** (a mutashabih): it should be caught.

The pages (`pages.ts`): 74 from all over the Quran: every 10th page, the first pages, and surahs that open with
letters (الٓمٓ, كٓهيعٓصٓ, حمٓ عٓسٓقٓ…). About 840 ayahs, 105 MB of audio per reciter.

## Running it

```bash
pnpm bench:audio alafasy        # download the audio, once (alafasy, husary or abdulbasit)
pnpm bench:hear apple alafasy   # what a recognizer hears, once (picks up where it left off)
pnpm bench                      # score everything heard so far: bench/.cache/report.md
```

Everything downloaded or produced stays in `bench/.cache/` (not part of the project).

## Recognizers

- **apple**: Apple's speech recognition through Apple's servers: the engine behind iPhone dictation, which phone
  mode uses in Safari. It runs on a Mac (macOS 13 or later) as a small app built from `apple/transcribe.swift`;
  the first time, macOS asks to allow speech recognition for it. It reproduces what iPhones do with recitation
  (ريبة for رَيْبَ, the و of وَأُو۟لَـٰٓئِكَ left out, the opening letters garbled).
- **apple-device**: the same, on the Mac itself (no servers). Worse with Arabic recitation.
- **tarteel**: Tarteel's Quran model, as private mode runs it (whisper-tiny-ar-quran). It was trained on
  EveryAyah's recitations, so it does better on them than it would on anyone else's voice.
- **groq**: Whisper large-v3 turbo on Groq: needs `GROQ_API_KEY` (free at console.groq.com).

Each recognizer's text per ayah is kept in `bench/.cache/heard/<recognizer>/<recitation>.json`, so changes to the
app's logic can be scored again in a minute without hearing anything again.

## Limits

Professional reciters aren't you: their melodic recitation is harder for phone dictation than plain
recitation, so the numbers are worse than what you'll see. They're for comparing (recognizers, and changes to the
app), not a promise. Apple's servers take a minute of audio at a time, so the end of the few very long ayahs is
lost. The slips are whole ayahs; slips inside an ayah (one word for another) are tested in `tests/` with text.
