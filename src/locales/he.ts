/*
 * עברית: the app's words in Hebrew, by their English (see src/lib/i18n.ts). A word not here shows in English. Split by where the words
 * are: the pages, the components, and the built-in lists.
 */
import { heApp } from "./he/app";
import { heComponents1 } from "./he/components1";
import { heComponents2 } from "./he/components2";
import { heLists1 } from "./he/lists1";
import { heMilestones } from "./he/milestones";
import { heFoods } from "./he/foods";
import { hePets } from "./he/pets";
import { heSymptoms } from "./he/symptoms";
import { heClassics } from "./he/classics";
import { heExtra } from "./he/extra";

export const he: Record<string, string> = { ...heApp, ...heComponents1, ...heComponents2, ...heLists1, ...heMilestones, ...heFoods, ...hePets, ...heSymptoms, ...heClassics, ...heExtra };
