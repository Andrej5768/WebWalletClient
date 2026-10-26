import { Anchor, Badge, Button, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCategoriesById } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { MoneyInput } from '../components/MoneyInput';
import { locale } from '../i18n';
import { formatDayShort } from '../lib/format';
import { formatMoney } from '../lib/money';
import { useRecurringPayments, type Recurring } from '../recurring/api';
import { useForecast } from './api';
import { expectedDate, forecastChart, loadMinimum, plot, saveMinimum, type Forecast } from './forecast';
import classes from './dashboard.module.css';

/** Money of cash and cards this month: actual up to today, then the forecast with planned payments. */
export function ForecastCard() {
  const { t } = useTranslation();
  const forecast = useForecast();
  const recurring = useRecurringPayments();
  const [minimum, setMinimum] = useState(loadMinimum);

  const changeMinimum = (value: number | null) => {
    setMinimum(value);
    saveMinimum(value);
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="md">
        <Text fw={600}>{t('dashboard.forecast.title')}</Text>
        <MinimumEditor value={minimum} currency={forecast.data?.currency ?? 'UAH'} onChange={changeMinimum} />
      </Group>
      {forecast.isLoading || !forecast.data ? (
        <Skeleton height={260} />
      ) : (
        <div className={classes.forecast}>
          <ForecastChartView forecast={forecast.data} minimum={minimum} />
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" pb={6}>
              {t('dashboard.forecast.planned')}
            </Text>
            <PlannedList
              forecast={forecast.data}
              hasRecurring={(recurring.data ?? []).length > 0}
              recurring={recurring.data ?? []}
            />
          </Stack>
        </div>
      )}
    </Card>
  );
}

function ForecastChartView({ forecast, minimum }: { forecast: Forecast; minimum: number | null }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);
  const days = forecast.days;
  const first = days[0];
  const last = days[days.length - 1];
  const chart = forecastChart(forecast, minimum);
  const todayDay = days[chart.todayIndex];
  if (!first || !last || !todayDay) return null;
  const currency = forecast.currency;
  const short = new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 0 });
  const mid = (chart.hi + chart.lo) / 2;
  const lowest = forecast.lowest;
  const dips = minimum != null && lowest != null && lowest.balance < minimum;
  const todayX = chart.x(chart.todayIndex);
  const step = (plot.right - plot.left) / Math.max(1, days.length - 1);
  const hoveredDay = hovered === null ? undefined : days[hovered];

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <Stack gap={0}>
          <Text size="xs" c="dimmed">
            {t('dashboard.forecast.now')}
          </Text>
          <Text className="num" fz={20} fw={600}>
            {formatMoney(forecast.balance, currency)}
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed">
            {t('dashboard.forecast.expected', { date: formatDayShort(last.date) })}
          </Text>
          <Text className={`num ${last.balance < 0 ? 'expense' : ''}`} fz={20} fw={600}>
            {formatMoney(last.balance, currency)}
          </Text>
        </Stack>
      </Group>
      <div className={classes.chartWrap}>
        <svg
          className={classes.chart}
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          width="100%"
          onMouseLeave={() => setHovered(null)}
          role="img"
          aria-label={t('dashboard.forecast.aria', {
            now: formatMoney(forecast.balance, currency),
            date: formatDayShort(last.date),
            end: formatMoney(last.balance, currency),
          })}
        >
          {[chart.hi, mid, chart.lo].map((value) => (
            <g key={value}>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={chart.y(value)}
                y2={chart.y(value)}
                className={classes.grid}
              />
              <text x={plot.left - 8} y={chart.y(value) + 3} textAnchor="end" className={classes.axis}>
                {short.format(value)}
              </text>
            </g>
          ))}
          {minimum != null && (
            <g>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={chart.y(minimum)}
                y2={chart.y(minimum)}
                className={classes.minimum}
              />
              <text
                x={plot.right - 2}
                y={chart.y(minimum) - 4}
                textAnchor="end"
                className={classes.minimumLabel}
              >
                {t('dashboard.forecast.minimumLine', { amount: formatMoney(minimum, currency) })}
              </text>
            </g>
          )}
          <line x1={todayX} x2={todayX} y1={10} y2={plot.bottom} className={classes.todayLine} />
          <text x={todayX} y={9} textAnchor="middle" className={classes.axis}>
            {t('dashboard.forecast.today')}
          </text>
          <polyline points={chart.actual} className={classes.actual} />
          {chart.forecast.includes(' ') && <polyline points={chart.forecast} className={classes.projected} />}
          {hoveredDay && (
            <line
              x1={chart.x(hovered!)}
              x2={chart.x(hovered!)}
              y1={plot.top}
              y2={plot.bottom}
              className={classes.hoverLine}
            />
          )}
          {chart.dots.map((dot) => (
            <circle
              key={dot.index}
              cx={dot.x}
              cy={dot.y}
              r={hovered === dot.index ? 4 : 2.5}
              className={classes.dayDot}
            />
          ))}
          {chart.markers.map((marker, index) => (
            <circle
              key={index}
              cx={marker.x}
              cy={marker.y}
              r={4}
              className={marker.income ? classes.markerIn : classes.markerOut}
            />
          ))}
          <circle cx={todayX} cy={chart.y(todayDay.balance)} r={4.5} className={classes.todayDot} />
          {days.map((day, index) => (
            <rect
              key={day.date}
              data-day={day.date}
              x={chart.x(index) - step / 2}
              y={plot.top}
              width={step}
              height={plot.bottom - plot.top}
              className={classes.hit}
              onMouseEnter={() => setHovered(index)}
            />
          ))}
          <text x={plot.left} y={206} textAnchor="middle" className={classes.axis}>
            {formatDayShort(first.date)}
          </text>
          <text x={plot.right} y={206} textAnchor="end" className={classes.axis}>
            {formatDayShort(last.date)}
          </text>
        </svg>
        {hoveredDay && (
          <DayTooltip
            day={hoveredDay}
            events={forecast.events.filter(
              (event) => expectedDate(event, forecast.today) === hoveredDay.date,
            )}
            currency={currency}
            x={chart.x(hovered!)}
            y={chart.y(hoveredDay.balance)}
          />
        )}
      </div>
      {minimum != null && (
        <Badge
          variant="light"
          color={dips ? 'yellow' : 'gray'}
          radius="sm"
          size="lg"
          tt="none"
          fw={500}
          leftSection={dips ? <TriangleAlert size={14} /> : undefined}
          className={dips ? classes.warn : undefined}
          style={{ alignSelf: 'flex-start' }}
        >
          {dips
            ? t('dashboard.forecast.dip', {
                date: formatDayShort(lowest.date),
                amount: formatMoney(lowest.balance, currency),
                minimum: formatMoney(minimum, currency),
              })
            : t('dashboard.forecast.noDip')}
        </Badge>
      )}
    </Stack>
  );
}

/** What happened or is planned on a day of the chart: the balance, the operations and the expected payments. */
function DayTooltip({
  day,
  events,
  currency,
  x,
  y,
}: {
  day: Forecast['days'][number];
  events: Forecast['events'];
  currency: string;
  x: number;
  y: number;
}) {
  const { t } = useTranslation();
  const left = (x / plot.width) * 100;
  const amount = (value: number) => (
    <Text size="xs" className={`num ${value < 0 ? 'expense' : 'income'}`} style={{ whiteSpace: 'nowrap' }}>
      {formatMoney(value, currency, { signed: true })}
    </Text>
  );
  return (
    <div
      className={classes.tooltip}
      role="tooltip"
      style={{
        left: `${left}%`,
        top: `${(y / plot.height) * 100}%`,
        transform: `translate(${left > 60 ? '-100%' : '0'}, -100%) translateY(-8px)`,
      }}
    >
      <Group justify="space-between" gap="md" wrap="nowrap">
        <Text size="xs" fw={600}>
          {formatDayShort(day.date)}
        </Text>
        <Text size="xs" className="num" fw={600}>
          {formatMoney(day.balance, currency)}
        </Text>
      </Group>
      {day.operations.map((operation) => (
        <Group key={operation.id} justify="space-between" gap="md" wrap="nowrap">
          <Text size="xs" c="dimmed" truncate>
            {operation.name ?? t('transactions.noPayee')}
          </Text>
          {amount(operation.amount)}
        </Group>
      ))}
      {events.map((event) => (
        <Group key={`${event.recurringId}-${event.date}`} justify="space-between" gap="md" wrap="nowrap">
          <Text size="xs" c="dimmed" truncate>
            {t('dashboard.forecast.plannedItem', { name: event.name })}
          </Text>
          {amount(event.amount)}
        </Group>
      ))}
    </div>
  );
}

function PlannedList({
  forecast,
  hasRecurring,
  recurring,
}: {
  forecast: Forecast;
  hasRecurring: boolean;
  recurring: Recurring[];
}) {
  const { t } = useTranslation();
  const categoriesById = useCategoriesById();
  if (forecast.events.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {hasRecurring ? t('dashboard.forecast.nothingLeft') : t('dashboard.forecast.empty')}{' '}
        {!hasRecurring && (
          <Anchor component={Link} to="/transactions" size="sm">
            {t('dashboard.forecast.toTransactions')}
          </Anchor>
        )}
      </Text>
    );
  }
  return forecast.events.map((event) => {
    const category = event.categoryId != null ? categoriesById.get(event.categoryId) : undefined;
    return (
      <Group
        key={`${event.recurringId}-${event.date}`}
        gap="sm"
        wrap="nowrap"
        py={6}
        className={classes.event}
      >
        <CategoryIcon icon={category?.icon} color={category?.color} size={28} />
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {event.name}
          </Text>
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              {formatDayShort(event.date)}
            </Text>
            {event.overdue && (
              <Badge size="xs" variant="light" color="yellow" radius="sm" tt="none">
                {t('dashboard.forecast.overdue')}
              </Badge>
            )}
          </Group>
        </Stack>
        <PlannedAmount
          event={event}
          currency={forecast.currency}
          series={recurring.find((item) => item.id === event.recurringId)}
        />
      </Group>
    );
  });
}

function MinimumEditor({
  value,
  currency,
  onChange,
}: {
  value: number | null;
  currency: string;
  onChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | string>(value ?? '');

  const save = () => {
    onChange(typeof draft === 'number' && draft > 0 ? draft : null);
    setEditing(false);
  };

  if (!editing) {
    return (
      <Anchor
        component="button"
        type="button"
        size="sm"
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
      >
        {value != null
          ? t('dashboard.forecast.minimum', { amount: formatMoney(value, currency) })
          : t('dashboard.forecast.setMinimum')}
      </Anchor>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <MoneyInput
        aria-label={t('dashboard.forecast.minimumLabel')}
        title={t('dashboard.forecast.minimumHint')}
        size="xs"
        w={170}
        currency={currency}
        value={draft}
        onChange={setDraft}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') setEditing(false);
        }}
      />
      {value != null && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => {
            onChange(null);
            setEditing(false);
          }}
        >
          {t('dashboard.forecast.clearMinimum')}
        </Button>
      )}
      <Button size="xs" onClick={save}>
        {t('common.save')}
      </Button>
    </Group>
  );
}

/**
 * The amount of a planned payment as the feed shows it, in the currency of its account; when that is not the
 * currency of the forecast, the converted amount follows in grey ("≈ 448,42 ₴").
 */
function PlannedAmount({
  event,
  currency: forecastCurrency,
  series,
}: {
  event: Forecast['events'][number];
  currency: string;
  series?: Recurring;
}) {
  const sign = event.amount < 0 ? 'expense' : 'income';
  if (!series || series.currency === forecastCurrency) {
    return (
      <Text size="sm" fw={500} className={`num ${sign}`}>
        {formatMoney(event.amount, forecastCurrency, { signed: true })}
      </Text>
    );
  }
  const own = event.amount < 0 ? -series.amount : series.amount;
  return (
    <Stack gap={0} align="flex-end">
      <Text size="sm" fw={500} className={`num ${sign}`}>
        {series.variableAmount && '≈ '}
        {formatMoney(own, series.currency, { signed: true })}
      </Text>
      <Text size="xs" c="dimmed" className="num">
        ≈ {formatMoney(event.amount, forecastCurrency, { signed: true })}
      </Text>
    </Stack>
  );
}
