import React from "react";
import Slider from "@react-native-community/slider";

type Props = React.ComponentProps<typeof Slider> & { label: string; valueText?: string };

/*
 * The website's slider: the same slider, made usable without a mouse or a finger. It can be reached with Tab, says its name and value to
 * screen readers (role "slider"), and moves with the arrow keys (Page Up and Down for bigger steps, Home and End for the ends).
 */
export function AppSlider({ label, valueText, ...rest }: Props) {
  const min = rest.minimumValue ?? 0;
  const max = rest.maximumValue ?? 1;
  const now = rest.value ?? min;
  const step = rest.step || (max - min) / 50 || 1;
  const set = (v: number) => {
    const next = Math.max(min, Math.min(max, Math.round(v / step) * step));
    rest.onValueChange?.(next);
    rest.onSlidingComplete?.(next);
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const moves: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
    if (e.key in moves) { e.preventDefault(); set(now + moves[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); set(min); }
    else if (e.key === "End") { e.preventDefault(); set(max); }
  };
  const extra = {
    role: "slider", tabIndex: 0, "aria-label": label, "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": Math.round(now * 100) / 100,
    ...(valueText ? { "aria-valuetext": valueText } : {}), onKeyDown,
  };
  return <Slider {...rest} {...(extra as object)} />;
}
