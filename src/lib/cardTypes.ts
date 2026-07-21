import type { Doc } from "@convex/_generated/dataModel";

export const TYPE_GROUPS = [
  "Creatures",
  "Planeswalkers",
  "Artifacts",
  "Enchantments",
  "Lands",
  "Other",
] as const;

export type TypeGroup = (typeof TYPE_GROUPS)[number];

/**
 * Bucket a card by its Scryfall type line. Order matters for multi-type cards:
 * an Artifact Creature belongs with the creatures, and an Artifact Land reads as
 * a land. Cards whose type hasn't been backfilled yet land in "Other".
 */
export function groupFor(typeLine?: string): TypeGroup {
  const line = (typeLine ?? "").toLowerCase();
  if (line.includes("creature")) return "Creatures";
  if (line.includes("planeswalker")) return "Planeswalkers";
  if (line.includes("land")) return "Lands";
  if (line.includes("artifact")) return "Artifacts";
  if (line.includes("enchantment")) return "Enchantments";
  return "Other";
}

/** Group cards into type sections, dropping any section that ends up empty. */
export function groupCards(cards: Doc<"cards">[]) {
  const buckets = new Map<TypeGroup, Doc<"cards">[]>();
  for (const card of cards) {
    const group = groupFor(card.typeLine);
    const existing = buckets.get(group);
    if (existing) existing.push(card);
    else buckets.set(group, [card]);
  }

  return TYPE_GROUPS.filter((group) => buckets.has(group)).map((group) => ({
    group,
    cards: buckets
      .get(group)!
      .sort((a, b) => a.position - b.position),
  }));
}
