import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Page } from "../src/components/Page";
import { Avatar } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { TYPE } from "../src/theme";

/**
 * Settings → Who can see your memories: each child, opening that child's sharing screen (who can see the book, invites for the other parent
 * or a family member, remove and block). One place to learn, reached from here or from the child's profile.
 */
export default function AccessPage() {
  const t = useTheme();
  // filtered outside the store: a selector that returns a new list each time re-renders without end (and crashes the app)
  const allKids = useStore((s) => s.kids);
  const kids = useMemo(() => allKids.filter((k) => k.role !== "viewer"), [allKids]);
  const viewing = useMemo(() => allKids.filter((k) => k.role === "viewer"), [allKids]);
  return (
    <Page title="Who can see your memories">
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 10 }]}>
        Each child's book is seen only by the people you invite: the other parent, who sees and adds to everything, and family members, who
        see only the posts with the people you choose. Tap a child to see who has access, invite someone, or remove or block them.
      </Text>
      {kids.map((k) => (
        <Pressable key={k.id} onPress={() => router.push({ pathname: "/share", params: { child: k.id } })} accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, marginBottom: 8 }}>
          <Avatar child={k} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleMedium, { color: t.ink }]}>{k.name}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Who can see the book, and invite someone</Text>
          </View>
          <Icon name="chevron-right" size={22} color={t.ink2} />
        </Pressable>
      ))}
      {viewing.length ? (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>{viewing.map((k) => k.name).join(", ")}: shared with you to view. Only their family can invite others.</Text>
      ) : null}
      <Pressable onPress={() => router.push({ pathname: "/share", params: { mode: "join" } })} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: t.line, marginTop: 8 }}>
        <Icon name="user-plus" size={22} color={t.ink2} />
        <Text style={[TYPE.bodyLarge, { color: t.ink, flex: 1 }]}>Join a book with a code</Text>
        <Icon name="chevron-right" size={22} color={t.ink2} />
      </Pressable>
    </Page>
  );
}
