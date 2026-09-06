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
import { Comparator, ObjectFormattingEnum } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

export const operatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.GreaterThan, label: '>' },
  { value: Comparator.LessThan, label: '<' },
  { value: Comparator.GreaterOrEqual, label: '≥' },
  { value: Comparator.LessOrEqual, label: '≤' },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.NotEqual, label: '≠' },
  { value: Comparator.Between, label: '< x <' },
  { value: Comparator.BetweenOrEqual, label: '≤ x ≤' },
  { value: Comparator.BetweenOrLeftEqual, label: '≤ x <' },
  { value: Comparator.BetweenOrRightEqual, label: '< x ≤' },
];

export const stringOperatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.BeginsWith, label: t('begins with') },
  { value: Comparator.EndsWith, label: t('ends with') },
  { value: Comparator.Containing, label: t('containing') },
  { value: Comparator.NotContaining, label: t('not containing') },
];

export const booleanOperatorOptions = [
  { value: Comparator.IsNull, label: t('is null') },
  { value: Comparator.IsTrue, label: t('is true') },
  { value: Comparator.IsFalse, label: t('is false') },
  { value: Comparator.IsNotNull, label: t('is not null') },
];

export const formattingOptions = [
  {
    value: ObjectFormattingEnum.BACKGROUND_COLOR,
    label: t('background color'),
  },
  {
    value: ObjectFormattingEnum.TEXT_COLOR,
    label: t('text color'),
  },
  {
    value: ObjectFormattingEnum.CELL_BAR,
    label: t('cell bar'),
  },
];

// Use theme token names instead of hex values to support theme switching
export const colorSchemeOptions = () => [
  { value: 'colorSuccess', label: t('success') },
  { value: 'colorWarning', label: t('alert') },
  { value: 'colorError', label: t('error') },
  /* eslint-disable theme-colors/no-literal-colors */
  { value: '#F0F0F0', label: t('bg-secondary') },
  { value: '#E0E0E0', label: t('border-secondary') },
  { value: '#E8EBFE', label: t('bg-mychat') },
  { value: '#F6F7FA', label: t('surface') },
  { value: '#FCFFE6', label: t('bg-lime-primary') },
  { value: '#EAFF8F', label: t('bg-lime-secondary') },
  { value: '#3F6600', label: t('text-lime') },
  { value: '#E6FFFB', label: t('bg-cyan-primary') },
  { value: '#87E8DE', label: t('bg-cyan-secondary') },
  { value: '#F0F5FF', label: t('bg-geekblue-primary') },
  { value: '#D6E4FF', label: t('bg-geekblue-secondary') },
  { value: '#FFEF9D', label: t('bg-caution') },
  { value: '#CDFEE1', label: t('bg-success') },
  { value: '#FEDAD9', label: t('bg-critical') },
  { value: '#E0F0FF', label: t('bg-info') },
  /* eslint-enable theme-colors/no-literal-colors */
];
