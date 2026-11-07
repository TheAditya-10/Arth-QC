import type { Difficulty, PracticeQuestion } from "@/types";

type Row = [text: string, answer: string, hint: string, explanation: string, accepts?: string[]];

const bank: Record<string, Record<Difficulty, Row[]>> = {
  "knowing-numbers": {
    easy: [
      ["What is the place value of 7 in 4,75,210?", "70000", "Count places from the right: ones, tens, hundreds, thousands, ten thousands…", "7 is in the ten-thousands place, so its value is 70,000."],
      ["How many lakhs make one crore?", "100", "1 crore = 1,00,00,000 and 1 lakh = 1,00,000.", "1,00,00,000 ÷ 1,00,000 = 100."],
      ["Write the greatest 4-digit number.", "9999", "Use the biggest digit in every place.", "9 in every place gives 9,999."],
    ],
    medium: [
      ["Round 46,719 to the nearest thousand.", "47000", "Look at the hundreds digit. Is it 5 or more?", "The hundreds digit is 7 (≥ 5), so round up: 47,000."],
      ["How many metres are there in 4 km 75 m?", "4075", "1 km = 1000 m.", "4 × 1000 + 75 = 4,075 m.", ["4075m", "4075 m"]],
      ["What is the difference between the greatest and smallest 3-digit numbers?", "899", "Greatest is 999. What is the smallest?", "999 − 100 = 899."],
    ],
    hard: [
      ["Estimate 8,325 + 12,690 by rounding each to the nearest thousand.", "21000", "Round 8,325 and 12,690 first, then add.", "8,000 + 13,000 = 21,000."],
      ["A book costs ₹185. What is the cost of 1,240 books?", "229400", "Multiply 185 × 1,240.", "185 × 1,240 = 2,29,400.", ["₹2,29,400"]],
      ["How many 5-digit numbers are there in all?", "90000", "From 10,000 to 99,999 — count them.", "99,999 − 10,000 + 1 = 90,000."],
    ],
  },
  "whole-numbers": {
    easy: [
      ["What is the predecessor of 10,000?", "9999", "Predecessor means one less.", "10,000 − 1 = 9,999."],
      ["What is the additive identity of whole numbers?", "0", "Which number added to anything keeps it the same?", "a + 0 = a, so 0 is the additive identity."],
      ["Find 25 × 37 × 4 using rearrangement.", "3700", "Group 25 and 4 together first.", "(25 × 4) × 37 = 100 × 37 = 3,700."],
    ],
    medium: [
      ["Find 99 × 47 using the distributive property.", "4653", "Write 99 as 100 − 1.", "100 × 47 − 1 × 47 = 4,700 − 47 = 4,653."],
      ["Find 625 + 189 + 375.", "1189", "Which two numbers add to make a round hundred?", "(625 + 375) + 189 = 1,000 + 189 = 1,189."],
      ["What is the multiplicative identity of whole numbers?", "1", "a × ? = a", "a × 1 = a, so 1 is the multiplicative identity."],
    ],
    hard: [
      ["Find 1,005 × 24 using the distributive property.", "24120", "Split 1,005 as 1,000 + 5.", "24,000 + 120 = 24,120."],
      ["What is the sum of the first 10 whole numbers (0 to 9)?", "45", "Pair numbers from both ends: 0+9, 1+8…", "5 pairs of 9 = 45."],
      ["Find 8 × 169 × 125.", "169000", "8 × 125 is a nice round number.", "(8 × 125) × 169 = 1,000 × 169 = 1,69,000."],
    ],
  },
  "playing-numbers": {
    easy: [
      ["Is 51 a prime number? (yes/no)", "no", "Try dividing 51 by 3.", "51 = 3 × 17, so it is not prime."],
      ["What is the smallest prime number?", "2", "It is also the only even prime.", "2 is the smallest prime number."],
      ["Find the HCF of 12 and 18.", "6", "List the factors of both numbers.", "Common factors are 1, 2, 3, 6 — the highest is 6."],
    ],
    medium: [
      ["Find the LCM of 6 and 8.", "24", "List multiples of 8 and check which one 6 divides.", "8, 16, 24 — 24 is the first multiple of both."],
      ["How many prime numbers are there between 40 and 60?", "5", "Check 41, 43, 47, 53, 59…", "41, 43, 47, 53 and 59 — five primes."],
      ["What is the HCF of 36 and 84?", "12", "Prime factorise both numbers.", "36 = 2²×3², 84 = 2²×3×7. HCF = 2²×3 = 12."],
    ],
    hard: [
      ["Find the LCM of 12, 15 and 20.", "60", "Use the division method.", "LCM = 2 × 2 × 3 × 5 = 60."],
      ["What is the smallest number divisible by both 18 and 24?", "72", "This is the LCM.", "LCM(18, 24) = 72."],
      ["Three bells ring every 6, 8 and 12 minutes. After how many minutes will they ring together again?", "24", "When do multiples of 6, 8 and 12 first match?", "LCM(6, 8, 12) = 24 minutes."],
    ],
  },
  "basic-geometry": {
    easy: [
      ["How many end points does a line segment have?", "2", "Think of a pencil — where does it begin and end?", "A line segment has exactly two end points."],
      ["How many end points does a ray have?", "1", "A ray starts somewhere and goes on forever.", "A ray has one end point."],
      ["How many sides does a hexagon have?", "6", "Hex means six.", "A hexagon has 6 sides."],
    ],
    medium: [
      ["If the radius of a circle is 7 cm, what is its diameter in cm?", "14", "Diameter = 2 × radius.", "2 × 7 = 14 cm.", ["14cm", "14 cm"]],
      ["How many diagonals does a quadrilateral have?", "2", "Join opposite corners.", "A quadrilateral has 2 diagonals."],
      ["How many line segments are there in a triangle?", "3", "Count the sides.", "A triangle has 3 sides, which are line segments."],
    ],
    hard: [
      ["How many line segments can be formed from 5 points, no three collinear?", "10", "From the first point draw 4, from the next 3 new…", "4 + 3 + 2 + 1 = 10."],
      ["How many diagonals does a pentagon have?", "5", "Each vertex connects to 2 non-adjacent vertices.", "5 × 2 ÷ 2 = 5 diagonals."],
      ["How many lines can pass through two given points?", "1", "Try drawing more than one!", "Exactly one line passes through two distinct points."],
    ],
  },
  "elementary-shapes": {
    easy: [
      ["How many degrees are there in a right angle?", "90", "It's a quarter of a full turn.", "A right angle is 90°.", ["90°"]],
      ["What is the name of an angle less than 90°?", "acute", "It's a 'sharp' angle.", "Angles between 0° and 90° are acute.", ["acute angle"]],
      ["How many degrees in a straight angle?", "180", "Half of a full turn.", "A straight angle is 180°.", ["180°"]],
    ],
    medium: [
      ["What is the angle between clock hands at 3 o'clock?", "90", "Each hour mark is 30°.", "3 × 30° = 90°.", ["90°"]],
      ["Two angles of a triangle are 40° and 70°. Find the third angle.", "70", "The angles of a triangle add up to 180°.", "180° − 40° − 70° = 70°.", ["70°"]],
      ["What fraction of a revolution is a right angle?", "1/4", "A full revolution is 360°.", "90 ÷ 360 = 1/4."],
    ],
    hard: [
      ["What is the angle between clock hands at 5 o'clock?", "150", "Multiply hours by 30°.", "5 × 30° = 150°.", ["150°"]],
      ["How many right angles make a complete turn?", "4", "360° ÷ 90° = ?", "4 right angles make 360°."],
      ["An angle is 3 times a right angle. How many degrees is it?", "270", "Right angle = 90°.", "3 × 90° = 270° (a reflex angle).", ["270°"]],
    ],
  },
  integers: {
    easy: [
      ["Which is greater: −3 or −8?", "-3", "On a number line, the number further right is greater.", "−3 is to the right of −8, so −3 is greater.", ["−3"]],
      ["What is the opposite of +12?", "-12", "Flip the sign.", "The opposite of +12 is −12.", ["−12"]],
      ["Is 0 positive, negative or neither?", "neither", "Zero sits in the middle.", "0 is neither positive nor negative."],
    ],
    medium: [
      ["What is (−4) + 7?", "3", "Start at −4 and move 7 steps right.", "−4 + 7 = 3."],
      ["What is 5 + (−9)?", "-4", "Start at 5 and move 9 steps left.", "5 − 9 = −4.", ["−4"]],
      ["How many integers lie between −3 and 3?", "5", "List them: −2, −1, …", "−2, −1, 0, 1, 2 — five integers."],
    ],
    hard: [
      ["What is (−6) + (−9) + 4?", "-11", "Add the negatives first.", "−15 + 4 = −11.", ["−11"]],
      ["The temperature was −5°C and rose by 12°C. What is it now (in °C)?", "7", "Start at −5 and move 12 up.", "−5 + 12 = 7°C.", ["7°c", "7°"]],
      ["Subtract: 3 − (−8)", "11", "Subtracting a negative is like adding.", "3 + 8 = 11."],
    ],
  },
  fractions: {
    easy: [
      ["Reduce 6/8 to its simplest form.", "3/4", "Divide numerator and denominator by their HCF.", "HCF(6, 8) = 2, so 6/8 = 3/4."],
      ["Write an equivalent fraction of 1/2 with denominator 10.", "5/10", "Multiply top and bottom by the same number.", "1 × 5 / 2 × 5 = 5/10."],
      ["Which is greater: 3/7 or 5/7?", "5/7", "Same denominator — compare numerators.", "5 > 3, so 5/7 is greater."],
    ],
    medium: [
      ["Find the missing number: 2/3 = ?/12", "8", "3 × 4 = 12, so multiply 2 by…", "2 × 4 = 8, so 2/3 = 8/12."],
      ["Add: 1/4 + 2/4", "3/4", "Like fractions — add the numerators.", "1 + 2 = 3, so 3/4."],
      ["Convert 7/3 into a mixed fraction.", "2 1/3", "How many whole 3s are in 7?", "7 ÷ 3 = 2 remainder 1, so 2 1/3.", ["2(1/3)", "21/3"]],
    ],
    hard: [
      ["Add: 1/3 + 1/6", "1/2", "Make the denominators the same first.", "1/3 = 2/6, so 2/6 + 1/6 = 3/6 = 1/2.", ["3/6"]],
      ["Subtract: 5/6 − 1/4", "7/12", "LCM of 6 and 4 is 12.", "10/12 − 3/12 = 7/12."],
      ["What fraction of an hour is 45 minutes? (simplest form)", "3/4", "An hour has 60 minutes.", "45/60 = 3/4."],
    ],
  },
  decimals: {
    easy: [
      ["Write 3 tenths as a decimal.", "0.3", "Tenths are one place after the decimal point.", "3 tenths = 0.3.", [".3"]],
      ["Which is greater: 0.5 or 0.45?", "0.5", "Write both with two decimal places: 0.50 vs 0.45.", "0.50 > 0.45, so 0.5 is greater."],
      ["Convert 50 paise into rupees.", "0.5", "100 paise = ₹1.", "50 ÷ 100 = ₹0.50.", ["0.50", "₹0.50"]],
    ],
    medium: [
      ["Add: 3.45 + 2.3", "5.75", "Line up the decimal points.", "3.45 + 2.30 = 5.75."],
      ["Subtract: 10 − 4.25", "5.75", "Write 10 as 10.00.", "10.00 − 4.25 = 5.75."],
      ["Write 7/100 as a decimal.", "0.07", "Hundredths are two places after the point.", "7/100 = 0.07."],
    ],
    hard: [
      ["Convert 3 km 45 m into kilometres.", "3.045", "1 m = 0.001 km.", "45 m = 0.045 km, so 3.045 km.", ["3.045km", "3.045 km"]],
      ["Riya bought a pen for ₹12.75 and a book for ₹48.50. How much did she spend?", "61.25", "Add the two amounts.", "12.75 + 48.50 = ₹61.25.", ["₹61.25"]],
      ["Arrange in ascending order and give the smallest: 0.8, 0.08, 0.88", "0.08", "Write each with two decimal places.", "0.08 < 0.80 < 0.88, so the smallest is 0.08."],
    ],
  },
};

export const PRACTICE_BANK: PracticeQuestion[] = Object.entries(bank).flatMap(([topicId, levels]) =>
  (Object.entries(levels) as [Difficulty, Row[]][]).flatMap(([difficulty, rows]) =>
    rows.map(([text, answer, hint, explanation, accepts], i) => ({
      id: `pq_${topicId}_${difficulty}_${i}`,
      topicId,
      difficulty,
      text,
      answer,
      accepts,
      hint,
      explanation,
    })),
  ),
);
