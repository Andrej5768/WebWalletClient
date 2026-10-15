import {
  ArrowLeftRight,
  ChartColumn,
  LayoutGrid,
  SlidersHorizontal,
  Target,
  Upload,
  Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { DonutIcon } from '../components/icons';

export interface NavItem {
  path: string;
  /** Translation key under `nav.` */
  key: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const mainNav: NavItem[] = [
  { path: '/', key: 'dashboard', icon: LayoutGrid },
  { path: '/accounts', key: 'accounts', icon: Wallet },
  { path: '/transactions', key: 'transactions', icon: ArrowLeftRight },
  { path: '/budget', key: 'budget', icon: DonutIcon },
  { path: '/reports', key: 'reports', icon: ChartColumn },
  { path: '/goals', key: 'goals', icon: Target },
  { path: '/imports', key: 'imports', icon: Upload },
];

export const settingsNav: NavItem = { path: '/settings', key: 'settings', icon: SlidersHorizontal };
