import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Child, Memory } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Reaction, reactionCounts, react, useReactions } from "../lib/reactions";
import { accountName, useSession } from "../lib/supabase";
import { TYPE } from "../theme";
import { Btn, Input } from "./ui";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
const NONE: Reaction[] = [];

/** Under a post on Home: how many hearts and comments it has (nothing when it has none). */
export function ReactionSummary({ memoryId, onPress }: { memoryId: string; onPress: () => void }) {
  const t = useTheme();
  const list = useReactions((s) => s.byMemory[memoryId] ?? NONE);
  const { hearts, comments } = reactionCounts(list);
  if (!hearts && !comments) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr("{0} hearts, {1} comments", [hearts, comments])} style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
      {hearts ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="heart" size={15} color={t.accent} /><Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{hearts}</Text></View> : null}
      {comments ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="message-circle" size={15} color={t.ink2} /><Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{tr("{0} comment{1}", [comments, comments === 1 ? "" : "s"])}</Text></View> : null}
    </Pressable>
  );
}

/**
 * In an opened post: everyone's hearts and comments, and your own (one per person per post: a heart, a comment, or both, which you can change
 * or take back). Only for books kept in an account (not the sample family).
 */
export function Reactions({ memory, child }: { memory: Memory; child: Child }) {
  const t = useTheme();
  const session = useSession();
  const preview = useStore((s) => s.preview);
  const list = useReactions((s) => s.byMemory[memory.id] ?? NONE);
  const mine = list.find((r) => r.userId === session?.user.id);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!session || preview || !child.shared) return null;
  const others = list.filter((r) => r !== mine);
  const name = accountName(session);

  const send = async (heart: boolean, text: string) => {
    setBusy(true); setErr("");
    try {
      await react(child.id, memory.id, name, heart, text);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const hearted = !!mine?.heart;

  return (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={() => send(!hearted, mine?.comment ?? "")} disabled={busy} accessibilityRole="button" aria-pressed={hearted} accessibilityLabel={hearted ? tr("Take back your heart") : tr("Leave a heart")}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: hearted ? t.accent : t.line, backgroundColor: hearted ? t.accentSoft : "transparent" }}>
          <Icon name="heart" size={18} color={hearted ? t.accent : t.ink3} />
          <Text style={[TYPE.labelLarge, { color: hearted ? t.onAccentSoft : t.ink2 }]}>{reactionCounts(list).hearts || ""} {hearted ? tr("Loved") : tr("Love")}</Text>
        </Pressable>
        {!mine?.comment && !editing ? (
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: t.line }}>
            <Icon name="message-circle" size={18} color={t.ink2} />
            <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>{tr("Comment")}</Text>
          </Pressable>
        ) : null}
      </View>

      {others.filter((r) => r.comment.trim()).map((r) => (
        <View key={r.userId} style={{ marginTop: 10 }}>
          <Text style={[TYPE.labelLarge, { color: t.ink }]}>{r.author}{r.heart ? "  " : ""}{r.heart ? <Icon name="heart" size={12} color={t.accent} /> : null}</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{r.comment}</Text>
        </View>
      ))}

      {mine?.comment && !editing ? (
        <View style={{ marginTop: 10 }}>
          <Text style={[TYPE.labelLarge, { color: t.ink }]}>{tr("You")}</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{mine.comment}</Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
            <Pressable onPress={() => { setComment(mine.comment); setEditing(true); }} hitSlop={6}><Text style={[TYPE.labelMedium, { color: t.accentDeep }]}>{tr("Edit")}</Text></Pressable>
            <Pressable onPress={() => send(hearted, "")} hitSlop={6}><Text style={[TYPE.labelMedium, { color: t.danger }]}>{tr("Delete")}</Text></Pressable>
          </View>
        </View>
      ) : null}

      {editing ? (
        <View style={{ marginTop: 10 }}>
          <Input value={comment} onChangeText={setComment} placeholder={tr("Your comment, as {0}", [name])} multiline maxLength={500} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn label={tr("Cancel")} kind="soft" onPress={() => { setEditing(false); setComment(mine?.comment ?? ""); }} style={{ flex: 1 }} />
            <Btn label={busy ? tr("Saving…") : tr("Post")} onPress={() => send(hearted, comment)} disabled={busy || !comment.trim()} style={{ flex: 1 }} />
          </View>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>{tr("One comment each per post. You can change it any time.")}</Text>
        </View>
      ) : null}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 8 }}>{err}</Text> : null}
    </View>
  );
}
