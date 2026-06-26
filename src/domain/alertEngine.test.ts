import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockMarketDataProvider } from "./dataProviders";
import { buildEventAlerts } from "./alertEngine";
import { buildProfilesFromSnapshot } from "./scoring";
import { defaultPreferences } from "./mockData";

test("event alerts include why-now context and respect cooldown", async () => {
  const snapshot = await createMockMarketDataProvider("red-risk").getSnapshot();
  const profiles = buildProfilesFromSnapshot(snapshot);
  const first = buildEventAlerts({
    profiles,
    snapshot,
    preferences: defaultPreferences,
    history: [],
    now: new Date("2026-06-26T10:00:00+08:00")
  });

  assert.ok(first.length > 0);
  assert.match(first[0].whyNow, /触发|升温|红灯|集中/);

  const second = buildEventAlerts({
    profiles,
    snapshot,
    preferences: defaultPreferences,
    history: first,
    now: new Date("2026-06-26T10:20:00+08:00")
  });

  assert.equal(second.length, 0);
});

test("too-frequent feedback lowers non-strong alert volume", async () => {
  const snapshot = await createMockMarketDataProvider("cooling").getSnapshot();
  const profiles = buildProfilesFromSnapshot(snapshot);
  const preferences = {
    ...defaultPreferences,
    feedbackCounts: { ...defaultPreferences.feedbackCounts, tooFrequent: 3 }
  };

  const alerts = buildEventAlerts({
    profiles,
    snapshot,
    preferences,
    history: [],
    now: new Date("2026-06-26T10:00:00+08:00")
  });

  assert.equal(alerts.some((alert) => alert.severity === "light"), false);
});
