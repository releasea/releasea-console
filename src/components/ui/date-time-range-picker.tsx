import { useEffect, useMemo, useState, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, parse, isValid, subHours, subDays, startOfDay, endOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type DateTimeRange = {
  from: Date;
  to: Date;
};

interface DateTimeRangePickerProps {
  value: DateTimeRange;
  onChange: (range: DateTimeRange) => void;
  maxDays?: number;
  variant?: 'popover' | 'inline';
  showCalendar?: boolean;
  showManualInputs?: boolean;
  showQuickRanges?: boolean;
  className?: string;
}

const formatDateInput = (date: Date) => format(date, 'MMM dd, yyyy');
const formatTimeInput = (date: Date) => format(date, 'HH:mm');
const formatDateTimeInput = (date: Date) => format(date, 'MMM dd, yyyy HH:mm');

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  const parsed = parse(trimmed, 'MMM dd, yyyy', new Date(), { locale: enUS });
  if (!isValid(parsed)) return null;
  if (format(parsed, 'MMM dd, yyyy').toLowerCase() !== trimmed.toLowerCase()) return null;
  return parsed;
};

const parseTimeInput = (value: string) => {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
};

const parseDateTimeInput = (value: string) => {
  const trimmed = value.trim();
  const parsed = parse(trimmed, 'MMM dd, yyyy HH:mm', new Date(), { locale: enUS });
  if (!isValid(parsed)) return null;
  if (format(parsed, 'MMM dd, yyyy HH:mm').toLowerCase() !== trimmed.toLowerCase()) return null;
  return parsed;
};

const setTimeParts = (date: Date, hours: number, minutes: number) => {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const quickRanges = [
  { label: '1h', getValue: () => ({ from: subHours(new Date(), 1), to: new Date() }) },
  { label: '6h', getValue: () => ({ from: subHours(new Date(), 6), to: new Date() }) },
  { label: '24h', getValue: () => ({ from: subHours(new Date(), 24), to: new Date() }) },
  { label: '7d', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: new Date() }) },
];

export function DateTimeRangePicker({
  value,
  onChange,
  maxDays = 7,
  variant = 'popover',
  showCalendar = true,
  showManualInputs: showManualInputsProp,
  showQuickRanges = true,
  className,
}: DateTimeRangePickerProps) {
  const isInline = variant === 'inline';
  const isPopover = !isInline;
  const showManualInputs = showManualInputsProp ?? isInline;
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date>(value.from);
  const [draftTo, setDraftTo] = useState<Date>(value.to);
  const [fromDateInput, setFromDateInput] = useState(() => formatDateInput(value.from));
  const [fromTimeInput, setFromTimeInput] = useState(() => formatTimeInput(value.from));
  const [toDateInput, setToDateInput] = useState(() => formatDateInput(value.to));
  const [toTimeInput, setToTimeInput] = useState(() => formatTimeInput(value.to));
  const [fromDateTimeInput, setFromDateTimeInput] = useState(() => formatDateTimeInput(value.from));
  const [toDateTimeInput, setToDateTimeInput] = useState(() => formatDateTimeInput(value.to));

  const syncDraftFromValue = useCallback(() => {
    setDraftFrom(value.from);
    setDraftTo(value.to);
    setFromDateInput(formatDateInput(value.from));
    setFromTimeInput(formatTimeInput(value.from));
    setToDateInput(formatDateInput(value.to));
    setToTimeInput(formatTimeInput(value.to));
    setFromDateTimeInput(formatDateTimeInput(value.from));
    setToDateTimeInput(formatDateTimeInput(value.to));
  }, [value.from, value.to]);

  useEffect(() => {
    if (isInline || !open) {
      syncDraftFromValue();
    }
  }, [isInline, open, syncDraftFromValue]);

  useEffect(() => {
    if (!(isInline || open)) return;
    setFromDateInput(formatDateInput(draftFrom));
    setFromTimeInput(formatTimeInput(draftFrom));
    setToDateInput(formatDateInput(draftTo));
    setToTimeInput(formatTimeInput(draftTo));
    setFromDateTimeInput(formatDateTimeInput(draftFrom));
    setToDateTimeInput(formatDateTimeInput(draftTo));
  }, [draftFrom, draftTo, isInline, open]);

  const rangeLabel = useMemo(() => {
    if (!draftFrom || !draftTo) return 'Select range';
    return `${format(draftFrom, 'MMM dd, HH:mm')} → ${format(draftTo, 'MMM dd, HH:mm')}`;
  }, [draftFrom, draftTo]);

  const updateFromInputs = (nextDate: string, nextTime: string) => {
    setFromDateInput(nextDate);
    setFromTimeInput(nextTime);
    const date = parseDateInput(nextDate);
    const time = parseTimeInput(nextTime);
    if (date && time) {
      setDraftFrom(setTimeParts(date, time.hours, time.minutes));
    }
  };

  const updateToInputs = (nextDate: string, nextTime: string) => {
    setToDateInput(nextDate);
    setToTimeInput(nextTime);
    const date = parseDateInput(nextDate);
    const time = parseTimeInput(nextTime);
    if (date && time) {
      setDraftTo(setTimeParts(date, time.hours, time.minutes));
    }
  };

  const updateFromDateTimeInput = (nextValue: string) => {
    setFromDateTimeInput(nextValue);
    const parsed = parseDateTimeInput(nextValue);
    if (parsed) {
      setDraftFrom(parsed);
    }
  };

  const updateToDateTimeInput = (nextValue: string) => {
    setToDateTimeInput(nextValue);
    const parsed = parseDateTimeInput(nextValue);
    if (parsed) {
      setDraftTo(parsed);
    }
  };

  const handleSelect = (range?: DateRange) => {
    if (!range?.from) return;
    const nextFrom = setTimeParts(
      range.from,
      draftFrom.getHours(),
      draftFrom.getMinutes()
    );
    const baseTo = range.to ?? range.from;
    const nextTo = setTimeParts(
      baseTo,
      draftTo.getHours(),
      draftTo.getMinutes()
    );
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
  };

  const handleQuickRange = (getValue: () => DateTimeRange) => {
    const range = getValue();
    setDraftFrom(range.from);
    setDraftTo(range.to);
  };

  const now = new Date();
  const clampedTo = draftTo > now ? now : draftTo;
  const rangeMs = clampedTo.getTime() - draftFrom.getTime();
  const maxMs = maxDays * 24 * 60 * 60 * 1000;
  const isInvalid = rangeMs <= 0;
  const exceedsMax = rangeMs > maxMs;
  const fromDateParsed = parseDateInput(fromDateInput);
  const fromTimeParsed = parseTimeInput(fromTimeInput);
  const toDateParsed = parseDateInput(toDateInput);
  const toTimeParsed = parseTimeInput(toTimeInput);
  const fromDateTimeParsed = parseDateTimeInput(fromDateTimeInput);
  const toDateTimeParsed = parseDateTimeInput(toDateTimeInput);
  const inputsValid = showManualInputs
    ? Boolean(fromDateParsed && fromTimeParsed && toDateParsed && toTimeParsed)
    : Boolean(fromDateTimeParsed && toDateTimeParsed);
  const canApply = inputsValid && !isInvalid && !exceedsMax;

  const applyRange = () => {
    if (!canApply) return;
    onChange({ from: draftFrom, to: clampedTo });
    if (!isInline) {
      setOpen(false);
    }
  };

  const handleCancel = () => {
    if (isInline) {
      syncDraftFromValue();
      return;
    }
    setOpen(false);
  };

  const rangeError = !inputsValid
    ? showManualInputs
      ? 'Use Jan 31, 2026 and 22:42 in both fields.'
      : 'Use Jan 31, 2026 22:42 in both fields.'
    : isInvalid
    ? 'End time must be after the start time.'
    : exceedsMax
      ? `Range cannot exceed ${maxDays} days.`
      : '';

  const quickSelectSection = showQuickRanges ? (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Quick select</span>
      </div>
      <div className={isPopover ? "grid grid-cols-[1fr_1fr_1fr_1fr_1.25fr] gap-1.5" : "flex flex-wrap gap-1.5"}>
        {quickRanges.map((range) => (
          <Button
            key={range.label}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => handleQuickRange(range.getValue)}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </div>
  ) : null;

  const manualInputsSection = showManualInputs ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Custom range</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Start date & time</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={fromDateInput}
              onChange={(event) => updateFromInputs(event.target.value, fromTimeInput)}
              placeholder="Jan 31, 2026"
              className="bg-background text-sm h-9"
            />
            <Input
              value={fromTimeInput}
              onChange={(event) => updateFromInputs(fromDateInput, event.target.value)}
              placeholder="22:42"
              className="bg-background text-sm h-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">End date & time</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={toDateInput}
              onChange={(event) => updateToInputs(event.target.value, toTimeInput)}
              placeholder="Jan 31, 2026"
              className="bg-background text-sm h-9"
            />
            <Input
              value={toTimeInput}
              onChange={(event) => updateToInputs(toDateInput, event.target.value)}
              placeholder="22:42"
              className="bg-background text-sm h-9"
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const calendarSection = showCalendar ? (
    <div className="rounded-lg border border-border overflow-hidden flex justify-center">
      <Calendar
        mode="range"
        selected={{ from: draftFrom, to: draftTo }}
        onSelect={handleSelect}
        defaultMonth={draftFrom}
        numberOfMonths={1}
        disabled={{ after: now }}
        className="bg-card mx-auto w-fit scale-[auto] origin-top"
        classNames={{
          head_row: "flex justify-center",
          row: "flex w-full mt-2 justify-center",
        }}
      />
    </div>
  ) : null;

  const selectedRangeSection = showManualInputs ? (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">Selected:</span>
      <span className="text-sm font-medium text-foreground">{rangeLabel}</span>
    </div>
  ) : (
    <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-3 space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">Selected range</span>
      <div className="space-y-2">
        <div className="grid grid-cols-[52px_1fr] items-center gap-2 sm:grid-cols-[60px_1fr]">
          <span className="text-xs font-medium text-muted-foreground">Start</span>
          <Input
            value={fromDateTimeInput}
            onChange={(event) => updateFromDateTimeInput(event.target.value)}
            placeholder="Jan 31, 2026 22:42"
            className="bg-background/80 text-sm h-9 border-border/50 focus-visible:bg-card focus-visible:border-primary/60"
          />
        </div>
        <div className="grid grid-cols-[52px_1fr] items-center gap-2 sm:grid-cols-[60px_1fr]">
          <span className="text-xs font-medium text-muted-foreground">End</span>
          <Input
            value={toDateTimeInput}
            onChange={(event) => updateToDateTimeInput(event.target.value)}
            placeholder="Jan 31, 2026 22:42"
            className="bg-background/80 text-sm h-9 border-border/50 focus-visible:bg-card focus-visible:border-primary/60"
          />
        </div>
      </div>
    </div>
  );

  const pickerContent = (
    <div className="space-y-4">
      {isPopover && showCalendar ? (
        <div className="grid gap-4 md:grid-cols-[auto_auto] items-start justify-center">
          {calendarSection}
          <div className="flex h-full w-full max-w-[260px] flex-col gap-4">
            {quickSelectSection}
            {manualInputsSection}
            {selectedRangeSection}
            {rangeError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{rangeError}</p>
            )}
            <div className="mt-auto flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyRange} disabled={!canApply}>
                Apply range
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {quickSelectSection}
          {manualInputsSection}
          {calendarSection}
          {selectedRangeSection}
          {rangeError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{rangeError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyRange} disabled={!canApply}>
              Apply range
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (isInline) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
        {pickerContent}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start gap-2 bg-muted/50 text-left font-normal whitespace-normal", className)}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm leading-snug">{rangeLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-[min(600px,calc(100vw-2rem))] max-w-[92vw] p-4 -translate-x-6"
      >
        {pickerContent}
      </PopoverContent>
    </Popover>
  );
}
