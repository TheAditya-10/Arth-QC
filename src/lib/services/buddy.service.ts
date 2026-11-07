"use client";

/**
 * AI Buddy (mock). Replies are scripted and always hint-first: the buddy
 * never reveals a full answer straight away. Phase 2: swap `getBuddyReply`
 * for a Gemini call with a tutoring system prompt that enforces the same rule.
 */
import type { ChatMessage } from "@/types";
import { checkAnswer, sleep, uid } from "@/lib/utils";
import { PRACTICE_BANK } from "@/lib/mock-data/practice-bank";
import { topicName } from "@/lib/mock-data/curriculum";
import { getDB, setDB } from "./store";

interface Problem {
  id: string;
  question: string;
  answer: string;
  accepts?: string[];
  hints: string[];
  explanation: string;
}

const PROBLEMS: Record<string, Problem> = {
  fraction: {
    id: "fraction",
    question: "Reduce 36/48 to its simplest form.",
    answer: "3/4",
    hints: [
      "Let's start small. Is there a number that divides BOTH 36 and 48? Try 2, 3, 4…",
      "Good thinking! To finish in one step, find the HCF of 36 and 48. List the factors of 36: 1, 2, 3, 4, 6, 9, 12, 18, 36. Which is the biggest one that also divides 48?",
      "You're very close! The HCF is 12. Now divide the top AND bottom by 12. What do you get? Type your answer!",
    ],
    explanation: "36 ÷ 12 = 3 and 48 ÷ 12 = 4, so 36/48 = 3/4. Dividing top and bottom by the same number keeps the fraction equal!",
  },
  rounding: {
    id: "rounding",
    question: "Round 17,986 to the nearest thousand.",
    answer: "18000",
    hints: [
      "First, which two thousands does 17,986 sit between? 17,000 and …?",
      "Now look at the hundreds digit of 17,986. Is it 5 or more?",
      "The hundreds digit is 9 — that's 5 or more, so we round UP. What's the next thousand after 17,000? Type it!",
    ],
    explanation: "17,986 is between 17,000 and 18,000, and its hundreds digit (9) is ≥ 5, so it rounds up to 18,000.",
  },
  lcm: {
    id: "lcm",
    question: "Find the LCM of 4 and 6.",
    answer: "12",
    hints: [
      "LCM means the Lowest Common Multiple. Can you list the first few multiples of 4?",
      "Multiples of 4: 4, 8, 12, 16… Multiples of 6: 6, 12, 18… Do you see a number in both lists?",
      "Look for the smallest number that appears in both lists. Type it in!",
    ],
    explanation: "12 is the first number in both lists, so LCM(4, 6) = 12.",
  },
  integers: {
    id: "integers",
    question: "What is (−3) + 5?",
    answer: "2",
    accepts: ["+2"],
    hints: [
      "Picture a number line. Put your finger on −3.",
      "Adding a positive number means moving to the RIGHT. How many steps will you move?",
      "Move 5 steps right from −3: −2, −1, 0, 1, … where do you land?",
    ],
    explanation: "Starting at −3 and moving 5 steps right lands on 2. So (−3) + 5 = 2.",
  },
};

interface BuddyState {
  problem?: Problem;
  hintIndex: number;
}

let buddyState: BuddyState = { hintIndex: 0 };

export const SUGGESTED_PROMPTS = [
  "Explain fractions simply",
  "Give me a hint for 36/48",
  "Why was my angles answer wrong?",
  "Give me a similar practice question",
  "What is HCF?",
  "Just tell me the answer!",
];

const CONCEPTS: { match: RegExp; reply: string }[] = [
  {
    match: /fraction/,
    reply:
      "A fraction is a part of a whole. 🍕 If a pizza is cut into 8 equal slices and you eat 3, you ate 3/8. The bottom number (denominator) says how many equal parts there are; the top number (numerator) says how many you have.\n\nQuick check for you: if you eat 2 slices of a pizza cut into 4, what fraction did you eat?",
  },
  {
    match: /hcf|highest common factor|gcd/,
    reply:
      "HCF = Highest Common Factor. It's the BIGGEST number that divides two numbers exactly.\n\nExample: factors of 12 are 1, 2, 3, 4, 6, 12 and factors of 18 are 1, 2, 3, 6, 9, 18. Common ones: 1, 2, 3, 6. The highest is 6!\n\nYour turn: what do you think the HCF of 8 and 12 is? (Hint: list the factors.)",
  },
  {
    match: /lcm|lowest common multiple/,
    reply: "LCM = Lowest Common Multiple — the smallest number that both numbers divide into. Want to try one together? Say \"hint for LCM\".",
  },
  {
    match: /integer|negative/,
    reply:
      "Integers are whole numbers that can be positive, negative or zero: …, −3, −2, −1, 0, 1, 2, 3, …\n\nThink of a lift: floors above ground are positive, basements are negative, and the ground floor is 0. 🛗\n\nWhich is higher: basement −2 or basement −5?",
  },
  {
    match: /decimal/,
    reply: "Decimals are another way to write fractions with 10, 100, 1000 at the bottom. 0.5 means 5 tenths (5/10), and ₹2.75 means 2 rupees and 75 paise. Want a quick decimal question to try?",
  },
  {
    match: /angle/,
    reply:
      "An angle is the amount of turn between two arms. 📐\n• Acute: less than 90°\n• Right: exactly 90°\n• Obtuse: between 90° and 180°\n• Straight: exactly 180°\n• Reflex: more than 180°\n\nWhich type is the angle between clock hands at 2 o'clock (60°)?",
  },
  {
    match: /prime/,
    reply: "A prime number has exactly two factors: 1 and itself. 2, 3, 5, 7, 11 are primes. 1 is NOT prime (it has only one factor). Can you tell me if 21 is prime? Try dividing it by 3!",
  },
];

function latestMistake() {
  const db = getDB();
  const evals = [...db.evaluations].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
  for (const e of evals) {
    const r = e.results.find((x) => x.status !== "correct" && x.errors.length);
    if (r) {
      const a = db.assignments.find((x) => x.id === e.assignmentId);
      return { e, r, a };
    }
  }
  return null;
}

function anglesMistake() {
  const db = getDB();
  const e = db.evaluations.find((x) => x.assignmentId === "a5");
  return e?.results.find((r) => r.status !== "correct");
}

function startProblem(p: Problem): string {
  const detailed = getDB().appPrefs.aiHintLevel === "detailed";
  buddyState = { problem: p, hintIndex: detailed ? 2 : 1 };
  const hints = detailed ? `Hint 1: ${p.hints[0]}\n\nHint 2: ${p.hints[1]}` : `Hint 1: ${p.hints[0]}`;
  return `Let's work on this together: **${p.question}**\n\n${hints}\n\nTell me what you think, or say "another hint".`;
}

export function getBuddyReply(input: string): string {
  const text = input.toLowerCase().trim();
  const { problem } = buddyState;

  // Asking for the answer directly → never reveal, nudge with next hint.
  if (/(tell|give|show).*(answer)|just the answer|what('s| is) the answer/.test(text)) {
    if (problem) {
      const i = Math.min(buddyState.hintIndex, problem.hints.length - 1);
      buddyState.hintIndex = Math.min(buddyState.hintIndex + 1, problem.hints.length);
      return `I know it's tempting! 😄 But you'll remember it much better if you find it yourself. Here's a bigger hint:\n\n${problem.hints[i]}`;
    }
    return "I'm your thinking buddy, so I don't hand out answers — but I'm great at hints! 💡 Tell me which question you're stuck on, or tap \"Give me a hint for 36/48\" to see how it works.";
  }

  // Student attempting an answer for the active problem
  if (problem && /^[\s\d\-−+/.,()]+$/.test(text) && text.length < 20) {
    if (checkAnswer(text, problem.answer, problem.accepts)) {
      buddyState = { hintIndex: 0 };
      return `YES! 🎉 ${problem.explanation}\n\nYou solved it yourself — that's how champions learn. Want a similar question to practise?`;
    }
    const i = Math.min(buddyState.hintIndex, problem.hints.length - 1);
    buddyState.hintIndex = Math.min(buddyState.hintIndex + 1, problem.hints.length);
    return `Not quite, but nice try! Mistakes help our brain grow. 🌱\n\n${problem.hints[i]}`;
  }

  if (/another hint|more hint|next hint|still stuck|don'?t (get|understand)|help/.test(text) && problem) {
    if (buddyState.hintIndex >= problem.hints.length) {
      return `You've got all the hints now! Read them again slowly and give it a go — type just your answer. I believe in you! 💪`;
    }
    const h = problem.hints[buddyState.hintIndex];
    buddyState.hintIndex++;
    return `Hint ${buddyState.hintIndex}: ${h}`;
  }

  if (/36\/48|simplest form/.test(text)) return startProblem(PROBLEMS.fraction);
  if (/round/.test(text)) return startProblem(PROBLEMS.rounding);
  if (/hint.*lcm|lcm.*hint/.test(text)) return startProblem(PROBLEMS.lcm);
  if (/hint.*integer|integer.*hint|-3 ?\+ ?5|−3/.test(text)) return startProblem(PROBLEMS.integers);

  if (/angle.*wrong|wrong.*angle|why.*angle/.test(text)) {
    const r = anglesMistake();
    if (r) {
      buddyState = { hintIndex: 0 };
      return `Let's look at Question ${r.number} from "Measuring & Classifying Angles".\n\nYou wrote: "${r.studentAnswer}"\n\nWhat happened: ${r.errors[0]?.description}\n\nThink about it: if you open a book flat on the table, what angle do the two covers make? Is that bigger than 180°, or exactly 180°? 🤔`;
    }
  }

  if (/mistake|wrong|why did i/.test(text)) {
    const m = latestMistake();
    if (m) {
      return `In "${m.a?.title ?? "your homework"}", Question ${m.r.number}:\n\n${m.r.errors[0].description}\n\nHere's a thinking question instead of the answer: ${m.r.explanation.split(".")[0]}. Can you redo it now and tell me your new answer?`;
    }
    return "I couldn't find any mistakes to review — amazing! Try some practice to keep it that way. 🌟";
  }

  if (/similar|practice|another question|new question|quiz me/.test(text)) {
    const db = getDB();
    const weak = [...db.topicProgress].filter((t) => t.attempts > 0).sort((a, b) => a.mastery - b.mastery)[0];
    const pool = PRACTICE_BANK.filter((q) => q.topicId === (weak?.topicId ?? "fractions"));
    const q = pool[Math.floor(Math.random() * pool.length)];
    buddyState = {
      problem: { id: q.id, question: q.text, answer: q.answer, accepts: q.accepts, hints: [q.hint, "Break it into smaller steps — what's the first thing you'd do?", "Write down your working and check each step. Then type your answer."], explanation: q.explanation },
      hintIndex: 0,
    };
    return `Here's one on ${topicName(q.topicId)} (a topic we're strengthening 💪):\n\n**${q.text}**\n\nType your answer, or say "hint" if you'd like a nudge.`;
  }

  if (/^hint/.test(text) && problem) {
    const h = problem.hints[Math.min(buddyState.hintIndex, problem.hints.length - 1)];
    buddyState.hintIndex = Math.min(buddyState.hintIndex + 1, problem.hints.length);
    return `Hint ${buddyState.hintIndex}: ${h}`;
  }

  for (const c of CONCEPTS) if (c.match.test(text)) return c.reply;

  if (/^(hi|hello|hey)/.test(text)) return "Hello, champion! 👋 What are we learning today? You can ask me to explain a topic, give you a hint, or quiz you.";
  if (/thank/.test(text)) return "You're welcome! Remember: every question you try makes your brain stronger. 🧠✨";

  return "Hmm, I'm still learning that one! 🦉 I can explain topics like fractions, HCF, angles or integers, give you step-by-step hints, review your past mistakes, or create a practice question. What would you like?";
}

export async function sendBuddyMessage(text: string): Promise<ChatMessage> {
  const studentMsg: ChatMessage = { id: uid("c"), role: "student", text, at: new Date().toISOString() };
  setDB((db) => ({ ...db, chat: [...db.chat, studentMsg] }));
  const reply = getBuddyReply(text);
  await sleep(700 + Math.min(1600, reply.length * 6));
  const buddyMsg: ChatMessage = { id: uid("c"), role: "buddy", text: reply, at: new Date().toISOString() };
  setDB((db) => ({ ...db, chat: [...db.chat, buddyMsg] }));
  return buddyMsg;
}

export function clearChat() {
  buddyState = { hintIndex: 0 };
  setDB((db) => ({ ...db, chat: db.chat.slice(0, 1) }));
}
