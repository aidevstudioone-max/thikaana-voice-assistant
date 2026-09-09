/* ─────────────────────────────────────────────────────────────────────────
   The demo script.

   Everything the assistant can say lives here, so the copy can be rewritten
   without touching the widget. Each intent has trigger words, a spoken reply,
   and an optional change to the booking on screen.

   `respondTo()` at the bottom is the seam: swap its body for a real API call
   and the widget, the voice and the booking card all keep working unchanged.
   ───────────────────────────────────────────────────────────────────────── */

export const RESTAURANT = {
  name: 'Saffron Table',
  tagline: 'Modern Indian · Park Street',
  hours: 'Noon to 3, and 7 till 11. Closed Mondays.',
};

/* Suggestion chips — also the click-to-play path for anyone without a mic. */
export const SUGGESTIONS = [
  'Do you have anything vegetarian?',
  'Table for four at eight tonight',
  'Actually make it six',
  'Any parking nearby?',
  'What time do you close?',
  "That's perfect, book it",
];

/* Order is load-bearing: `find` takes the first match, so the specific
   intents ("book it" = confirm) must sit above the general one ("book"). */
const INTENTS = [
  {
    id: 'confirm',
    keywords: ['confirm', 'book it', 'perfect', 'yes please', "that's great", 'sounds good', 'done'],
    reply: (_m, state) =>
      `Confirmed. ${state.party || 4} people, ${state.time || '8:00 PM'}, ${state.date}. You'll get a WhatsApp confirmation in a moment. See you then.`,
    apply: (state) => ({ ...state, status: 'confirmed' }),
  },
  {
    id: 'change',
    keywords: ['make it', 'change', 'actually', 'instead', 'more people', 'fewer'],
    reply: (m, state) =>
      m.party
        ? `No problem — ${m.party} instead of ${state.party ?? 'four'}. Still ${state.time || "eight o'clock"}?`
        : 'Of course — what would you like to change it to?',
    apply: (state, m) => (m.party ? { ...state, party: m.party } : state),
  },
  {
    id: 'name',
    keywords: ['name is', 'under', 'my name', 'sharma', 'roy', 'nair', 'das'],
    reply: (m) =>
      `Got it${m.name ? ', ' + m.name : ''}. I'll hold the table for fifteen minutes past the booking time.`,
    /* Naming the booking must never un-confirm one that's already confirmed. */
    apply: (state, m) => ({
      ...state,
      name: m.name || 'Guest',
      status: state.status === 'confirmed' ? 'confirmed' : 'held',
    }),
  },
  {
    id: 'book',
    keywords: ['table', 'book', 'booking', 'reserve', 'reservation', 'seat'],
    reply: (m, state) =>
      `Lovely — a table for ${m.party || state.party || 'four'} at ${m.time || state.time || 'eight'}. I've pencilled that in. What name should I put it under?`,
    apply: (state, m) => ({
      ...state,
      party: m.party || state.party || 4,
      time: m.time || state.time || '8:00 PM',
      status: 'held',
    }),
  },
  {
    id: 'veg',
    keywords: ['vegetarian', 'veg', 'vegan', 'jain', 'meat', 'paneer'],
    reply:
      "Plenty — about half the menu is vegetarian. The paneer tikka and the dal makhani are what people come back for. We can do Jain and vegan versions of most dishes if you tell us when you book.",
  },
  {
    id: 'hours',
    keywords: ['close', 'closing', 'open', 'hours', 'timing', 'monday', 'what time'],
    reply: `We're open noon to three, and seven till eleven. Closed on Mondays. Last orders at half past ten.`,
  },
  {
    id: 'parking',
    keywords: ['parking', 'park', 'car', 'drive', 'valet'],
    reply:
      "There's valet parking outside from seven in the evening, and a public lot two minutes away on Middleton Row if you'd rather park yourself.",
  },
  {
    id: 'location',
    keywords: ['where', 'address', 'location', 'reach', 'metro', 'far'],
    reply:
      "We're on Park Street, just past the crossing — three minutes' walk from the metro station. I can send the exact pin on WhatsApp if that helps.",
  },
  {
    id: 'greeting',
    keywords: ['hello', 'hi', 'hey', 'good evening', 'good afternoon'],
    reply: `Good evening, and thanks for calling ${RESTAURANT.name}. Would you like to book a table, or hear about the menu?`,
  },
];

/* ── tiny parsers ───────────────────────────────────────────────────────── */

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

function parseParty(text) {
  const m = text.match(/(?:for|of|make it|party of)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve)/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const n = WORD_NUMBERS[raw] ?? parseInt(raw, 10);
  return n >= 1 && n <= 20 ? n : null;
}

function parseTime(text) {
  const digits = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'?clock)?/i);
  const words = text.match(/\b(seven|eight|nine|ten|noon)\b/i);
  let hour = null, mins = '00';

  if (digits && /am|pm|o'?clock|:/i.test(digits[0])) {
    hour = parseInt(digits[1], 10);
    mins = digits[2] || '00';
    if (/pm/i.test(digits[3] || '') && hour < 12) hour += 12;
    if (/am/i.test(digits[3] || '') && hour === 12) hour = 0;
  } else if (words) {
    const w = words[1].toLowerCase();
    hour = w === 'noon' ? 12 : WORD_NUMBERS[w];
    if (hour < 12 && !/morning|lunch|noon/i.test(text)) hour += 12; // "eight" means evening
  }
  if (hour === null) return null;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${mins} ${suffix}`;
}

function parseName(text) {
  const m = text.match(/(?:name is|under|it's|its|this is)\s+([a-z]+)/i);
  if (!m) return null;
  const n = m[1];
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

/* ── the seam ───────────────────────────────────────────────────────────── */

export const FALLBACK =
  "I didn't quite catch that. Try asking about the menu, our timings, or say “table for four at eight”.";

/**
 * Match a transcript to a scripted reply.
 *
 * Replace the body of this function with a fetch() to a real model and the
 * rest of the demo is unchanged — this is the only place that decides what
 * the assistant says.
 *
 * @returns {{ text: string, state: object, matched: boolean }}
 */
export function respondTo(transcript, state) {
  const text = transcript.toLowerCase().trim();
  if (!text) return { text: FALLBACK, state, matched: false };

  const parsed = {
    party: parseParty(text),
    time: parseTime(text),
    name: parseName(text),
  };

  /* Most specific first: a bare "make it six" must not be read as a new booking. */
  const hit = INTENTS.find((intent) => intent.keywords.some((k) => text.includes(k)));
  if (!hit) return { text: FALLBACK, state, matched: false };

  const nextState = hit.apply ? hit.apply(state, parsed) : state;
  const reply =
    typeof hit.reply === 'function' ? hit.reply(parsed, hit.id === 'change' ? state : nextState) : hit.reply;

  return { text: reply, state: nextState, matched: true };
}
