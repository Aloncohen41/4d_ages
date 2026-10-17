import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

export const chooseFiles = async (_accept: string, _multiple: boolean): Promise<File[]> => [];

/** A place files can be dragged onto: the website only (see DropArea.web.tsx). On the phone, just what's inside. */
export function DropArea({ children, style }: { onFiles: (files: File[]) => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  return <View style={style}>{children}</View>;
}
