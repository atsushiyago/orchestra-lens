export type FullMovementMenuAction = {pause: true; preservePosition: true; destination: 'entry'};

/** The menu transition deliberately leaves the mounted W3C player and its time intact. */
export const leaveFullMovementForMenu = (): FullMovementMenuAction => ({
  pause: true,
  preservePosition: true,
  destination: 'entry',
});
