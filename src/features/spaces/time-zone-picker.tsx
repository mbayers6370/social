"use client";
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "@/components/margin-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const label = (zone: string) =>
  zone.replaceAll("_", " ").replaceAll("/", " / ");
// The form dialog owns dismissal only after this select's popup has closed.
export function preserveTimeZoneMenu(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  if (
    event.target instanceof Element &&
    event.target
      .closest(".margin-space-zone-picker")
      ?.querySelector('[role="combobox"][aria-expanded="true"]')
  )
    event.preventDefault();
}
export function TimeZonePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (zone: string) => void;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const zones = useMemo(
    () =>
      [
        ...new Set(["UTC", value, ...Intl.supportedValuesOf("timeZone")]),
      ].sort(),
    [value],
  );
  const matches = useMemo(
    () =>
      zones.filter((zone) =>
        `${zone} ${label(zone)}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      ),
    [zones, query],
  );
  useLayoutEffect(() => {
    if (open)
      list.current
        ?.querySelector<HTMLElement>(`[data-active="true"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, query]);
  function show() {
    setQuery("");
    setActive(zones.indexOf(value));
    setOpen(true);
  }
  function choose(zone: string) {
    onChange(zone);
    setOpen(false);
    input.current?.focus();
  }
  function keyboard(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      setActive((i) =>
        Math.max(
          0,
          Math.min(matches.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    } else if (open && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : matches.length - 1);
    }
  }
  return (
    <div
      ref={root}
      className="margin-space-zone-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="margin-space-zone-control">
        <Input
          ref={input}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && matches[active] ? `${listId}-${active}` : undefined
          }
          value={open ? query : label(value)}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={open ? "Search by city or region" : "Choose time zone"}
          onClick={() => {
            if (!open) show();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={keyboard}
          className="margin-space-zone-input"
        />
        <Button
          variant="ghost"
          size="icon"
          tabIndex={-1}
          className="margin-space-zone-trigger"
          aria-label="Show time zones"
          aria-expanded={open}
          onClick={() => {
            input.current?.focus();
            if (open) setOpen(false);
            else show();
          }}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
      {open && (
        <div className="margin-space-zone-menu">
          <ul ref={list} id={listId} role="listbox" aria-label="Time zones">
            {matches.map((zone, i) => (
              <li key={zone} role="presentation">
                <button
                  id={`${listId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={zone === value}
                  data-active={i === active}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(zone)}
                >
                  <span>{label(zone)}</span>
                  {zone === value && <Check size={16} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && <p role="status">No time zones found.</p>}
        </div>
      )}
    </div>
  );
}
