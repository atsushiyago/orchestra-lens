import {highlightsTourCandidates} from '../hooks/useHighlightsTour';

export const listeningExperiences = [
  {id: 'full-movement', label: 'PLAY FULL MOVEMENT'},
  {id: 'highlights-tour', label: 'HIGHLIGHTS TOUR'},
] as const;

export const highlightsTourSummary = (count = highlightsTourCandidates.length): string =>
  `${count} recommended moments · about 3 minutes`;

/** Product UI never exposes development diagnostics. */
export const showDevelopmentControls = (debug: boolean): boolean => debug;
