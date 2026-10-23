import { BarChart } from '@mantine/charts';
import { useTranslation } from 'react-i18next';
import { moneyAxis } from '../components/chartAxis';
import { formatMonthShort } from '../lib/format';
import { formatMoney } from '../lib/money';

/** Income and expense bars by month, as on the dashboard and in the reports. */
export function IncomeExpenseChart({
  months,
  currency,
  height,
}: {
  months: { month: string; income?: number | null; expense?: number | null }[];
  currency: string;
  height: number;
}) {
  const { t } = useTranslation();
  return (
    <BarChart
      h={height}
      data={months.map((item) => ({
        month: formatMonthShort(item.month),
        [t('reports.income')]: item.income ?? 0,
        [t('reports.expense')]: item.expense ?? 0,
      }))}
      dataKey="month"
      series={[
        { name: t('reports.income'), color: 'green.6' },
        { name: t('reports.expense'), color: 'red.6' },
      ]}
      withLegend
      valueFormatter={(value) => formatMoney(value, currency)}
      yAxisProps={moneyAxis}
      gridAxis="y"
      tickLine="none"
    />
  );
}
