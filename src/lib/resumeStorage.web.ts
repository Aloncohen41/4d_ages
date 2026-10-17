import AsyncStorage from "@react-native-async-storage/async-storage";
import { createResume } from "./resume";
import { cookiesAllow } from "./cookieConsent";

/** The website's "where I left off": only kept when preferences are allowed (see cookieConsent.web.ts). */
export const resume = createResume({
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => (cookiesAllow("preferences") ? AsyncStorage.setItem(k, v) : Promise.resolve()),
});
