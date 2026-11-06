export const WORDS = [
  ["rocket", "रॉकेट", "rocket", "things"],
  ["bicycle", "साइकिल", "cycle", "things"],
  ["pizza", "पिज़्ज़ा", "pizza", "food"],
  ["guitar", "गिटार", "guitar", "things"],
  ["umbrella", "छाता", "chhata", "things"],
  ["robot", "रोबोट", "robot", "things"],
  ["castle", "किला", "kila", "things"],
  ["telescope", "दूरबीन", "doorbeen", "things"],
  ["butterfly", "तितली", "titli", "nature"],
  ["rainbow", "इंद्रधनुष", "indradhanush", "nature"],
  ["cactus", "कैक्टस", "cactus", "nature"],
  ["volcano", "ज्वालामुखी", "jwalamukhi", "nature"],
  ["sunflower", "सूरजमुखी", "surajmukhi", "nature"],
  ["penguin", "पेंगुइन", "penguin", "nature"],
  ["elephant", "हाथी", "hathi", "nature"],
  ["octopus", "ऑक्टोपस", "octopus", "nature"],
  ["cupcake", "कपकेक", "cupcake", "food"],
  ["mango", "आम", "aam", "food"],
  ["banana", "केला", "kela", "food"],
  ["ice cream", "आइसक्रीम", "ice cream", "food"],
  ["samosa", "समोसा", "samosa", "food"],
  ["apple", "सेब", "seb", "food"],
  ["sandwich", "सैंडविच", "sandwich", "food"],
  ["watermelon", "तरबूज", "tarbooz", "food"],
];
export const normalizeWord = (value) =>
  String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
export function safeWord(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 40 ||
    !/[\p{L}]/u.test(value) ||
    /[^\p{L}\p{M}\p{N} '-]/u.test(value)
  )
    return false;
  return !/(fuck|shit|bitch|cunt|nigger|chutiya|madarchod|bhenchod|चूतिया|मादरचोद)/iu.test(
    normalizeWord(value),
  );
}
export const cleanWords = (words) =>
  Array.isArray(words)
    ? [...new Set(words.filter(safeWord).map((s) => s.trim()))].slice(0, 50)
    : [];
