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
import { PivotData, aggregators } from '../../src/react-pivottable/utilities';

const aggregatorsFactory = () => aggregators;

// Records: rows = region, cols = product, value column = value.
// Region "West" sums higher than "East" for product "B".
const data = [
  { region: 'East', product: 'A', value: 10 },
  { region: 'East', product: 'B', value: 5 },
  { region: 'West', product: 'A', value: 1 },
  { region: 'West', product: 'B', value: 50 },
];

const makePivot = (overrides: Record<string, unknown> = {}) =>
  new PivotData({
    data,
    rows: ['region'],
    cols: ['product'],
    vals: ['value'],
    aggregatorName: 'Sum',
    aggregatorsFactory,
    defaultFormatter: (x: number) => String(x),
    ...overrides,
  });

describe('PivotData value-based sorting', () => {
  it('sorts rows ascending by the value of a specific column (_asc)', () => {
    // Sort rows by product "B": East=5, West=50 -> ascending => East, West
    const pivot = makePivot({ rowOrder: 'B_asc' });
    expect(pivot.getRowKeys()).toEqual([['East'], ['West']]);
  });

  it('sorts rows descending by the value of a specific column (_desc)', () => {
    // descending => West (50) before East (5)
    const pivot = makePivot({ rowOrder: 'B_desc' });
    expect(pivot.getRowKeys()).toEqual([['West'], ['East']]);
  });

  it('sorts columns ascending by the value of a specific row (_asc)', () => {
    // Sort cols by row "West": A=1, B=50 -> ascending => A, B
    const pivot = makePivot({ colOrder: 'West_asc' });
    expect(pivot.getColKeys()).toEqual([['A'], ['B']]);
  });

  it('sorts columns descending by the value of a specific row (_desc)', () => {
    // descending => B (50) before A (1)
    const pivot = makePivot({ colOrder: 'West_desc' });
    expect(pivot.getColKeys()).toEqual([['B'], ['A']]);
  });

  it('falls back to key sorting for non-value orders', () => {
    const pivot = makePivot({ rowOrder: 'key_a_to_z' });
    expect(pivot.getRowKeys()).toEqual([['East'], ['West']]);
  });
});

describe('PivotData metric totals', () => {
  it('aggregates per-metric row totals keyed by the Metric column', () => {
    // Unpivoted shape: each record carries a `Metric` discriminator.
    const metricData = [
      { region: 'East', Metric: 'Revenue', value: 10 },
      { region: 'East', Metric: 'Revenue', value: 15 },
      { region: 'East', Metric: 'Cost', value: 4 },
      { region: 'West', Metric: 'Revenue', value: 100 },
    ];
    const pivot = new PivotData({
      data: metricData,
      rows: ['region'],
      cols: [],
      vals: ['value'],
      aggregatorName: 'Sum',
      aggregatorsFactory,
      defaultFormatter: (x: number) => String(x),
    });

    expect(pivot.getMetrics().sort()).toEqual(['Cost', 'Revenue']);

    const eastTotals = pivot.getMetricTotals(['East']);
    expect(eastTotals.Revenue.value()).toBe(25);
    expect(eastTotals.Cost.value()).toBe(4);

    const westTotals = pivot.getMetricTotals(['West']);
    expect(westTotals.Revenue.value()).toBe(100);
    expect(westTotals.Cost).toBeUndefined();
  });
});
