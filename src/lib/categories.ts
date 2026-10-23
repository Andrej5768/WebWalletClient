import type { Schemas } from '../api/client';
import { autoColor, type PaletteColor } from './palette';

export type Category = Schemas['CategoryResponse'];

/** A category with its group resolved: path label, and icon and color inherited from the parent. */
export interface CategoryInfo {
  id: number;
  name: string;
  /** "Їжа › Продукти" for a subcategory, the name for a group. */
  path: string;
  kind: 'EXPENSE' | 'INCOME';
  icon: string | null;
  color: PaletteColor | null;
  parentId: number | null;
  archived: boolean;
  necessity: 'NEEDS' | 'WANTS' | null;
  /** The budget rest of the category moves to the next month (an envelope) instead of expiring with it. */
  carryOver: boolean;
  /** The category's own values, without what it inherits from its group; these are what is edited. */
  own: {
    icon: string | null;
    color: PaletteColor | null;
    necessity: 'NEEDS' | 'WANTS' | null;
    archived: boolean;
  };
}

/** Flattens the category tree, groups first followed by their subcategories. */
export function flattenCategories(tree: Category[]): CategoryInfo[] {
  const result: CategoryInfo[] = [];
  const visit = (category: Category, parent: CategoryInfo | null) => {
    const info: CategoryInfo = {
      id: category.id!,
      name: category.name ?? '',
      path: parent ? `${parent.name} › ${category.name}` : (category.name ?? ''),
      kind: category.kind ?? 'EXPENSE',
      icon: category.icon ?? parent?.icon ?? null,
      // A group without a color gets one of the palette by its id; subcategories take the color of the group
      color: category.color ?? parent?.color ?? autoColor(category.id!),
      parentId: parent?.id ?? null,
      archived: !!category.archived || !!parent?.archived,
      necessity: category.necessity ?? parent?.necessity ?? null,
      carryOver: !!category.carryOver,
      own: {
        icon: category.icon ?? null,
        color: category.color ?? null,
        necessity: category.necessity ?? null,
        archived: !!category.archived,
      },
    };
    result.push(info);
    (category.children ?? []).forEach((child) => visit(child, info));
  };
  tree.forEach((category) => visit(category, null));
  return result;
}

/** Select data grouped by top-level category, without archived ones. */
export function categorySelectData(categories: CategoryInfo[], kind?: 'EXPENSE' | 'INCOME') {
  const visible = categories.filter((category) => !category.archived && (!kind || category.kind === kind));
  const groups = visible.filter((category) => category.parentId === null);
  return groups.map((group) => ({
    group: group.name,
    items: [group, ...visible.filter((category) => category.parentId === group.id)].map((category) => ({
      value: String(category.id),
      label: category.path,
    })),
  }));
}
