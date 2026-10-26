import type { DiscoveryAdapter } from '../types';
import { canadianHeritageAdapter } from './canadian-heritage';
import { oacAdapter } from './oac';
import { tacAdapter } from './tac';

export const adapters: Record<string, DiscoveryAdapter> = {
	tac: tacAdapter,
	oac: oacAdapter,
	canadian_heritage: canadianHeritageAdapter,
};

export function getAdapter(key: string): DiscoveryAdapter | null {
	return adapters[key] ?? null;
}
