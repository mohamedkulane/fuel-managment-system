import assert from "node:assert/strict";
import test from "node:test";
import { formatStatus, orderStatusTone } from "../src/lib/format";

test("Order status translations strictly match canonical Somali requirements", () => {
  // 1. DRAFT -> Qabyo
  assert.equal(formatStatus("DRAFT"), "Qabyo");
  // 2. CONFIRMED -> La xaqiijiyey
  assert.equal(formatStatus("CONFIRMED"), "La xaqiijiyey");
  // 3. SCHEDULED -> Gaarsiin la qorsheeyey
  assert.equal(formatStatus("SCHEDULED"), "Gaarsiin la qorsheeyey");
  // 4. IN_PROGRESS -> Gaarsiintu wey socotaa
  assert.equal(formatStatus("IN_PROGRESS"), "Gaarsiintu wey socotaa");
  // 5. PARTIALLY_FULFILLED -> Qayb ahaan la geeyey
  assert.equal(formatStatus("PARTIALLY_FULFILLED"), "Qayb ahaan la geeyey");
  // 6. FULFILLED -> La geeyey
  assert.equal(formatStatus("FULFILLED"), "La geeyey");
  // 7. CANCELLED -> La joojiyey
  assert.equal(formatStatus("CANCELLED"), "La joojiyey");
});

test("formatStatus is case-insensitive for all order statuses", () => {
  assert.equal(formatStatus("draft"), "Qabyo");
  assert.equal(formatStatus("confirmed"), "La xaqiijiyey");
  assert.equal(formatStatus("scheduled"), "Gaarsiin la qorsheeyey");
  assert.equal(formatStatus("in_progress"), "Gaarsiintu wey socotaa");
  assert.equal(formatStatus("partially_fulfilled"), "Qayb ahaan la geeyey");
  assert.equal(formatStatus("fulfilled"), "La geeyey");
  assert.equal(formatStatus("cancelled"), "La joojiyey");
});

test("formatStatus is idempotent: re-translating translated status preserves exact text without Xaalad kale", () => {
  const statuses = [
    "DRAFT",
    "CONFIRMED",
    "SCHEDULED",
    "IN_PROGRESS",
    "PARTIALLY_FULFILLED",
    "FULFILLED",
    "CANCELLED"
  ];

  for (const s of statuses) {
    const once = formatStatus(s);
    const twice = formatStatus(once);
    assert.equal(twice, once, `Idempotency failed for status ${s}`);
    assert.notEqual(once, "Xaalad kale", `Status ${s} produced generic 'Xaalad kale'`);
    assert.notEqual(twice, "Xaalad kale", `Double translation of ${s} produced 'Xaalad kale'`);
  }
});

test("orderStatusTone maps every order status to its designated BadgeTone", () => {
  // DRAFT -> neutral
  assert.equal(orderStatusTone("DRAFT"), "neutral");
  assert.equal(orderStatusTone("Qabyo"), "neutral");

  // CONFIRMED / SCHEDULED / IN_PROGRESS -> info (Blue/Teal)
  assert.equal(orderStatusTone("CONFIRMED"), "info");
  assert.equal(orderStatusTone("La xaqiijiyey"), "info");
  assert.equal(orderStatusTone("SCHEDULED"), "info");
  assert.equal(orderStatusTone("Gaarsiin la qorsheeyey"), "info");
  assert.equal(orderStatusTone("IN_PROGRESS"), "info");
  assert.equal(orderStatusTone("Gaarsiintu wey socotaa"), "info");

  // PARTIALLY_FULFILLED -> warn (Amber/Yellow)
  assert.equal(orderStatusTone("PARTIALLY_FULFILLED"), "warn");
  assert.equal(orderStatusTone("Qayb ahaan la geeyey"), "warn");

  // FULFILLED -> ok (Green)
  assert.equal(orderStatusTone("FULFILLED"), "ok");
  assert.equal(orderStatusTone("La geeyey"), "ok");

  // CANCELLED -> danger (Red)
  assert.equal(orderStatusTone("CANCELLED"), "danger");
  assert.equal(orderStatusTone("La joojiyey"), "danger");
});

test("formatStatus never falls back to generic 'Xaalad kale' for any valid or unknown input", () => {
  assert.equal(formatStatus(undefined), "—");
  assert.equal(formatStatus(null), "—");
  assert.equal(formatStatus(""), "—");
  assert.equal(formatStatus("   "), "—");

  // Unknown status gets humanized, never "Xaalad kale"
  const unknown = formatStatus("CUSTOM_INTERNAL_STATUS");
  assert.notEqual(unknown, "Xaalad kale");
  assert.equal(unknown, "Custom internal status");
});

test("Other domain statuses translate accurately to natural Somali", () => {
  // Invoices
  assert.equal(formatStatus("UNPAID"), "Lama bixin");
  assert.equal(formatStatus("PARTIALLY_PAID"), "Qayb ayaa la bixiyey");
  assert.equal(formatStatus("PAID"), "La bixiyey");
  assert.equal(formatStatus("REVERSED"), "Waa laga noqday");

  // Customers
  assert.equal(formatStatus("ACTIVE"), "Shaqaynaya");
  assert.equal(formatStatus("INACTIVE"), "Aan shaqaynayn");
  assert.equal(formatStatus("HOLD"), "La hakiyey");
  assert.equal(formatStatus("ARCHIVED"), "La kaydiyay");

  // Dispatch / Reconciliation
  assert.equal(formatStatus("DISPATCHED"), "La diray");
  assert.equal(formatStatus("RECONCILED"), "La heshiisiyey");
});
