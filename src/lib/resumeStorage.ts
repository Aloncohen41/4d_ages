import AsyncStorage from "@react-native-async-storage/async-storage";
import { createResume } from "./resume";

/** The one shared "where I left off" record, stored on the phone. */
export const resume = createResume(AsyncStorage);
