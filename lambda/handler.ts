// AWS Lambda entry point (PLAN Stage 1c): the package exports exactly this, `handler`. See make-handler.ts.
import { makeHandler } from './make-handler.ts';

export const handler = makeHandler();
