// The AWS Lambda function for the collector (PLAN Stage 2): `export const handler`, built into its own package.
import { makeCollectorHandler } from './make-collector.ts';

export const handler = makeCollectorHandler();
