import { z } from 'zod';

import { getErrorMsg } from '@/lib/error';
import {
  BitteTool,
  BitteToolResult,
  ChartConfig,
  ChartDataPoint,
  ChartWrapperProps,
  MetricData,
  RenderChartArgs,
} from '@/lib/types';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const renderChart: BitteTool<RenderChartArgs, ChartWrapperProps> = {
  toolSpec: {
    function: {
      name: 'render-chart',
      description:
        'Generates chart configuration and data for rendering a chart (bar, area, line, or candle) based on the provided title, description, labels, and data points.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the chart. Be concise.',
          },
          description: {
            type: 'string',
            description:
              'Brief description of the chart. Provides context for the displayed data.',
          },
          chartType: {
            type: 'string',
            enum: ['bar', 'area', 'line', 'candle'],
            description:
              'The type of chart to render. Use candle for OHLC data.',
          },
          dataPoints: {
            type: 'array',
            description:
              'Raw, unlabelled series data. Each datapoint is an array where the first value is the time value (a timestamp or date string), and the subsequent values are the corresponding metric values.',
            items: {
              type: 'array',
              items: {
                type: ['string', 'integer'],
                description:
                  'Time value as a timestamp or date string parseable by new Date()',
              },
              additionalProperties: {
                type: 'number',
                description: 'Metric value for the datapoint.',
              },
            },
          },
          metricLabels: {
            type: 'array',
            items: {
              type: 'string',
              description: 'Label for an index of the data series.',
            },
            description:
              'Labels for the items in the data series. The first label represents the time axis, followed by labels for each value in the data series. Must match the length of an item in the dataPoints array.',
          },
          dataFormat: {
            type: 'string',
            enum: ['currency', 'percentage', 'number'],
            description: 'The format in which the data should be displayed.',
          },
        },
        required: [
          'title',
          'description',
          'chartType',
          'dataFormat',
          'metricLabels',
          'dataPoints',
        ],
      },
    },
    type: 'function',
  },
  execute: async (
    args: RenderChartArgs,
  ): Promise<BitteToolResult<ChartWrapperProps>> => {
    try {
      const {
        title,
        description,
        dataPoints,
        metricLabels,
        chartType,
        dataFormat,
      }: Omit<RenderChartArgs, 'metricData'> = refinedArgsSchema.parse(args);

      const isCandleData = chartType === 'candle';

      const keys: string[] = isCandleData
        ? ['time', 'open', 'high', 'low', 'close']
        : ['time', ...metricLabels.slice(1).map((_, i) => `x-${i + 1}`)];

      const chartConfig: ChartConfig = {
        time: { label: metricLabels[0] },
        ...keys.slice(1).reduce(
          (acc, key, index) => ({
            ...acc,
            [key]: {
              label: metricLabels[index + 1],
              color: CHART_COLORS[index % CHART_COLORS.length],
            },
          }),
          {},
        ),
      };

      const chartData: ChartDataPoint[] = dataPoints.map((dataPoint) => {
        const result = dataPointSchema.safeParse(dataPoint);
        if (!result.success) {
          throw new Error(result.error.errors.map((e) => e.message).join(', '));
        }
        return {
          time: result.data.time,
          ...Object.fromEntries(
            keys.slice(1).map((key, i) => [key, result.data.values[i]]),
          ),
        };
      });

      const metricData = ((): MetricData[] => {
        const isCandle = chartType === 'candle';
        if (isCandle) {
          const firstValue = chartData[0]['open'];
          const lastValue = chartData[chartData.length - 1]['close'];

          if (isNaN(firstValue) || isNaN(lastValue) || firstValue === 0) {
            return [
              {
                metric: keys[1], // "open" for candle
                percentageChange: 0,
                isPositive: false,
                isCandle,
              },
            ];
          }

          const change = ((lastValue - firstValue) / firstValue) * 100;
          return [
            {
              metric: keys[1],
              percentageChange: change,
              isPositive: change > 0,
              isCandle,
            },
          ];
        }

        return keys.slice(1).map((metric) => {
          const firstValue = chartData[0][metric];
          const lastValue = chartData[chartData.length - 1][metric];

          if (isNaN(firstValue) || isNaN(lastValue) || firstValue === 0) {
            return {
              metric,
              percentageChange: 0,
              isPositive: false,
              isCandle,
            };
          }

          const change = ((lastValue - firstValue) / firstValue) * 100;
          return {
            metric,
            percentageChange: change,
            isPositive: change > 0,
            isCandle,
          };
        });
      })();

      return {
        data: {
          title,
          description,
          chartConfig,
          metricLabels,
          chartData,
          chartType,
          dataFormat,
          metricData,
        },
      };
    } catch (error) {
      console.error(error);
      return {
        error: getErrorMsg(error),
      };
    }
  },
};
const argsSchema: z.ZodType<Omit<RenderChartArgs, 'metricData'>> = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  chartType: z.enum(['bar', 'area', 'line', 'candle']),
  dataFormat: z.enum(['currency', 'percentage', 'number']),
  metricLabels: z
    .array(z.string().min(1, 'Metric label must be a non-empty string.'))
    .min(1, 'Metric labels must be provided.'),
  dataPoints: z
    .array(
      z
        .tuple([
          z.union([z.string(), z.number()]), // TimeValue
        ])
        .rest(z.number()),
    )
    .min(1, 'Must provide at least one datapoint.'),
});
const refinedArgsSchema: z.ZodType<Omit<RenderChartArgs, 'metricData'>> =
  argsSchema.refine(
    ({ chartType, metricLabels, dataPoints }) =>
      dataPoints[0]?.length ===
      (chartType === 'candle' ? 5 : metricLabels.length),
    {
      message:
        'Data points do not match the required structure for the chart type and metric labels.',
      path: ['dataPoints'],
    },
  );

const timestampSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const parseAsDate = (input: string): number => {
      const time = new Date(input).getTime();
      if (isNaN(time)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid timestamp (not parseable as date): ${input}`,
        });
        return z.NEVER;
      }
      return time;
    };

    if (typeof val === 'string') {
      if (/^\d+$/.test(val)) {
        const num = Number(val);
        const length = num.toString().length;
        if (length === 10) return num * 1000; // seconds -> ms
        if (length === 13) return num;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid numeric timestamp length: ${val}. Must be 10 or 13 digits.`,
        });
        return z.NEVER;
      } else {
        return parseAsDate(val);
      }
    } else {
      const numStr = val.toString();
      if (numStr.length === 10) return val * 1000; // seconds -> ms
      if (numStr.length === 13) return val;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid numeric timestamp length: ${val}. Must be 10 or 13 digits.`,
      });
      return z.NEVER;
    }
  });

const dataPointSchema = z
  .array(z.union([z.string(), z.number()]))
  .min(2, 'Data point must have at least one timestamp and one value.')
  .superRefine((arr, ctx) => {
    const values = arr.slice(1);
    if (values.some((v) => typeof v !== 'number')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `All values except timestamp must be numbers. Found: ${values}`,
      });
    }
  })
  .transform((arr) => {
    const [rawTimestamp, ...values] = arr;
    const parsedTimestamp = timestampSchema.safeParse(rawTimestamp);
    if (!parsedTimestamp.success) {
      throw parsedTimestamp.error;
    }

    return {
      time: parsedTimestamp.data,
      values: values,
    };
  });
