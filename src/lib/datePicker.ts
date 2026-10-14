import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

/** Asks for a date (or a time): Android's own picker on the phone; see datePicker.web.ts for the website. */
export const openDatePicker = (opts: Parameters<typeof DateTimePickerAndroid.open>[0]) => DateTimePickerAndroid.open(opts);
