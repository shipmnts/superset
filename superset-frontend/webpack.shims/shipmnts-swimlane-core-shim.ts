/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 * RECONSTRUCTED (confidence: fragments) — exact source was NOT preserved in
 * file-history. Behavior is documented VERBATIM in the subagent report and the
 * running-notes (commit 759b7a4b62):
 *
 *   "a new shim (superset-frontend/webpack.shims/shipmnts-swimlane-core-shim.ts)
 *    that does `export * from '@superset-ui/core'` plus
 *    `export { t, tn } from '@apache-superset/core/translation'`, restoring the
 *    exact 4.x API shape swimlane expects."
 *
 * Why: shipmnts-swimlane@0.1.5 is precompiled against the 4.x core API and calls
 * t() at module scope. 6.1.0 moved t/translation out of @superset-ui/core into
 * @apache-superset/core/translation (PR #36929), so the bare import crashed app init.
 *
 * Wiring (webpack.config.js): a NormalModuleReplacementPlugin matching
 * /^@superset-ui\/core$/, ISSUER-SCOPED to requests whose resource.context is inside
 * node_modules/shipmnts-swimlane/, redirects those to THIS shim. The shim's own
 * '@superset-ui/core' import comes from webpack.shims/ (not swimlane), so it is NOT
 * re-redirected — no recursion, single bundled core copy (no dual-copy singleton risk).
 *
 * The exact re-exported symbol list beyond { t, tn } is unverified; the report only
 * names t and tn explicitly alongside the wildcard re-export.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
export * from '@superset-ui/core';
// eslint-disable-next-line import/no-extraneous-dependencies
export { t, tn } from '@apache-superset/core/translation';
