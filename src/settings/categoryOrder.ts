import type { CategoryInfo } from '../lib/categories';

export interface OrderItem {
  id: number;
  parentId: number | null;
  sortOrder: number;
}

/**
 * Applies a drag of `activeId` onto `overId` within one kind of categories (in display order: each
 * group followed by its subcategories). Groups move among groups and take their subcategories along;
 * a subcategory moves anywhere below the first group and joins the group it lands in.
 * Returns the new order of every category of the list, or null when nothing changes.
 */
export function moveCategory(items: CategoryInfo[], activeId: number, overId: number): OrderItem[] | null {
  if (activeId === overId) return null;
  const active = items.find((item) => item.id === activeId);
  const over = items.find((item) => item.id === overId);
  if (!active || !over) return null;

  const groups = items.filter((item) => item.parentId === null).map((item) => item.id);
  const childrenOf = (groupId: number) =>
    items.filter((item) => item.parentId === groupId).map((item) => item.id);
  const children = new Map(groups.map((id) => [id, childrenOf(id)]));

  if (active.parentId === null) {
    const target = over.parentId ?? over.id;
    const from = groups.indexOf(active.id);
    const to = groups.indexOf(target);
    if (from === to) return null;
    groups.splice(from, 1);
    groups.splice(to, 0, active.id);
  } else {
    const source = children.get(active.parentId)!;
    source.splice(source.indexOf(active.id), 1);
    if (over.parentId === null) {
      // Dropped on a group row: moving down puts it first in that group, moving up puts it last
      // in the group above (or first in the very first group).
      const movingDown = items.indexOf(over) > items.indexOf(active);
      const index = groups.indexOf(over.id);
      const targetGroup = movingDown || index === 0 ? over.id : groups[index - 1]!;
      const list = children.get(targetGroup)!;
      if (movingDown || index === 0) list.unshift(active.id);
      else list.push(active.id);
    } else {
      const list = children.get(over.parentId)!;
      const overIndex = list.indexOf(over.id);
      const movingDown = items.indexOf(over) > items.indexOf(active);
      list.splice(movingDown && over.parentId === active.parentId ? overIndex + 1 : overIndex, 0, active.id);
    }
  }

  return groups.flatMap((groupId, groupIndex) => [
    { id: groupId, parentId: null, sortOrder: groupIndex },
    ...children.get(groupId)!.map((id, index) => ({ id, parentId: groupId, sortOrder: index })),
  ]);
}
