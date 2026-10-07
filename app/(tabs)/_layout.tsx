import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { createMaterialTopTabNavigator, MaterialTopTabBarProps, MaterialTopTabNavigationEventMap, MaterialTopTabNavigationOptions } from "expo-router/js-top-tabs";
import type { ParamListBase, TabNavigationState } from "expo-router/react-navigation";
import { withLayoutContext } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveChild } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { useSwipeHeld } from "../../src/lib/swipeGuard";
import { StatusBar } from "expo-status-bar";
import { TopBar } from "../../src/components/Screen";
import { BrandScreen } from "../../src/components/BrandScreen";
import { TabName, isTab } from "../../src/lib/resume";
import { resume } from "../../src/lib/resumeStorage";
import { Fab, FAB_GAP } from "../../src/components/Fab";
import { Icon, IconName } from "../../src/components/Icon";
import { TYPE } from "../../src/theme";
import { withAlpha } from "../../src/lib/m3";
import { EntrySheet } from "../../src/components/EntrySheet";
import { EditPhotoSheet } from "../../src/components/EditPhotoSheet";
import { TagBrowserSheet } from "../../src/components/TagBrowser";
import { ShareSheet } from "../../src/components/ShareSheet";

/*
 * The tabs are a native pager (react-native-pager-view), the same kind of swipe you get in a photo gallery.
 * Every tab is mounted at once ("lazy: false"), so while you drag, the next tab is already there beside the current one
 * and slides in with your finger â€” nothing is loaded or replaced when you let go. Each tab keeps its own scroll position.
 * Tapping the bar scrolls the same pager. The bar itself follows the drag too: its indicator and highlights are driven by
 * the pager's live position, so they move as the pages move instead of jumping when the swipe ends.
 */
const { Navigator } = createMaterialTopTabNavigator();
const Tabs = withLayoutContext<MaterialTopTabNavigationOptions, typeof Navigator, TabNavigationState<ParamListBase>, MaterialTopTabNavigationEventMap>(Navigator);

const TABS = [
  { name: "index", title: "Home", icon: "nav-home" },
  { name: "milestones", title: "Milestones", icon: "nav-milestones" },
  { name: "growth", title: "Growth", icon: "nav-growth" },
  { name: "family", title: "Family", icon: "nav-family" },
  { name: "book", title: "Book", icon: "nav-book" },
  { name: "add", title: "Add", icon: "nav-add" },
] as const;

export const TAB_BAR_HEIGHT = 74;

function BottomBar({ state, navigation, position, restoreTo, onRestored }: MaterialTopTabBarProps & { restoreTo: TabName | null; onRestored: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // the pager's live position (0 â€¦ n-1, fractional while dragging); a plain value if a version doesn't provide one
  const fallback = useRef(new Animated.Value(state.index)).current;
  useEffect(() => fallback.setValue(state.index), [fallback, state.index]);
  const pos = position ?? fallback;

  // Remember which tab is showing, so the app can reopen on it. While the saved tab is still being restored (the pager starts on Home for
  // a moment) nothing is recorded, or the starting page would overwrite it.
  const current = state.routes[state.index]?.name;
  useEffect(() => {
    if (restoreTo) {
      if (current === restoreTo) onRestored();
      else navigation.navigate(restoreTo as never);
      return;
    }
    if (isTab(current)) resume.save({ tab: current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, restoreTo]);

  // Material 3 navigation bar: a tonal bar (no border); the selected destination gets a pill behind its icon, which fills in and grows as the page arrives
  return (
    <View style={{ flexDirection: "row", height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: t.bg2 }}>
      {state.routes.map((route: TabNavigationState<ParamListBase>["routes"][number], i: number) => {
        const tab = TABS.find((x) => x.name === route.name);
        const title = tab?.title ?? route.name;
        const range = [i - 1, i, i + 1];
        const on = pos.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: "clamp" });
        const off = pos.interpolate({ inputRange: range, outputRange: [1, 0, 1], extrapolate: "clamp" });
        const onPress = () => {
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (state.index !== i && !e.defaultPrevented) navigation.navigate(route.name as never); // scrolls the pager, same as a swipe
        };
        return (
          <Pressable key={route.key} onPress={onPress} android_ripple={{ color: withAlpha(t.ink, 0.08), borderless: true, radius: 34 }} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: state.index === i }} style={{ flex: 1, alignItems: "center", paddingTop: 12 }}>
            <View style={{ width: 52, height: 30, alignItems: "center", justifyContent: "center" }}>
              <Animated.View pointerEvents="none" style={{ position: "absolute", width: 52, height: 30, borderRadius: 15, backgroundColor: t.chipOn, opacity: on, transform: [{ scaleX: on.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }} />
              <Animated.View style={{ opacity: off }}><Icon name={(tab?.icon ?? "nav-home") as IconName} size={24} color={t.ink2} /></Animated.View>
              <Animated.View pointerEvents="none" style={{ position: "absolute", opacity: on }}><Icon name={`${tab?.icon ?? "nav-home"}-on` as IconName} size={24} color={t.onChipOn} /></Animated.View>
            </View>
            <View style={{ alignSelf: "stretch", marginTop: 4 }}>
              <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[TYPE.labelMedium, { fontSize: 11.5, textAlign: "center", color: t.ink2, opacity: off }]}>{title}</Animated.Text>
              <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} pointerEvents="none" style={[TYPE.labelMedium, { fontSize: 11.5, fontWeight: "700", textAlign: "center", color: t.ink, opacity: on, position: "absolute", left: 0, right: 0 }]}>{title}</Animated.Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const active = useActiveChild();
  const held = useSwipeHeld(); // a slider is being dragged: don't let it swipe the page

  // Open on the tab you were last on. The pager starts on Home, so it jumps (without animating) to the saved tab while a cover that
  // looks exactly like the splash screen hides that moment; a timeout guarantees the cover can never get stuck.
  const saved = useRef<TabName>(isTab(resume.get().tab) ? (resume.get().tab as TabName) : "index").current;
  const [restoring, setRestoring] = useState(saved !== "index");
  useEffect(() => {
    if (!restoring) return;
    const id = setTimeout(() => setRestoring(false), 1500);
    return () => clearTimeout(id);
  }, [restoring]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="dark" />
      <TopBar />{/* above the pager, so it stays still while the tabs slide */}
      <Tabs
        tabBarPosition="bottom"
        tabBar={(props: MaterialTopTabBarProps) => <BottomBar {...props} restoreTo={restoring ? saved : null} onRestored={() => setRestoring(false)} />}
        screenOptions={{
          swipeEnabled: !held, // off only while the player's slider is being dragged
          lazy: false, // every tab is mounted up front: neighbours are already there during the swipe
          animationEnabled: !restoring, // the jump to the saved tab is instant; normal swipes and taps animate as usual
          sceneStyle: { backgroundColor: t.bg }, // never a white gap between pages
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
        ))}
      </Tabs>

      {/* shared by every tab, so they exist once instead of once per tab */}
      {active ? <Fab bottom={TAB_BAR_HEIGHT + insets.bottom + FAB_GAP} /> : null}
      <EntrySheet />
      <EditPhotoSheet />
      <TagBrowserSheet />
      <ShareSheet />
      {restoring ? <View style={StyleSheet.absoluteFill}><BrandScreen /></View> : null}
    </View>
  );
}


