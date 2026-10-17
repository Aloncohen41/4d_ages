import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Page } from "../src/components/Page";
import { FirstFoodsView } from "../src/components/FirstFoodsView";
import { useShownChild } from "../src/lib/store";
import { tr } from "../src/lib/i18n";

/** Foods & allergens on its own page: "Food tried" in the + menu opens it, ready to tick a meal (see FirstFoodsView; it's also in Milestones). */
export default function FoodsPage() {
  const child = useShownChild();
  const params = useLocalSearchParams<{ meal?: string }>();
  if (!child) return null;
  return (
    <Page title={tr("{0}'s foods and allergens", [child.name])}>
      <FirstFoodsView startMeal={!!params.meal} />
    </Page>
  );
}
