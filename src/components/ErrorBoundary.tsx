import React from "react";
import { Text, View } from "react-native";
import { Btn } from "./ui";

import { tr } from "../lib/i18n";
/**
 * A safety net around a screen: if something on it fails while drawing, the screen says so (with a way back and a way to try again) instead
 * of closing the app.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onBack?: () => void; colors: { bg: string; ink: string; ink3: string } }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { colors, onBack } = this.props;
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700", textAlign: "center" }}>{tr("Something went wrong")}</Text>
        <Text style={{ color: colors.ink3, textAlign: "center" }}>{tr("Nothing was lost. Try again, or go back.")}</Text>
        <Btn label={tr("Try again")} onPress={() => this.setState({ error: null })} />
        {onBack ? <Btn label={tr("Back")} kind="line" onPress={onBack} /> : null}
      </View>
    );
  }
}
