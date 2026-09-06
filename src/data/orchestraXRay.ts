export type OrchestraXRayEmphasis = 'primary' | 'secondary' | 'upcoming' | 'supporting';

export type OrchestraXRayRole = {
  instrument: 'Horn' | 'Strings' | 'Flute' | 'Violins' | 'Lower Strings';
  role: string;
  emphasis: OrchestraXRayEmphasis;
};

/**
 * Hand-authored musical roles keyed by the score cue's measure number.
 * This stays independent of presentation and can later be replaced by
 * score-analysis output without changing Score Peek.
 */
export const orchestraXRayByMeasure: Readonly<Record<number, readonly OrchestraXRayRole[]>> = {
  30: [
    {instrument: 'Horn', role: 'Main Theme', emphasis: 'primary'},
    {instrument: 'Strings', role: 'Harmonic Support', emphasis: 'secondary'},
    {instrument: 'Flute', role: 'Upcoming Theme Handoff', emphasis: 'upcoming'},
  ],
  62: [
    {instrument: 'Violins', role: 'Main Theme', emphasis: 'primary'},
    {instrument: 'Lower Strings', role: 'Harmonic Foundation', emphasis: 'secondary'},
    {instrument: 'Horn', role: 'Orchestral Support', emphasis: 'supporting'},
  ],
};

export const getOrchestraXRay = (measure?: number): readonly OrchestraXRayRole[] =>
  measure === undefined ? [] : orchestraXRayByMeasure[measure] ?? [];
