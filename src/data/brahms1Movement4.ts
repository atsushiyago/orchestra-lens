import type {ScoreEvent} from '../types/score';
import {alignedCueTime, brahmsMovement4PerformanceAlignment} from './performanceAlignment';

export const work = {
  composer: 'BRAHMS', title: 'SYMPHONY NO. 1',
  movement: 'IV. Adagio – Allegro non troppo',
  timingStatus: 'Brahms performance alignment staged',
};
// These cue windows belong to the CC0 Brahms performance identified in
// performanceAlignment.ts. The active media URL remains unchanged until the
// prepared AAC object has an approved HTTPS delivery location.
export const scoreEvents: readonly ScoreEvent[] = [
  {startTime: alignedCueTime(30), endTime: alignedCueTime(30) + 15, measure: 30, title: 'Alphorn Theme', description: 'The horn introduces an important musical idea.', primaryInstruments: ['Horn'], eventType: 'theme'},
  {startTime: alignedCueTime(62), endTime: alignedCueTime(62) + 15, measure: 62, title: 'Main Theme', description: 'The main Allegro theme begins.', primaryInstruments: ['Violins'], eventType: 'theme'},
  {startTime: alignedCueTime(290), endTime: alignedCueTime(290) + 15, measure: 290, title: 'Theme Transformation', description: 'Earlier material returns in a transformed form.', primaryInstruments: ['Horn'], eventType: 'theme_return'},
  {startTime: alignedCueTime(407), endTime: alignedCueTime(407) + 15, measure: 407, title: 'Chorale Returns', description: 'The brass chorale returns near the climax.', primaryInstruments: ['Brass'], eventType: 'chorale'},
];

export {brahmsMovement4PerformanceAlignment};
