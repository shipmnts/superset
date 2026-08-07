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
import { CSSProperties } from 'react';
import { SEPARATOR } from '@superset-ui/core';
import { Space, RangePicker } from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Dayjs } from 'dayjs';
import { FrameComponentProps } from 'src/explore/components/controls/DateFilterControl/types';
import { CUSTOM_CALENDAR_RANGE_OPTIONS } from 'src/explore/components/controls/DateFilterControl/utils';

// REFERENCE: https://github.com/apache/superset/issues/26651
// https://github.com/JanZuska/superset/commit/839f725968546540165f26b2e459299b8aee9529

const PRESETS = Object.keys(CUSTOM_CALENDAR_RANGE_OPTIONS).map(key => ({
  label: key,
  value: CUSTOM_CALENDAR_RANGE_OPTIONS[key] as [Dayjs, Dayjs],
}));

export function CustomCalendarFrame(props: FrameComponentProps) {
  const spaceStyle: CSSProperties = { width: '100%' };

  function onChange(dates: [Dayjs, Dayjs] | null) {
    if (!dates?.[0] || !dates?.[1]) {
      return;
    }
    const selectedPresetKey = Object.keys(CUSTOM_CALENDAR_RANGE_OPTIONS).find(
      key => {
        const [presetStart, presetEnd] = CUSTOM_CALENDAR_RANGE_OPTIONS[key];
        return (
          dates[0].isSame(presetStart, 'day') &&
          dates[1].isSame(presetEnd, 'day')
        );
      },
    );

    if (selectedPresetKey) {
      props.onChange(selectedPresetKey);
    } else {
      props.onChange(
        `${dates[0].format('YYYY-MM-DD')}${SEPARATOR}${dates[1].format(
          'YYYY-MM-DD',
        )}`,
      );
    }
  }

  const pickerValue = (() => {
    if (!props.value) {
      return undefined;
    }
    // Named preset token → its preset date pair.
    const preset = CUSTOM_CALENDAR_RANGE_OPTIONS[props.value];
    if (preset) {
      return preset;
    }
    // Concrete range → parsed dayjs pair.
    const dates = props.value
      .split(SEPARATOR)
      .map(date => extendedDayjs(date, 'YYYY-MM-DD', true))
      .filter(date => date.isValid());
    return dates.length === 2 ? (dates as [Dayjs, Dayjs]) : undefined;
  })();

  return (
    <Space direction="vertical" size={12} style={spaceStyle}>
      <RangePicker
        presets={PRESETS}
        onChange={onChange as any}
        value={pickerValue}
      />
    </Space>
  );
}
