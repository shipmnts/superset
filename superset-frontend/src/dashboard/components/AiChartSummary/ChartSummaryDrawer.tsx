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
import { FC, useEffect, useState } from 'react';
import { Card, Drawer } from '@superset-ui/core/components';
// eslint-disable-next-line no-restricted-imports
import { Spin } from 'antd';
import { marked } from 'marked';
import axios from 'axios';
import genAiIcon from '../../../assets/images/genai.png';

interface HTMLRendererProps {
  htmlContent: string; // HTML string to render
}

const HTMLRenderer: FC<HTMLRendererProps> = ({ htmlContent }: any) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
);

const ChartSummaryDrawer = (props: any) => {
  const { onClose, visible, title, charts, dashboardInfo } = props;

  const chartSummary: string[] = [];
  const [chartSummaryLoader, setChartSummaryLoader] = useState(true);
  const [finalResult, setFinalResult] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      let counter = 0;
      const sendRequest = async (data: any, formdata: any) => {
        // eslint-disable-next-line camelcase
        const { metric, viz_type, groupby, x_axis } = formdata;
        try {
          const response = await axios.post(
            'https://api.development.shipmnts.com/turingbot/ai-chart-summarize',
            // eslint-disable-next-line camelcase
            { data, metric, viz_type, groupby, x_axis },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          chartSummary.push(response.data.summary);
          if (counter === chartSummary.length) {
            setFinalResult(chartSummary);
            setChartSummaryLoader(false);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error:', error);
        }
      };
      (Object.values(charts) || []).forEach((value: any) => {
        if (value.chartStatus === 'rendered' && !!value?.queriesResponse) {
          counter += 1;
          sendRequest(value?.queriesResponse[0].data, value.form_data);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charts, visible]);

  return (
    <>
      <Drawer
        title={
          <>
            <div style={{ display: 'inline-block', cursor: 'pointer' }}>
              <img
                src={genAiIcon}
                alt="Wand Icon"
                style={{ width: '19.5px', height: '19.5px' }}
              />
              <b> Alex Insights on Chart:</b>
            </div>
          </>
        }
        placement="right"
        onClose={onClose}
        open={visible}
        width="40%"
      >
        {chartSummaryLoader && <Spin />}

        {!chartSummaryLoader && (
          <div>
            {finalResult.map((val, index) => (
              <>
                <Card hoverable title={title || dashboardInfo[index]}>
                  {/* marked v5+ types marked() as string | Promise<string>;
                      with async unset it is synchronous, so parse() with
                      async: false keeps the fork's synchronous behavior */}
                  <HTMLRenderer
                    key={index}
                    htmlContent={marked.parse(val, { async: false })}
                  />
                </Card>
                <br />
              </>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default ChartSummaryDrawer;
