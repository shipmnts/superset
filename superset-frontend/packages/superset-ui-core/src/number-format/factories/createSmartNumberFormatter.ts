/*
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

import { formatLocale } from 'd3-format';
import NumberFormatter from '../NumberFormatter';
import NumberFormats from '../NumberFormats';
import { DEFAULT_D3_FORMAT } from '../D3FormatConfig';

const locale = formatLocale(DEFAULT_D3_FORMAT);
const siFormatter = locale.format(`.3~s`);
const float2PointFormatter = locale.format(`.2~f`);
const float4PointFormatter = locale.format(`.4~f`);

function formatIndianNumber(value: number): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);

  // Below 1,000 the Indian and SI systems name numbers identically, so defer to
  // the shared formatter. It keeps 4 decimal places for small fractions, which a
  // 2-decimal round would collapse to "0" -- 0.0023 (0.23%) rendered as "0".
  if (absValue < 1_000) return formatValue(value);

  const sign = value < 0 ? '-' : '';
  // Keep roughly 3 significant digits, matching the SI formatter. A flat
  // 2-decimal round leaves a 4-digit mantissa at 6 significant digits
  // ("1609.48Cr"), which is wide enough to collide with neighbouring data
  // labels on a chart.
  const format = (num: number) => {
    const decimals = num >= 100 ? 0 : num >= 10 ? 1 : 2;
    return parseFloat(num.toFixed(decimals)).toString();
  };

  // Indian grouping: thousand, lakh (1,00,000), crore (1,00,00,000).
  if (absValue < 1_00_000) return `${sign}${format(absValue / 1_000)}K`;
  if (absValue < 1_00_00_000) return `${sign}${format(absValue / 1_00_000)}L`;
  return `${sign}${format(absValue / 1_00_00_000)}Cr`;
}

function formatValue(value: number) {
  if (value === 0) {
    return '0';
  }
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1000) {
    // Normal human being are more familiar
    // with billion (B) that giga (G)
    return siFormatter(value).replace('G', 'B');
  }
  if (absoluteValue >= 1) {
    return float2PointFormatter(value);
  }
  if (absoluteValue >= 0.001) {
    return float4PointFormatter(value);
  }
  if (absoluteValue > 0.000001) {
    return `${siFormatter(value * 1000000)}µ`;
  }
  return siFormatter(value);
}

export default function createSmartNumberFormatter(
  config: {
    description?: string;
    signed?: boolean;
    id?: string;
    label?: string;
  } = {},
) {
  const { description, signed = false, id, label } = config;
  const getSign = signed ? (value: number) => (value > 0 ? '+' : '') : () => '';
  const urlParams = new URLSearchParams(window.location.search);
  const existingParams = Object.fromEntries(urlParams.entries());
  const isIndiaCountryTenant = existingParams?.tenant_country === 'IN';

  return new NumberFormatter({
    description,
    formatFunc: value =>
      `${getSign(value)}${
        isIndiaCountryTenant ? formatIndianNumber(value) : formatValue(value)
      }`,
    id:
      id || signed
        ? NumberFormats.SMART_NUMBER_SIGNED
        : NumberFormats.SMART_NUMBER,
    label: label ?? 'Adaptive formatter',
  });
}
