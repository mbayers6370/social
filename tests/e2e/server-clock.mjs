// Loaded only by Playwright's development server. Keep SSR and browser dates
// aligned so relative headings, retention, and daily allowances don't age out.
import fixtureTime from "./fixture-time.json" with { type: "json" };

const timestamp = Date.parse(fixtureTime);
globalThis.Date = new Proxy(Date, {
  construct(target, args) {
    return Reflect.construct(target, args.length ? args : [timestamp]);
  },
  apply(target) {
    return new target(timestamp).toString();
  },
  get(target, property, receiver) {
    return property === "now"
      ? () => timestamp
      : Reflect.get(target, property, receiver);
  },
});
