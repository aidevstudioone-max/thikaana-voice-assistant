# Saffron Table — AI voice assistant demo

A voice assistant that answers a restaurant's phone: takes bookings, answers
menu questions, handles changes. Built by [ठिkaana](https://thikaana.co) to show
what a voice assistant does for a small business.

**Saffron Table is fictional.** So is the menu, and the diary.

## It is a scripted demo, deliberately

The replies are written in `script.js`, not generated. It recognises about eight
things a caller might say — a determined visitor can confuse it, and the page
says so. That is the trade: no backend, no API key, no per-conversation cost,
nothing to abuse, and nothing to take down.

Speech recognition and speech synthesis both run in the visitor's browser. No
audio is recorded, and no request leaves the page.

## Running it

Any static server — there is no build step.

```bash
npx vite          # or: python3 -m http.server
```

`index.html` is the whole widget; `script.js` is the whole script.

## Making it real

`respondTo(transcript, state)` in `script.js` is the only place that decides
what the assistant says. Replace its body with a call to a real model — behind
a server that holds the key — and the widget, the voice, the booking card and
the suggestion chips all keep working untouched.

## Editing the script

- `SUGGESTIONS` — the chips under the transcript
- `INTENTS` — trigger keywords, the reply, and what it changes on the booking

Intent order is load-bearing: `find` returns the first match, so specific
intents ("book it" means confirm) must sit above general ones ("book").
