export type ThemeLensRelationship = {
  currentMeasure: number;
  headline: string;
  firstHeard: {measure: number; instrument?: string; label: string};
  now: {measure: number; label: string};
};

/** Hand-authored relationships between cue moments; separate from score assets and UI. */
export const themeLensByMeasure: Readonly<Record<number, ThemeLensRelationship>> = {
  290: {
    currentMeasure: 290,
    headline: "YOU'VE HEARD THIS BEFORE",
    firstHeard: {measure: 30, instrument: 'Horn', label: 'Alphorn Theme'},
    now: {measure: 290, label: 'Transformed Return'},
  },
  407: {
    currentMeasure: 407,
    headline: "YOU'VE HEARD THIS BEFORE",
    firstHeard: {measure: 47, label: 'Chorale'},
    now: {measure: 407, label: 'Climactic Return'},
  },
};

export const getThemeLens = (measure?: number): ThemeLensRelationship | undefined =>
  measure === undefined ? undefined : themeLensByMeasure[measure];
