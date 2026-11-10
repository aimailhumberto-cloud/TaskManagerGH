/**
 * Zero-dependency modern test harness for Cerebro E2E tests.
 * Supports async test suites, lifecycle hooks, comprehensive matchers, and ANSI colored reporting.
 */

let currentSuite = null;
const allSuites = [];

class Expectation {
  constructor(actual, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not() {
    return new Expectation(this.actual, !this.isNot);
  }

  _evaluate(passed, message) {
    if (this.isNot ? passed : !passed) {
      throw new Error(message);
    }
  }

  toBe(expected) {
    const passed = Object.is(this.actual, expected);
    this._evaluate(passed, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} ${JSON.stringify(expected)}`);
  }

  toEqual(expected) {
    const passed = deepEqual(this.actual, expected);
    this._evaluate(passed, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to equal' : 'to equal'} ${JSON.stringify(expected)}`);
  }

  toBeTruthy() {
    this._evaluate(Boolean(this.actual), `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} truthy`);
  }

  toBeFalsy() {
    this._evaluate(!this.actual, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} falsy`);
  }

  toBeNull() {
    this._evaluate(this.actual === null, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be null' : 'to be null'}`);
  }

  toBeUndefined() {
    this._evaluate(this.actual === undefined, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be undefined' : 'to be undefined'}`);
  }

  toBeDefined() {
    this._evaluate(this.actual !== undefined, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'to be undefined' : 'to be defined'}`);
  }

  toContain(item) {
    let passed = false;
    if (typeof this.actual === 'string') {
      passed = this.actual.includes(item);
    } else if (Array.isArray(this.actual) || this.actual instanceof Set) {
      passed = Array.from(this.actual).includes(item);
    } else if (this.actual && typeof this.actual === 'object') {
      passed = item in this.actual;
    }
    this._evaluate(passed, `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to contain' : 'to contain'} ${JSON.stringify(item)}`);
  }

  toBeGreaterThan(num) {
    const passed = this.actual > num;
    this._evaluate(passed, `Expected ${this.actual} ${this.isNot ? 'NOT to be >' : 'to be >'} ${num}`);
  }

  toBeGreaterThanOrEqual(num) {
    const passed = this.actual >= num;
    this._evaluate(passed, `Expected ${this.actual} ${this.isNot ? 'NOT to be >=' : 'to be >='} ${num}`);
  }

  toBeLessThan(num) {
    const passed = this.actual < num;
    this._evaluate(passed, `Expected ${this.actual} ${this.isNot ? 'NOT to be <' : 'to be <'} ${num}`);
  }

  toBeLessThanOrEqual(num) {
    const passed = this.actual <= num;
    this._evaluate(passed, `Expected ${this.actual} ${this.isNot ? 'NOT to be <=' : 'to be <='} ${num}`);
  }

  toBeCloseTo(expected, precision = 2) {
    const diff = Math.abs(this.actual - expected);
    const tolerance = Math.pow(10, -precision) / 2;
    const passed = diff < tolerance;
    this._evaluate(passed, `Expected ${this.actual} ${this.isNot ? 'NOT to be close to' : 'to be close to'} ${expected} (diff: ${diff}, tolerance: ${tolerance})`);
  }

  toThrow(expectedSubstring) {
    let threw = false;
    let thrownError = null;
    if (typeof this.actual !== 'function') {
      throw new Error(`Expected a function to test toThrow, received ${typeof this.actual}`);
    }
    try {
      this.actual();
    } catch (err) {
      threw = true;
      thrownError = err;
    }
    if (expectedSubstring && threw) {
      const msg = thrownError?.message || String(thrownError);
      const matches = msg.includes(expectedSubstring);
      this._evaluate(matches, `Expected error message "${msg}" ${this.isNot ? 'NOT to include' : 'to include'} "${expectedSubstring}"`);
    } else {
      this._evaluate(threw, `Expected function ${this.isNot ? 'NOT to throw' : 'to throw an error'}`);
    }
  }

  toMatch(regex) {
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    const passed = pattern.test(String(this.actual));
    this._evaluate(passed, `Expected "${this.actual}" ${this.isNot ? 'NOT to match' : 'to match'} ${pattern}`);
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

export function expect(actual) {
  return new Expectation(actual);
}

export function describe(name, fn) {
  const suite = {
    name,
    tests: [],
    beforeEachFns: [],
    afterEachFns: [],
  };
  const prevSuite = currentSuite;
  currentSuite = suite;
  allSuites.push(suite);
  try {
    fn();
  } finally {
    currentSuite = prevSuite;
  }
}

export function it(name, fn) {
  if (!currentSuite) {
    throw new Error(`Test "${name}" must be placed inside a describe block.`);
  }
  currentSuite.tests.push({ name, fn });
}

export function beforeEach(fn) {
  if (currentSuite) {
    currentSuite.beforeEachFns.push(fn);
  }
}

export function afterEach(fn) {
  if (currentSuite) {
    currentSuite.afterEachFns.push(fn);
  }
}

export async function runAllSuites() {
  const results = {
    totalSuites: allSuites.length,
    totalTests: 0,
    passed: 0,
    failed: 0,
    failures: [],
    durationMs: 0,
    suiteSummaries: [],
  };

  const globalStart = Date.now();

  for (const suite of allSuites) {
    const suiteStart = Date.now();
    const suiteResult = {
      name: suite.name,
      tests: [],
      passed: 0,
      failed: 0,
    };

    for (const test of suite.tests) {
      results.totalTests++;
      const testStart = Date.now();
      try {
        for (const hook of suite.beforeEachFns) {
          await hook();
        }
        await test.fn();
        for (const hook of suite.afterEachFns) {
          await hook();
        }
        const duration = Date.now() - testStart;
        results.passed++;
        suiteResult.passed++;
        suiteResult.tests.push({ name: test.name, status: 'pass', duration });
      } catch (err) {
        const duration = Date.now() - testStart;
        results.failed++;
        suiteResult.failed++;
        const failureInfo = {
          suite: suite.name,
          test: test.name,
          error: err.message,
          stack: err.stack,
          duration,
        };
        results.failures.push(failureInfo);
        suiteResult.tests.push({ name: test.name, status: 'fail', error: err.message, duration });
      }
    }
    suiteResult.duration = Date.now() - suiteStart;
    results.suiteSummaries.push(suiteResult);
  }

  results.durationMs = Date.now() - globalStart;
  return results;
}

export function resetRegistry() {
  allSuites.length = 0;
  currentSuite = null;
}
