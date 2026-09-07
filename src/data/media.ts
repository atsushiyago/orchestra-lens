import {brahmsMovement4Recording} from './performanceAlignment';

// The deployed object is private at S3 and publicly reachable only through this
// CloudFront HTTPS URL. The recording identity remains explicit so a later URL
// change cannot silently replace the selected Brahms performance.
export const mediaSource = {
  recordingId: brahmsMovement4Recording.id,
  uri: 'https://d25q8u9cz8hosu.cloudfront.net/media/brahms-op68-movement4-musopen-cc0.m4a',
  diagnosticUri: undefined,
} as const;
