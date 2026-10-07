import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";

/** A sideways-scrolling row (chips, carousels). Inside the tab pager it keeps the drag for itself while it can still scroll. */
export function HScroll(props: ScrollViewProps) {
  return <ScrollView showsHorizontalScrollIndicator={false} nestedScrollEnabled {...props} horizontal />;
}
