export type SmartScoreAsset =
  | 'm30-horn'
  | 'm30-flute'
  | 'm30-strings'
  | 'm62-violins'
  | 'm62-lower-strings'
  | 'm62-horn'
  | 'm290-horn'
  | 'm47-chorale'
  | 'm407-chorale';

export type SmartScorePart = {
  instrument: string;
  asset: SmartScoreAsset;
};

/**
 * Score excerpts are independent from their musical-role metadata. This lets
 * each cue select a TV-readable subset of the public-domain full score.
 */
export const smartScorePartsByMeasure: Readonly<Record<number, readonly SmartScorePart[]>> = {
  47: [
    {instrument: 'Trombones', asset: 'm47-chorale'},
  ],
  30: [
    {instrument: 'Horn', asset: 'm30-horn'},
    {instrument: 'Flute', asset: 'm30-flute'},
    {instrument: 'Strings', asset: 'm30-strings'},
  ],
  62: [
    {instrument: 'Violins', asset: 'm62-violins'},
    {instrument: 'Lower Strings', asset: 'm62-lower-strings'},
    {instrument: 'Horn', asset: 'm62-horn'},
  ],
  290: [
    {instrument: 'Horn', asset: 'm290-horn'},
  ],
  407: [
    {instrument: 'Brass', asset: 'm407-chorale'},
  ],
};

export const getSmartScoreParts = (measure?: number): readonly SmartScorePart[] =>
  measure === undefined ? [] : smartScorePartsByMeasure[measure] ?? [];
