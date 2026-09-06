import type {ScoreEvent} from '../types/score';

export const work = {
  composer: 'BRAHMS', title: 'SYMPHONY NO. 1',
  movement: 'IV. Adagio – Allegro non troppo',
  timingStatus: 'Demo video · Placeholder timing',
};
// Seconds are deliberately independent of measure numbers. Replace these with
// annotations for the exact performance edit used in media.ts, including lead-in.
export const scoreEvents: readonly ScoreEvent[] = [
  {startTime: 5, endTime: 20, measure: 30, title: 'Alphorn Theme', description: 'The horn introduces an important musical idea.', primaryInstruments: ['Horn'], eventType: 'theme'},
  {startTime: 20, endTime: 40, measure: 62, title: 'Main Theme', description: 'The main Allegro theme begins.', primaryInstruments: ['Violins'], eventType: 'theme'},
  {startTime: 40, endTime: 60, measure: 285, title: 'Theme Transformation', description: 'Earlier material returns in a transformed form.', primaryInstruments: ['Horn'], eventType: 'theme_return'},
  {startTime: 60, endTime: 80, measure: 407, title: 'Chorale Returns', description: 'The brass chorale returns near the climax.', primaryInstruments: ['Brass'], eventType: 'chorale'},
];
