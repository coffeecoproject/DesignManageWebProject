// Shared test assertions backed by Vitest `expect`, so every check counts toward `requireAssertions`.
import { expect } from 'vitest';

export function assert(condition: unknown, message: string): asserts condition {
  expect(condition, message).toBeTruthy();
}

export function assertEqual<T>(actual: T, expected: T, message: string) {
  expect(actual, message).toBe(expected);
}

export function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  expect(JSON.stringify(actual), message).toBe(JSON.stringify(expected));
}

export function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  expect(Boolean(value) && typeof value === 'object', message).toBe(true);
}
