import type {OrchestraLensWork} from './workCatalog';

/** Listener-facing metadata comes from the selected catalog work, never a tour-specific literal. */
export const formatHighlightsTourWork = (work: Pick<OrchestraLensWork, 'composer' | 'workTitle' | 'movementNumber'>): string =>
  `${work.composer} · ${work.workTitle.toUpperCase()} · ${work.movementNumber}`;
