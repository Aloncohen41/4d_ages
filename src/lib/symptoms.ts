/*
 * Pregnancy symptoms and cravings: what to note, and for the symptoms, a few things that can help. The tips follow the NHS pregnancy pages
 * (nhs.uk/pregnancy/common-symptoms and the pages they link to), in our own words, and each links to its source. They're shown when a symptom
 * is noted and are never saved with it, so they never go into the book. Pure data, for tests.
 */

import { Emergency, callLine, emergencyFor } from "./emergency";

const NHS = "https://www.nhs.uk/pregnancy";

export interface SymptomGuide {
  id: string;
  label: string;
  emoji: string;
  /** What can help, in a midwife's words. */
  tips: string[];
  /** When to give the midwife or GP a ring. */
  callIf?: string[];
  /** When to get help straight away. */
  urgentIf?: string[];
  /** The NHS page the tips are based on. */
  source: string;
}

export const SYMPTOMS: SymptomGuide[] = [
  {
    id: "sickness", label: "Morning sickness", emoji: "🤢", source: `${NHS}/common-symptoms/vomiting-and-morning-sickness/`,
    tips: [
      "Rest as much as you can. Being tired often makes sickness worse.",
      "Try a dry biscuit or plain toast before you get up.",
      "Small, frequent meals of plain, starchy food (bread, rice, crackers, pasta) are usually easier than big meals.",
      "Cold food can be easier than hot if cooking smells set you off, and it's fine to avoid the foods and smells that make you feel sick.",
      "Sip water little and often through the day.",
      "Ginger may help. Check with a pharmacist before taking ginger supplements.",
      "Some women find acupressure wristbands help.",
      "It usually settles by weeks 16 to 20.",
    ],
    callIf: ["your pee is very dark, or you haven't had a wee in more than 8 hours", "you can't keep food or drink down for 24 hours", "you feel very weak, dizzy or faint when you stand up", "you have tummy pain or a high temperature, are losing weight, or vomit blood"],
  },
  {
    id: "heartburn", label: "Heartburn and indigestion", emoji: "🔥", source: `${NHS}/common-symptoms/indigestion-and-heartburn/`,
    tips: [
      "Have small meals often rather than three big ones, and try not to eat in the 3 hours before bed.",
      "Sit up straight while you eat and for a while afterwards.",
      "Cut down on caffeine and on rich, spicy or fatty food.",
      "Prop your head and shoulders up in bed, and try sleeping on your left side.",
      "A pharmacist can suggest an antacid that's suitable in pregnancy. Tell them you're pregnant, and don't take it within 2 hours of iron or folic acid.",
    ],
    callIf: ["it isn't getting better with these changes", "you have difficulty swallowing, a cough that won't go, or you're losing weight"],
    urgentIf: ["heartburn that doesn't go away with antacids comes with a headache, swelling or feeling very unwell (it can be a sign of pre-eclampsia)"],
  },
  {
    id: "tired", label: "Tiredness", emoji: "😴", source: `${NHS}/common-symptoms/tiredness/`,
    tips: [
      "It's very common, especially in the first 12 weeks. Rest whenever you can.",
      "Put your feet up during the day and say yes to offers of help.",
      "Eat well and keep up a little gentle activity, like a short walk. It can help you feel less tired.",
    ],
  },
  {
    id: "sleep", label: "Trouble sleeping", emoji: "🌙", source: `${NHS}/common-symptoms/tiredness/`,
    tips: [
      "Go to sleep on your side (left or right). After 28 weeks this is the safest way to sleep. If you wake up on your back, just turn over.",
      "Support your bump with pillows, and try a pillow between your knees.",
      "Wind down before bed. Relaxation and breathing exercises can help.",
      "Avoid tea, coffee and cola in the evening, and try not to nap late in the day.",
    ],
    callIf: ["poor sleep comes with feeling hopeless or losing interest in things (it can be a sign of depression)"],
  },
  {
    id: "dreams", label: "Strange dreams", emoji: "💭", source: `${NHS}/common-symptoms/tiredness/`,
    tips: [
      "Vivid dreams about the baby, labour or birth are completely normal.",
      "Talking them through with your partner or midwife can help, and dreaming something doesn't mean it will happen.",
      "Relaxation and breathing exercises can ease any worries.",
    ],
  },
  {
    id: "back", label: "Back pain", emoji: "🧍‍♀️", source: `${NHS}/common-symptoms/back-pain/`,
    tips: [
      "Bend your knees and keep your back straight when you pick something up, and avoid heavy lifting.",
      "Move your feet as you turn, so you don't twist your spine.",
      "Wear flat shoes, and split shopping between two bags.",
      "Sit with your back straight and well supported, and rest when you can.",
      "A warm bath or a massage can help, and so can pregnancy yoga or aquanatal classes.",
      "Paracetamol is usually fine in pregnancy, unless your midwife or GP has said otherwise. Follow the packet.",
    ],
    callIf: ["the pain is very bad", "you're in your second or third trimester (it can be a sign of early labour)", "you also have a fever, bleeding, pain when you wee, or pain in your side under your ribs"],
    urgentIf: ["you lose feeling in your legs, bottom or genitals (call an ambulance)"],
  },
  {
    id: "pelvic", label: "Pelvic pain (PGP or SPD)", emoji: "🦴", source: `${NHS}/common-symptoms/pelvic-pain/`,
    tips: [
      "Keep active, but avoid what makes it worse, and rest when you can.",
      "Wear supportive shoes and keep your weight even on both legs.",
      "Sit down to get dressed, keep your knees together getting in and out of the car, and sleep with a pillow between your legs.",
      "Avoid sitting or standing for long periods, and go up and down stairs as little as you can.",
      "Mention it early: a physiotherapist can really help.",
    ],
    callIf: ["it's hard to move around, turn over in bed, get out of the car or use the stairs"],
  },
  {
    id: "headache", label: "Headaches", emoji: "🤕", source: `${NHS}/common-symptoms/headaches/`,
    tips: [
      "Drink plenty of fluids, get enough sleep and make time to rest and relax.",
      "Paracetamol is the first choice of painkiller in pregnancy, for the shortest time you need it. Ask a pharmacist, midwife or GP how much to take.",
      "Avoid ibuprofen and painkillers containing codeine unless a doctor prescribes them.",
    ],
    urgentIf: ["a severe headache", "blurred vision or flashing lights", "pain just below your ribs", "being sick", "sudden swelling of your face, hands or feet (these can be signs of pre-eclampsia)"],
  },
  {
    id: "constipation", label: "Constipation", emoji: "🚽", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Eat plenty of fibre: wholemeal bread and cereals, fruit and vegetables, and beans and lentils.",
      "Drink plenty of water.",
      "Keep moving: regular gentle exercise helps.",
      "Iron supplements can make it worse. Ask your doctor whether you could manage without them or change to another type.",
    ],
  },
  {
    id: "cramp", label: "Leg cramps", emoji: "🦵", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Gentle exercise, especially ankle and leg movements, helps your circulation.",
      "Bend and stretch each foot up and down 30 times, then circle it 8 times each way.",
      "When a cramp comes, pull your toes up hard towards your ankle, or rub the muscle firmly.",
    ],
  },
  {
    id: "faint", label: "Feeling faint or dizzy", emoji: "💫", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Get up slowly after sitting or lying down, and take your time getting out of the bath.",
      "If you feel faint standing up, sit down quickly. If it doesn't pass, lie down on your side.",
      "If it happens lying on your back, turn onto your side.",
    ],
  },
  {
    id: "hot", label: "Feeling hot", emoji: "🥵", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Wear loose clothes in natural fabrics, which breathe better.",
      "Keep your room cool. A fan helps.",
      "Wash often to feel fresh.",
    ],
    callIf: ["you have a high temperature (38°C or above) or feel shivery, which can be a sign of infection"],
  },
  {
    id: "wee", label: "Needing to wee a lot", emoji: "💧", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Cut down on drinks late in the evening, but keep drinking plenty of water during the day.",
      "Later on, rocking backwards and forwards on the toilet can help you empty your bladder properly.",
    ],
    callIf: ["it hurts when you wee, or there's blood in your wee: it may be a urine infection, so contact your GP within 24 hours"],
  },
  {
    id: "leaks", label: "Leaking when you laugh or sneeze", emoji: "😅", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "It's really common, and often temporary.",
      "Pelvic floor exercises strengthen the muscles around your bladder. Little and often, every day.",
    ],
    callIf: ["it's bothering you: your midwife or doctor can help"],
  },
  {
    id: "swelling", label: "Swollen ankles, feet or fingers", emoji: "🦶", source: `${NHS}/common-symptoms/swollen-ankles-feet-and-fingers/`,
    tips: [
      "Avoid standing for long periods, and rest with your feet up whenever you can.",
      "Wear comfortable shoes and socks with nothing tight that pinches.",
      "Take regular walks, and try foot exercises: bend and stretch each foot 30 times, then circle it 8 times each way.",
    ],
    urgentIf: ["sudden swelling of your face, hands or feet", "a very bad headache, or problems with your vision", "severe pain just below your ribs", "feeling very unwell or being sick (these can be signs of pre-eclampsia)"],
  },
  {
    id: "veins", label: "Varicose veins", emoji: "🩵", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Avoid standing for long, and try not to cross your legs when you sit.",
      "Put your legs up as often as you can, and raise them a little in bed with a pillow under your ankles.",
      "Compression stockings from a pharmacy can ease the discomfort.",
      "Walking, swimming and foot exercises help your circulation.",
    ],
  },
  {
    id: "piles", label: "Piles", emoji: "🍑", source: `${NHS}/common-symptoms/piles/`,
    tips: [
      "Keep things soft and regular with plenty of fibre and water.",
      "Avoid straining, and avoid standing or sitting for long periods.",
      "A cloth wrung out in iced water, held gently against them, can ease the pain.",
      "Use moist toilet paper, and pat rather than rub.",
      "Check with a pharmacist, midwife or doctor before using any cream.",
    ],
  },
  {
    id: "tummy", label: "Tummy pains or stretching", emoji: "🤰", source: `${NHS}/common-symptoms/stomach-pain/`,
    tips: [
      "Mild pain that eases when you change position, rest, do a poo or pass wind is usually nothing to worry about.",
      "A sharp cramp low on one side is often your ligaments stretching to support your bump.",
    ],
    urgentIf: ["bleeding or spotting", "regular cramps or tightenings", "unusual discharge or fluid leaking", "pain or burning when you wee", "pain that's severe or doesn't settle after 30 to 60 minutes of rest"],
  },
  {
    id: "itch", label: "Itchy skin", emoji: "🪶", source: `${NHS}/complications/itching-and-intrahepatic-cholestasis/`,
    tips: [
      "Pat or tap your skin instead of scratching, and keep your nails short.",
      "Have cool or warm (not hot) baths or showers, for no more than 20 minutes.",
      "Use an unperfumed moisturiser regularly, and avoid perfumed soaps and products.",
      "Wear loose cotton clothes.",
      "Go easy on spicy food and caffeine, which can make itching worse.",
      "A pharmacist can suggest creams that are safe in pregnancy.",
    ],
    urgentIf: ["the itching is very bad, worse at night, or on the palms of your hands or soles of your feet (it can be a sign of a liver condition called ICP, which needs treatment)"],
  },
  {
    id: "stretch", label: "Stretch marks", emoji: "〰️", source: `${NHS}/common-symptoms/stretch-marks/`,
    tips: [
      "They're very common (around 8 in 10 women get them) and they aren't harmful.",
      "They usually fade to paler lines after the birth.",
      "There's no good evidence that creams prevent or remove them, so don't spend a fortune.",
    ],
  },
  {
    id: "skin", label: "Skin changes", emoji: "✨", source: `${NHS}/common-symptoms/common-health-problems/`,
    tips: [
      "Darker patches, a dark line down your tummy and darker nipples are all normal, and usually fade after the birth.",
      "You may burn more easily: use a high-factor sunscreen and don't stay in the sun long.",
    ],
  },
  {
    id: "discharge", label: "More discharge", emoji: "🩲", source: `${NHS}/common-symptoms/vaginal-discharge/`,
    tips: [
      "More discharge is normal in pregnancy: it helps protect against infection.",
      "Loose cotton underwear helps, and so does avoiding perfumed soaps and bath products.",
    ],
    callIf: ["it smells unpleasant, is green or yellow, or you're itchy, sore or it hurts to wee (it may be an infection)"],
    urgentIf: ["any bleeding", "fluid leaking from your vagina"],
  },
  {
    id: "thrush", label: "Thrush", emoji: "🌸", source: `${NHS}/common-symptoms/thrush/`,
    tips: [
      "It's common in pregnancy and doesn't harm your baby.",
      "See your GP or midwife before using any treatment. Some thrush medicines aren't suitable in pregnancy.",
      "Loose cotton underwear and unperfumed products can help prevent it.",
    ],
  },
  {
    id: "breathless", label: "Feeling out of breath", emoji: "😮‍💨", source: `${NHS}/common-symptoms/pregnancy-symptoms-you-need-to-get-help-for/`,
    tips: [
      "It's common as your baby grows. Slow down, and take your time on stairs.",
    ],
    urgentIf: ["it comes on suddenly", "you're breathless lying down", "it comes with chest pain or dizziness"],
  },
  {
    id: "mood", label: "Low mood or worry", emoji: "🫶", source: `${NHS}/mental-health-in-pregnancy-and-after-the-birth/mental-health/`,
    tips: [
      "Lots of different feelings are natural in pregnancy.",
      "Talk to someone you trust: your partner, a friend, your midwife or your GP.",
      "Rest, eat well, and get a little fresh air and gentle exercise if you can.",
      "Your midwife can also tell you about support near you.",
    ],
    callIf: ["stress, anxiety or low mood are affecting your day-to-day life"],
    urgentIf: ["you have thoughts of harming yourself (call an ambulance or go to the emergency department)"],
  },
];

export const symptomById = (id?: string) => SYMPTOMS.find((s) => s.id === id);
/** The symptom a note is about, from its title (notes keep their title, not an id). */
export const symptomForTitle = (title?: string) => SYMPTOMS.find((s) => s.label.toLowerCase() === (title ?? "").trim().toLowerCase());

/** Craving ideas (food aversions too). */
export const CRAVING_IDEAS = [
  "Chocolate", "Ice cream", "Pickles", "Something sour", "Something spicy", "Salty snacks", "Citrus fruit", "Fresh fruit", "Cheese", "Chips",
  "Cold drinks", "Toast", "Pizza", "Sweets", "Can't stand the smell of…", "Went off coffee",
];

/** Where they're kept: notes with these sources (older notes used "Pregnancy" for both). */
export const SYMPTOM_SOURCE = "Symptom";
export const CRAVING_SOURCE = "Craving";
export const LEGACY_SOURCE = "Pregnancy";
/** An older note: a craving if its title says so, otherwise a symptom. */
export const legacyIsCraving = (title?: string) => /crav|can't stand|went off|smell of/i.test(title ?? "");

/** At the end of every set of tips, with the emergency number for where the phone is (see emergency.ts). */
export const symptomDisclaimer = (e: Emergency) =>
  `These tips are general information based on the NHS website. They aren't medical advice and don't replace your midwife, GP or doctor, who know you and your pregnancy. Every pregnancy is different, so check with a pharmacist, midwife or doctor before taking any medicine. If you're worried or something doesn't feel right, contact your midwife or doctor. In an emergency, ${callLine(e)}.`;
/** The same for the UK (where the tips come from), and wherever the phone's country isn't known. */
export const SYMPTOM_DISCLAIMER = symptomDisclaimer(emergencyFor("GB"));

/** For a symptom that isn't on the list: no tips, but a gentle nudge. */
export const otherSymptomNote = (e: Emergency) =>
  `We can't offer tips for this one, but you know your body best. If something doesn't feel right, or you're even a little worried, give your midwife or GP a ring. That's exactly what they're there for, and no question is too small. If it feels urgent, call your maternity unit, or ${callLine(e)}.`;
export const OTHER_SYMPTOM_NOTE = otherSymptomNote(emergencyFor("GB"));

/** Under the cravings. */
export const CRAVING_NOTE =
  "Cravings are part of the fun. Do check the foods to avoid in pregnancy, and if you ever find yourself craving things that aren't food, like ice, soil or chalk, mention it to your midwife or GP.";
export const FOODS_TO_AVOID_URL = `${NHS}/keeping-well/foods-to-avoid/`;
