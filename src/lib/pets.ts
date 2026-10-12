/*
 * Pets: the kinds of pet, their breeds, their age in their own years (or their stage of life), their tricks and firsts, and how they're named
 * in the family. Pure, for tests.
 *
 * Age conversions, all rough guides:
 *  - dogs: 15 human years at one, 24 at two, then about 4 a year (small dogs), 5 (medium) or 6 (large): the AVMA's guideline, as quoted by
 *    Chewy and The Old Farmer's Almanac;
 *  - cats: 15 at one, 24 at two, then 4 a year: the AAHA, International Cat Care and AAFP guideline;
 *  - horses: about 6.5 years a year to the age of four, then 2.5: the age chart Zoetis (then Pfizer Animal Health) published.
 * Hamsters, birds and snakes have no reliable conversion (a budgie and a parrot live very different lives), so they show a stage of life.
 */

export type Species = "dog" | "cat" | "bird" | "hamster" | "snake" | "horse";
export type DogSize = "small" | "medium" | "large";
export type PetOrigin = "breeder" | "shelter" | "friend" | "found" | "shop" | "other";

export interface SpeciesInfo { id: Species; label: string; emoji: string; noun: string; breeds: string[] }

export const SPECIES: SpeciesInfo[] = [
  { id: "dog", label: "Dog", emoji: "🐶", noun: "dog", breeds: ["Mixed breed", "Labrador Retriever", "Golden Retriever", "German Shepherd", "French Bulldog", "Bulldog", "Poodle", "Beagle", "Dachshund", "Cocker Spaniel", "Border Collie", "Cavapoo", "Cockapoo", "Shih Tzu", "Chihuahua", "Jack Russell", "Pomeranian", "Husky", "Staffordshire Bull Terrier", "Boxer", "Yorkshire Terrier", "Maltese", "Pug", "Canaan Dog"] },
  { id: "cat", label: "Cat", emoji: "🐱", noun: "cat", breeds: ["Mixed breed", "Domestic shorthair", "Domestic longhair", "British Shorthair", "Maine Coon", "Ragdoll", "Siamese", "Persian", "Bengal", "Sphynx", "Scottish Fold", "Norwegian Forest Cat", "Russian Blue"] },
  { id: "bird", label: "Bird", emoji: "🦜", noun: "bird", breeds: ["Budgie", "Cockatiel", "Lovebird", "African Grey", "Amazon parrot", "Macaw", "Cockatoo", "Conure", "Parrotlet", "Canary", "Finch"] },
  { id: "hamster", label: "Hamster", emoji: "🐹", noun: "hamster", breeds: ["Syrian", "Roborovski", "Campbell's dwarf", "Winter white", "Chinese"] },
  { id: "snake", label: "Snake", emoji: "🐍", noun: "snake", breeds: ["Corn snake", "Ball python", "King snake", "Milk snake", "Boa", "Hognose"] },
  { id: "horse", label: "Horse", emoji: "🐴", noun: "horse", breeds: ["Pony", "Arabian", "Thoroughbred", "Quarter Horse", "Warmblood", "Cob", "Shetland", "Welsh", "Appaloosa", "Friesian", "Andalusian"] },
];
export const speciesInfo = (s?: string): SpeciesInfo => SPECIES.find((x) => x.id === s) ?? SPECIES[0];

export const ORIGINS: { id: PetOrigin; label: string }[] = [
  { id: "breeder", label: "A breeder" }, { id: "shelter", label: "A shelter or rescue" }, { id: "friend", label: "Family or friends" },
  { id: "found", label: "We found them" }, { id: "shop", label: "A pet shop" }, { id: "other", label: "Somewhere else" },
];

/** Whole years and months between two dates. */
function yearsMonths(from: string, to: string): { years: number; months: number; totalMonths: number } {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  if (months < 0) months = 0;
  return { years: Math.floor(months / 12), months: months % 12, totalMonths: months };
}

/** Their age in human-style years: their own years (dogs, cats, horses), as one number, from their age in months. */
export function ownYears(species: Species, totalMonths: number, dogSize: DogSize = "medium"): number | null {
  const y = totalMonths / 12;
  if (species === "dog" || species === "cat") {
    if (y <= 1) return 15 * y;
    if (y <= 2) return 15 + 9 * (y - 1);
    const perYear = species === "cat" ? 4 : dogSize === "small" ? 4 : dogSize === "large" ? 6 : 5;
    return 24 + perYear * (y - 2);
  }
  if (species === "horse") return y <= 4 ? 6.5 * y : 26 + 2.5 * (y - 4);
  return null;
}

/** A stage of life, for pets without a reliable conversion (and shown beside the years for the others too). */
export function lifeStage(species: Species, totalMonths: number): string {
  const m = totalMonths;
  switch (species) {
    case "hamster": return m < 1 ? "Baby" : m < 4 ? "Young" : m < 18 ? "Adult" : "Senior";
    case "bird": return m < 3 ? "Chick" : m < 12 ? "Young" : "Adult";
    case "snake": return m < 12 ? "Hatchling" : m < 36 ? "Young" : "Adult";
    case "horse": return m < 12 ? "Foal" : m < 48 ? "Young" : m < 15 * 12 ? "Adult" : "Senior";
    case "cat": return m < 6 ? "Kitten" : m < 24 ? "Young" : m < 11 * 12 ? "Adult" : "Senior";
    default: return m < 12 ? "Puppy" : m < 24 ? "Young" : m < 8 * 12 ? "Adult" : "Senior";
  }
}

export interface PetAge {
  human: string; // "2 years, 3 months" (with "about" when the birthday is a guess)
  own?: string; // "about 24 in dog years"
  stage: string; // "Adult"
}

/** "2 years, 3 months" and, beside it, "about 24 in dog years" (or the stage of life when there's no conversion). */
export function petAge(p: { species?: string; birth: string; birthApprox?: boolean; dogSize?: DogSize }, today: string): PetAge {
  const species = speciesInfo(p.species).id;
  const { years, months, totalMonths } = yearsMonths(p.birth, today);
  const parts = [years ? `${years} year${years === 1 ? "" : "s"}` : "", months || !years ? `${months} month${months === 1 ? "" : "s"}` : ""].filter(Boolean);
  const human = `${p.birthApprox ? "about " : ""}${parts.join(", ")}`;
  const own = ownYears(species, totalMonths, p.dogSize);
  return { human, ...(own != null && totalMonths >= 1 ? { own: `about ${Math.round(own)} in ${speciesInfo(species).noun} years` } : {}), stage: lifeStage(species, totalMonths) };
}

/** "Our dog Rex": how a pet is listed in the children's families. */
export const petRelation = (species?: string) => `Our ${speciesInfo(species).noun}`;

/** Tricks to tick off, by kind of pet. */
export const TRICK_IDEAS: Record<Species, string[]> = {
  dog: ["Sit", "Paw", "Lie down", "Come", "Stay", "Roll over", "High five", "Spin", "Toilet trained", "Walks on a lead", "Crate trained", "Fetch"],
  cat: ["Comes when called", "Uses the cat flap", "High five", "Sits on command", "Uses the scratching post", "Walks on a harness", "Fetch"],
  bird: ["Steps up", "Says their name", "Whistles a tune", "Waves", "Comes to the hand", "Turns around", "Says hello"],
  hamster: ["Comes to the hand", "Uses the wheel", "Eats from the hand", "Climbs onto the hand"],
  snake: ["Handled calmly", "First feed with us", "Comes out to explore"],
  horse: ["First ride", "Walk, trot and canter", "Loads into the trailer", "First jump", "Lifts their feet", "Ground tied"],
};

/** Firsts worth keeping, by kind of pet. */
export const PET_FIRST_IDEAS: Record<Species, string[]> = {
  dog: ["First walk", "First night home", "First bath", "First vet visit", "First time at the beach", "First snow", "First haircut", "First holiday", "First birthday party"],
  cat: ["First night home", "First vet visit", "First time outside", "First bird spotted", "First cuddle on the sofa", "First birthday"],
  bird: ["First word", "First flight in the house", "First bath", "First vet visit", "First new toy"],
  hamster: ["First night home", "First run on the wheel", "First time in the ball", "First vet visit"],
  snake: ["First shed with us", "First feed", "First vet visit", "First time handled"],
  horse: ["First ride", "First show", "First rosette", "First hack out", "First time at the beach", "First vet visit"],
};

/** Health entries for a pet (on the Health tab, instead of development). */
export const PET_HEALTH_KINDS = [
  { id: "vet", label: "Vet visit", emoji: "🩺" },
  { id: "vaccination", label: "Vaccination", emoji: "💉" },
  { id: "parasite", label: "Flea and worm", emoji: "🐛" },
  { id: "medicine", label: "Medicine", emoji: "💊" },
  { id: "operation", label: "Operation", emoji: "🏥" },
  { id: "grooming", label: "Groomer or farrier", emoji: "✂️" },
  { id: "other", label: "Other", emoji: "📝" },
] as const;

/** The pet-only notice under health notes. */
export const PET_HEALTH_NOTE = "For keeping track only: this isn't veterinary advice. Your vet knows your pet, so follow their schedule for vaccines and treatments, and call them if you're worried.";
