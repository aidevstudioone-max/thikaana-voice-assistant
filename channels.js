/* ─────────────────────────────────────────────────────────────────────────
   Channel simulations.

   The website widget is interactive. These two are playback: you cannot speak
   into a pretend phone, and pretending you can breaks the illusion in about
   two seconds. Each carries a SIMULATED label for the same reason.

   Both replay the same conversation through respondTo(), so the words are
   identical across all three channels and there is still one place to edit
   copy — script.js.
   ───────────────────────────────────────────────────────────────────────── */

import { respondTo } from './script.js';

/* The call, as a caller would actually say it. Replies come from the script. */
export const CALL_SCRIPT = [
  'Hi, do you have a table for four at eight tonight?',
  'Actually, make it six.',
  'Anything vegetarian on the menu?',
  "That's perfect, book it.",
  'My name is Sharma.',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Fallback pacing for when speech is unavailable or muted. */
const speakMs = (text) => Math.min(6200, 900 + text.split(/\s+/).length * 260);

/* ── voices ─────────────────────────────────────────────────────────────
   Two distinct voices so a call sounds like two people. The browser decides
   what it has, so pick the best available and fall back gracefully. */

let VOICES = { caller: null, agent: null };

/* macOS ships a pile of novelty voices (Albert, Zarvox, Bubbles…). Picking one
   by accident makes the demo sound like a joke, so they're excluded by name. */
const NOVELTY =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|grandma|grandpa|eddy|flo|rocko|sandy|shelley|reed/i;

function pickVoices() {
  const all = speechSynthesis.getVoices();
  if (!all.length) return;
  const en = all.filter((v) => /^en/i.test(v.lang));
  const pool = (en.length ? en : all).filter((v) => !NOVELTY.test(v.name));
  if (!pool.length) return;

  /* The restaurant answers in Indian English; the caller is whoever's left. */
  const byLang = (re) => pool.filter((v) => re.test(v.lang));
  const agent = byLang(/en[-_]IN/i)[0] || byLang(/en[-_]GB/i)[0] || pool[0];
  const caller =
    byLang(/en[-_]IN/i).find((v) => v !== agent) ||
    byLang(/en[-_]GB/i).find((v) => v !== agent) ||
    byLang(/en[-_]US/i).find((v) => v !== agent) ||
    pool.find((v) => v !== agent) ||
    agent;
  VOICES = { agent, caller };
}
pickVoices();
/* addEventListener, not onvoiceschanged — the widget registers a handler too,
   and a second assignment silently replaces the first. */
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', pickVoices);
}

export const audio = { muted: false };

/** Speak, and resolve when the voice actually stops — so captions stay in sync. */
function say(text, who) {
  return new Promise((resolve) => {
    if (audio.muted || typeof speechSynthesis === 'undefined') {
      return void setTimeout(resolve, speakMs(text));
    }
    if (!VOICES.agent) pickVoices();   // voices often aren't ready at load
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = who === 'agent' ? VOICES.agent : VOICES.caller;
      if (v) u.voice = v;
      u.rate = who === 'agent' ? 1.0 : 1.06;   // the caller is a shade quicker
      u.pitch = who === 'agent' ? 1.0 : 1.12;  // and a shade higher, so they differ
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      /* Some browsers never fire onend — never hang the playback on it. */
      setTimeout(finish, speakMs(text) + 3500);
    } catch {
      setTimeout(finish, speakMs(text));
    }
  });
}

export function stopSpeaking() {
  try { speechSynthesis.cancel(); } catch { /* nothing to cancel */ }
}

/* ── shared plumbing ────────────────────────────────────────────────────── */

class Playback {
  constructor({ onBooking, onTurn }) {
    this.onBooking = onBooking;
    this.onTurn = onTurn;
    this.abort = false;
  }

  stop() {
    this.abort = true;
    stopSpeaking();
  }

  /* Walk the script, pushing each turn out through onTurn(). */
  async run(state) {
    for (const line of CALL_SCRIPT) {
      if (this.abort) return state;
      await this.onTurn({ who: 'caller', text: line });
      await say(line, 'caller');
      if (this.abort) return state;

      const res = respondTo(line, state);
      state = res.state;
      this.onBooking(state);
      await this.onTurn({ who: 'agent', text: res.text });
      await say(res.text, 'agent');
      await wait(260); // a beat between turns, as on a real call
    }
    return state;
  }
}

/* ── WhatsApp ───────────────────────────────────────────────────────────── */

export function whatsappMarkup() {
  return `
    <div class="phone" data-channel="whatsapp">
      <div class="phone-notch"></div>
      <div class="wa-top">
        <div class="wa-avatar">ST</div>
        <div class="wa-who">
          <b>Saffron Table</b>
          <span id="wa-sub">Business account</span>
        </div>
        <svg class="wa-callicon" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>
      </div>
      <div class="wa-body" id="wa-body"></div>
      <div class="wa-call" id="wa-call" hidden>
        <div class="wa-call-avatar">ST</div>
        <div class="wa-call-name">Saffron Table</div>
        <div class="wa-call-timer" id="wa-timer">00:00</div>
        <div class="wa-call-meta">WhatsApp audio · end-to-end encrypted</div>
        <div class="wave" id="wa-wave">${'<i></i>'.repeat(9)}</div>
        <div class="cap" id="wa-cap"></div>
      </div>
    </div>`;
}

export async function playWhatsApp(root, opts) {
  const body = root.querySelector('#wa-body');
  const callView = root.querySelector('#wa-call');
  const sub = root.querySelector('#wa-sub');
  const cap = root.querySelector('#wa-cap');
  const wave = root.querySelector('#wa-wave');
  const timer = root.querySelector('#wa-timer');
  body.innerHTML = '';
  callView.hidden = true;

  const bubble = (side, text, cls = '') => {
    const el = document.createElement('div');
    el.className = `wa-msg ${side} ${cls}`;
    el.textContent = text;
    body.append(el);
    body.scrollTop = body.scrollHeight;
    return el;
  };

  const typing = async (ms = 900) => {
    const t = bubble('in', '', 'typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    await wait(ms);
    t.remove();
  };

  /* The thread before the call — this is how a real customer arrives. */
  bubble('out', 'Hi, are you open tonight?');
  await wait(700);
  await typing();
  bubble('in', "Yes — we're open till 11. Would you like to book a table?");
  await wait(900);
  const btn = bubble('in', '', 'callbtn');
  btn.innerHTML = '<span>📞 Call us</span><small>Tap to speak to our assistant</small>';
  await wait(1100);
  btn.classList.add('tapped');
  await wait(500);

  /* Into the call. */
  sub.textContent = 'on a call';
  callView.hidden = false;

  let secs = 0;
  const tick = setInterval(() => {
    secs += 1;
    timer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }, 1000);

  const pb = new Playback({
    onBooking: opts.onBooking,
    onTurn: async ({ who, text }) => {
      wave.classList.toggle('agent', who === 'agent');
      wave.classList.add('live');
      cap.innerHTML = `<b>${who === 'caller' ? 'You' : 'Saffron Table'}</b>${text}`;
      opts.onTranscript?.(who, text);
    },
  });
  opts.register?.(pb);

  await pb.run(opts.state);

  clearInterval(tick);
  wave.classList.remove('live');
  cap.innerHTML = '<b>Call ended</b>Booking confirmed · no call charges, over data';
  sub.textContent = 'Business account';
  return secs;
}

/* ── Phone call ─────────────────────────────────────────────────────────── */

export function phoneMarkup() {
  return `
    <div class="phone" data-channel="pstn">
      <div class="phone-notch"></div>
      <div class="pstn" id="pstn-ring">
        <div class="pstn-label">Incoming call</div>
        <div class="pstn-num">+91 98300 41127</div>
        <div class="pstn-sub">Kolkata · mobile</div>
        <div class="ring"><span></span><span></span><span></span></div>
        <div class="pstn-answer">Answering automatically…</div>
      </div>
      <div class="pstn-live" id="pstn-live" hidden>
        <div class="pstn-live-top">
          <span class="dot"></span> On call with <b>+91 98300 41127</b>
          <span class="pstn-timer" id="pstn-timer">00:00</span>
        </div>
        <div class="wave big" id="pstn-wave">${'<i></i>'.repeat(13)}</div>
        <div class="cap" id="pstn-cap"></div>
      </div>
      <div class="pstn-summary" id="pstn-summary" hidden>
        <div class="tick">✓</div>
        <div class="pstn-summary-t">Call handled</div>
        <dl id="pstn-sum-rows"></dl>
        <p>Nobody left the kitchen. Nobody was put on hold.</p>
      </div>
    </div>`;
}

export async function playPhone(root, opts) {
  const ring = root.querySelector('#pstn-ring');
  const live = root.querySelector('#pstn-live');
  const summary = root.querySelector('#pstn-summary');
  const cap = root.querySelector('#pstn-cap');
  const wave = root.querySelector('#pstn-wave');
  const timer = root.querySelector('#pstn-timer');

  ring.hidden = false;
  live.hidden = true;
  summary.hidden = true;

  await wait(2400); // let it ring — the pause is the point
  ring.hidden = true;
  live.hidden = false;

  let secs = 0;
  const tick = setInterval(() => {
    secs += 1;
    timer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }, 1000);

  let finalState = opts.state;
  const pb = new Playback({
    onBooking: (s) => {
      finalState = s;
      opts.onBooking(s);
    },
    onTurn: async ({ who, text }) => {
      wave.classList.toggle('agent', who === 'agent');
      wave.classList.add('live');
      cap.innerHTML = `<b>${who === 'caller' ? 'Caller' : 'Assistant'}</b>${text}`;
      opts.onTranscript?.(who, text);
    },
  });
  opts.register?.(pb);

  finalState = await pb.run(opts.state);

  clearInterval(tick);
  wave.classList.remove('live');
  await wait(600);

  live.hidden = true;
  summary.hidden = false;
  const mm = `${Math.floor(secs / 60)}m ${secs % 60}s`;
  root.querySelector('#pstn-sum-rows').innerHTML = [
    ['Duration', mm],
    ['Guests', finalState.party ?? '—'],
    ['Time', finalState.time ?? '—'],
    ['Name', finalState.name ?? '—'],
    ['Outcome', 'Table booked'],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  return secs;
}
