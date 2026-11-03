import type { Category } from "./types";

/** The fixed text of a test check. It runs without a language model, so it costs nothing. */
export const DEMO_TEXT =
  "Vakar es gaju uz veikalu, lai nopirktu maize. Mēs ar draugu runājām par to ka laiks ir ļoti silts.  Viņš teica, ka rīt būs lietus lietus.";

/** The edits a test check reports for DEMO_TEXT, in the shape a model would return them. */
export const DEMO_EDITS: { context: string; original: string; replacement: string; explanation: string; category: Category }[] = [
  {
    context: "Vakar es gaju uz",
    original: "gaju",
    replacement: "gāju",
    explanation: "Garo patskani apzīmē ar garumzīmi: gāju.",
    category: "spelling",
  },
  {
    context: "lai nopirktu maize.",
    original: "maize",
    replacement: "maizi",
    explanation: "Pēc darbības vārda „nopirkt” lieto akuzatīvu: maizi.",
    category: "grammar",
  },
  {
    context: "par to ka laiks",
    original: "to",
    replacement: "to,",
    explanation: "Palīgteikumu, kas sākas ar „ka”, atdala ar komatu.",
    category: "punctuation",
  },
  {
    context: "silts.  Viņš",
    original: "  ",
    replacement: " ",
    explanation: "Starp teikumiem liek vienu atstarpi.",
    category: "style",
  },
  {
    context: "lietus lietus.",
    original: " lietus",
    replacement: "",
    explanation: "Vārds „lietus” atkārtots divreiz.",
    category: "style",
  },
];
