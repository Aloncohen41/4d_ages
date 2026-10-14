import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Relative } from "../lib/types";
import { KINS, Kin, kinInfo, kinOf, sideChoices, sideIndex } from "../lib/kinship";
import { displayName } from "../lib/tags";
import { Label } from "./ui";

export interface KinValue { kin: Kin; side?: string; partnerId?: string; through?: string }

/**
 * How someone is related, for the family tree: who they are to the child, whose side they're on (each parent by name), who they're together
 * with, and for a cousin whose child they are (for a great-grandparent, whose parent). Filled in from the words already typed, and each can
 * be changed.
 */
export function KinshipFields({ value, onChange, family, childName, selfId }: {
  value: KinValue; onChange: (v: KinValue) => void; family: Relative[]; childName: string; selfId?: string;
}) {
  const t = useTheme();
  const others = family.filter((r) => r.id !== selfId);
  const info = kinInfo(value.kin);
  const me = { id: selfId ?? "new", relation: "", ...value };
  const mySide = sideIndex(me, others);
  const sameSide = (r: Relative) => !info.sided || mySide == null || sideIndex(r, others) === mySide;
  const chip = (key: string, label: string, on: boolean, press: () => void) => (
    <Pressable key={key} onPress={press} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: on ? t.chipOn : t.line, backgroundColor: on ? t.chipOn : t.card }}>
      <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
  const row = (children: React.ReactNode) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>;

  // who could be their partner: someone of their own generation (and side)
  const partners = others.filter((r) => kinInfo(kinOf(r)).row === info.row && info.row !== "other" && sameSide(r) && kinOf(r) !== "pet");
  // a cousin's parent: an aunt or uncle (on the same side); a great-grandparent's child: a grandparent (on the same side)
  const linkKin: Kin | null = value.kin === "cousin" ? "aunt-uncle" : value.kin === "great-grandparent" ? "grandparent" : null;
  const links = linkKin ? others.filter((r) => kinOf(r) === linkKin && sameSide(r)) : [];

  return (
    <View>
      <Label>{`Who are they to ${childName}?`}</Label>
      {row(KINS.filter((k) => k.id !== "pet").map((k) => chip(k.id, k.label, value.kin === k.id, () => onChange({ ...value, kin: k.id, through: undefined }))))}

      {info.sided ? (
        <>
          <Label>Whose side of the family?</Label>
          {row([
            ...sideChoices(others).map((c) => chip(c.id, c.label, value.side === c.id, () => onChange({ ...value, side: c.id, through: undefined }))),
            chip("unsure", "Not sure", !value.side, () => onChange({ ...value, side: undefined })),
          ])}
          <Text style={[TYPE.bodySmall, { color: t.ink4, marginTop: 6 }]}>So the family tree puts {value.kin === "grandparent" ? "each grandparent" : "them"} with the right parent.</Text>
        </>
      ) : null}

      {partners.length ? (
        <>
          <Label>Together with (optional)</Label>
          {row([
            ...partners.map((r) => chip(r.id, displayName(r), value.partnerId === r.id, () => onChange({ ...value, partnerId: value.partnerId === r.id ? undefined : r.id }))),
          ])}
        </>
      ) : null}

      {links.length ? (
        <>
          <Label>{value.kin === "cousin" ? "Whose child? (optional)" : "Whose parent? (optional)"}</Label>
          {row(links.map((r) => chip(r.id, displayName(r), value.through === r.id, () => onChange({ ...value, through: value.through === r.id ? undefined : r.id }))))}
        </>
      ) : null}
    </View>
  );
}
