import type {SmartScoreAsset} from './smartScore';

/** Source-audited locations for the score-image assets. */
export const scoreAssetVerification: Readonly<Record<SmartScoreAsset, {
  targetMeasure: number;
  sourceMeasureStart: number;
  sourceMeasureEnd: number;
  parts: readonly string[];
}>> = {
  'm30-horn': {targetMeasure: 30, sourceMeasureStart: 26, sourceMeasureEnd: 30, parts: ['C Horn 1', 'C Horn 2']},
  'm30-flute': {targetMeasure: 30, sourceMeasureStart: 26, sourceMeasureEnd: 30, parts: ['Flute 1', 'Flute 2']},
  'm30-strings': {targetMeasure: 30, sourceMeasureStart: 26, sourceMeasureEnd: 30, parts: ['Violoncello', 'Contrabass']},
  'm62-violins': {targetMeasure: 62, sourceMeasureStart: 62, sourceMeasureEnd: 66, parts: ['Violin 1', 'Violin 2']},
  'm62-lower-strings': {targetMeasure: 62, sourceMeasureStart: 62, sourceMeasureEnd: 66, parts: ['Viola', 'Violoncello', 'Contrabass']},
  'm62-horn': {targetMeasure: 62, sourceMeasureStart: 62, sourceMeasureEnd: 66, parts: ['C Horn 1', 'C Horn 2']},
  'm290-horn': {targetMeasure: 290, sourceMeasureStart: 289, sourceMeasureEnd: 293, parts: ['C Horn 1', 'C Horn 2']},
  'm47-chorale': {targetMeasure: 47, sourceMeasureStart: 46, sourceMeasureEnd: 50, parts: ['Trombone 1', 'Trombone 2', 'Trombone 3']},
  'm407-chorale': {targetMeasure: 407, sourceMeasureStart: 407, sourceMeasureEnd: 412, parts: ['Trombone 1', 'Trombone 2', 'Trombone 3']},
};
