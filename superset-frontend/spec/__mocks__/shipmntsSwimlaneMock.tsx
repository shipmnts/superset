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
 * Jest stub for the `shipmnts-swimlane` chart plugin. The real package's
 * compiled output fails to load under jest's @superset-ui source
 * moduleNameMapper (its module-scope `t()` resolves against a core copy whose
 * translation setup is unavailable), so test runs use this no-op plugin;
 * webpack builds use the real package via webpack.shims/.
 *
 * Mapped in jest.config.js:
 *   '^shipmnts-swimlane$': '<rootDir>/spec/__mocks__/shipmntsSwimlaneMock.tsx'
 *
 * Extends ChartPlugin so `new Swimlane().configure({ key: ... })` works inside
 * MainPreset's Preset registration during setupPlugins().
 */
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';

export class Swimlane extends ChartPlugin {
  constructor() {
    super({
      metadata: new ChartMetadata({
        name: 'Swimlane (test stub)',
        thumbnail: '',
      }),
      // Never rendered in tests; resolves to an empty component.
      loadChart: () => Promise.resolve(() => null),
    });
  }
}

export default Swimlane;
