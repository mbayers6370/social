"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Calendar, ChevronLeft, ChevronRight } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Calendar arithmetic stays in UTC; the chosen wall-clock date uses the form's explicit time zone.
const dateAt = (year: number, month: number, day: number) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
const key = (date: Date) => date.toISOString().slice(0, 10);
function parse(value: string) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = dateAt(year, month - 1, day);
  return key(date) === value ? date : null;
}
const today = () => {
  const d = new Date();
  return dateAt(d.getFullYear(), d.getMonth(), d.getDate());
};
const monthTitle = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateTitle = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function shiftMonth(date: Date, amount: number) {
  const first = dateAt(date.getUTCFullYear(), date.getUTCMonth() + amount, 1);
  const last = dateAt(
    first.getUTCFullYear(),
    first.getUTCMonth() + 1,
    0,
  ).getUTCDate();
  return dateAt(
    first.getUTCFullYear(),
    first.getUTCMonth(),
    Math.min(date.getUTCDate(), last),
  );
}
export function EventDateTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [date, time = ""] = value.split("T");
  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState(() => parse(date) || today());
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const focusAfterMove = useRef(false);
  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${key(focusDate)}"]`)
      ?.focus();
  }, [focusDate]);
  const first = dateAt(focusDate.getUTCFullYear(), focusDate.getUTCMonth(), 1);
  const length = dateAt(
    first.getUTCFullYear(),
    first.getUTCMonth() + 1,
    0,
  ).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((first.getUTCDay() + length) / 7) * 7 },
    (_, i) => {
      const day = i - first.getUTCDay() + 1;
      return day < 1 || day > length
        ? null
        : dateAt(first.getUTCFullYear(), first.getUTCMonth(), day);
    },
  );
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, day: Date) {
    let next: Date;
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -day.getUTCDay(),
      End: 6 - day.getUTCDay(),
    };
    if (event.key in offsets)
      next = dateAt(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate() + offsets[event.key],
      );
    else if (event.key === "PageUp" || event.key === "PageDown")
      next = shiftMonth(
        day,
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
      );
    else return;
    event.preventDefault();
    if (next.getUTCFullYear() < 0 || next.getUTCFullYear() > 9999) return;
    focusAfterMove.current = true;
    setFocusDate(next);
  }
  return (
    <fieldset className="margin-space-date-field">
      <legend className="margin-field-label">Date and local time</legend>
      <div className="margin-space-date-time">
        <div>
          <Label htmlFor={`${id}-date`}>Date</Label>
          <div className="margin-space-date-control">
            <Input
              id={`${id}-date`}
              type="text"
              placeholder="YYYY-MM-DD"
              pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
              maxLength={10}
              required
              value={date}
              onChange={(e) => onChange(`${e.target.value}T${time}`)}
              className="margin-space-date-input"
            />
            <Button
              ref={trigger}
              variant="ghost"
              size="icon"
              className="margin-space-date-trigger"
              aria-label="Choose date"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => {
                setFocusDate(parse(date) || today());
                setOpen(true);
              }}
            >
              <Calendar aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor={`${id}-time`}>Time</Label>
          <Input
            id={`${id}-time`}
            type="time"
            required
            value={time}
            onChange={(e) => onChange(`${date}T${e.target.value}`)}
          />
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="margin-space-calendar"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            grid.current
              ?.querySelector<HTMLButtonElement>('[tabindex="0"]')
              ?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>Choose date</DialogTitle>
          <DialogDescription className="sr-only">
            Use the arrow keys to move by day, Page Up and Page Down to change
            months, and Enter to choose a date.
          </DialogDescription>
          <div className="margin-space-calendar-heading">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              disabled={
                focusDate.getUTCFullYear() === 0 &&
                focusDate.getUTCMonth() === 0
              }
              onClick={() => setFocusDate(shiftMonth(focusDate, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <h3 aria-live="polite">{monthTitle.format(first)}</h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={
                focusDate.getUTCFullYear() === 9999 &&
                focusDate.getUTCMonth() === 11
              }
              onClick={() => setFocusDate(shiftMonth(focusDate, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <table ref={grid} role="grid" aria-label={monthTitle.format(first)}>
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th key={day} scope="col" aria-label={day}>
                    {day.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <tr key={week}>
                  {cells.slice(week * 7, week * 7 + 7).map((day, column) => (
                    <td
                      key={column}
                      aria-selected={day ? key(day) === date : undefined}
                    >
                      {day && (
                        <Button
                          variant="ghost"
                          className="margin-space-calendar-day"
                          data-date={key(day)}
                          data-selected={key(day) === date}
                          aria-label={dateTitle.format(day)}
                          aria-current={
                            key(day) === key(today()) ? "date" : undefined
                          }
                          tabIndex={key(day) === key(focusDate) ? 0 : -1}
                          onFocus={() => setFocusDate(day)}
                          onKeyDown={(e) => keyboard(e, day)}
                          onClick={() => {
                            onChange(`${key(day)}T${time}`);
                            setOpen(false);
                          }}
                        >
                          {day.getUTCDate()}
                        </Button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
