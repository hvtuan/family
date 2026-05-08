/**
 * Pure-function layout for FamilyTreeScroll.
 *
 * members[] → rows[] where each row = a generation; each row has units;
 * each unit = anchor member + optional spouse + child unit ids.
 *
 * Layout decisions:
 *   - rows ordered by gen ASC
 *   - units within row ordered by anchor.birth_order ASC
 *   - couples pair adjacent same-gen members where m.spouse points to a
 *     same-gen member who isn't already paired
 *   - parent of a unit's anchor → that anchor's parent unit; childIds
 *     bubble up to the parent unit
 */
import type { ClientMember } from "@/lib/members-client";

export interface LayoutUnit {
  anchor: ClientMember;
  spouse: ClientMember | null;
  childIds: string[];
}

export interface LayoutRow {
  gen: number;
  units: LayoutUnit[];
}

export function computeLayout(members: ClientMember[]): LayoutRow[] {
  if (members.length === 0) return [];

  const byId = new Map(members.map((m) => [m.id, m]));

  // Group by gen
  const byGen = new Map<number, ClientMember[]>();
  for (const m of members) {
    if (!byGen.has(m.gen)) byGen.set(m.gen, []);
    byGen.get(m.gen)!.push(m);
  }
  for (const list of byGen.values()) {
    list.sort((a, b) => (a.birthOrder ?? 99) - (b.birthOrder ?? 99));
  }

  // Build units within each gen
  const unitOfMember = new Map<string, string>(); // memberId → unit anchor id
  const unitsByGen = new Map<number, LayoutUnit[]>();

  for (const [gen, list] of byGen) {
    const used = new Set<string>();
    const units: LayoutUnit[] = [];

    for (const m of list) {
      if (used.has(m.id)) continue;
      const partner =
        m.spouse && byId.get(m.spouse) && byId.get(m.spouse)!.gen === gen && !used.has(m.spouse)
          ? byId.get(m.spouse)!
          : null;
      const unit: LayoutUnit = { anchor: m, spouse: partner, childIds: [] };
      units.push(unit);
      used.add(m.id);
      unitOfMember.set(m.id, m.id);
      if (partner) {
        used.add(partner.id);
        unitOfMember.set(partner.id, m.id);
      }
    }
    unitsByGen.set(gen, units);
  }

  // Wire parent→child linkages
  for (const m of members) {
    const parentMemberId = m.father ?? m.mother;
    if (!parentMemberId) continue;
    const parentUnitId = unitOfMember.get(parentMemberId);
    if (!parentUnitId) continue;
    const parentGen = byId.get(parentMemberId)!.gen;
    const parentUnits = unitsByGen.get(parentGen) ?? [];
    const parentUnit = parentUnits.find((u) => u.anchor.id === parentUnitId);
    if (parentUnit && !parentUnit.childIds.includes(m.id)) {
      parentUnit.childIds.push(m.id);
    }
  }

  // Compose rows
  const rows: LayoutRow[] = Array.from(unitsByGen.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([gen, units]) => ({ gen, units }));

  return rows;
}
