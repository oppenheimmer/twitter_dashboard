/**
 * CLI entry point for word-cloud generation.
 *
 * Delegates to the shared regenerateWordCloud() function in
 * src/lib/word-cloud-generator.ts, which is also used by the server
 * when word-cloud.json is marked stale.
 *
 * Run: npm run generate-word-cloud
 */

import { regenerateWordCloud } from '../lib/word-cloud-generator'

regenerateWordCloud({ verbose: true })
