import React from "react";
import Slider from "@react-native-community/slider";

type Props = React.ComponentProps<typeof Slider> & {
  /** What the slider sets, read out by screen readers ("Zoom", "Where the 30 seconds start"). */
  label: string;
  /** Its value in words, when the number alone means little ("0:12", "12 May"). */
  valueText?: string;
};

/** The app's slider, with a name for screen readers. (On the website it also moves with the arrow keys; see AppSlider.web.tsx.) */
export function AppSlider({ label, valueText, ...rest }: Props) {
  return <Slider {...rest} accessibilityLabel={label} accessibilityValue={{ min: rest.minimumValue, max: rest.maximumValue, now: rest.value, text: valueText }} />;
}
