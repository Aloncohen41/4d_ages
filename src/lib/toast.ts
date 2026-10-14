import { ToastAndroid } from "react-native";

/** A short message at the bottom of the screen (Android's toast on the phone; see toast.web.ts for the website). */
export function toast(message: string, long = false) {
  ToastAndroid.show(message, long ? ToastAndroid.LONG : ToastAndroid.SHORT);
}
