/**
 * Pure shape / type tests for TUIResults
 *
 * These tests verify structural contracts of the types defined in
 * src/models/tui/TUIResults.ts.  No mocking required.
 */

import {
  TUITextAssertionType,
  TUIPositionAssertionType,
  TUIStyleAssertionType,
  TUIScreenAssertionType,
  TUIActionType,
  TUIVerificationType,
} from '../../../models/tui/TUIResults';

import type {
  TUITextAssertion,
  TUIPositionAssertion,
  TUIStyleAssertion,
  TUIScreenAssertion,
  TUITestStep,
  TUITestResult,
  TUIRegion,
} from '../../../models/tui/TUIResults';

import { TestStatus } from '../../../models/TestModels';
import { TUIKeyType, TUISpecialKey } from '../../../models/tui/TUISession';

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function makePosition() {
  return { row: 0, column: 0 };
}

function makeRegion(): TUIRegion {
  return { start: makePosition(), end: { row: 5, column: 20 } };
}

function makeStyle() {
  return { bold: true, foreground: '#ffffff' };
}

// ---------------------------------------------------------------------------
// TUITextAssertion
// ---------------------------------------------------------------------------

describe('TUITextAssertion shape', () => {
  it('requires type and text fields', () => {
    const assertion: TUITextAssertion = {
      type: TUITextAssertionType.CONTAINS,
      text: 'hello',
    };

    expect(assertion.type).toBe(TUITextAssertionType.CONTAINS);
    expect(assertion.text).toBe('hello');
  });

  it('accepts optional caseSensitive flag', () => {
    const assertion: TUITextAssertion = {
      type: TUITextAssertionType.EXACT_MATCH,
      text: 'hello',
      caseSensitive: false,
    };

    expect(assertion.caseSensitive).toBe(false);
  });

  it('accepts all TUITextAssertionType values', () => {
    const types = [
      TUITextAssertionType.EXACT_MATCH,
      TUITextAssertionType.CONTAINS,
      TUITextAssertionType.STARTS_WITH,
      TUITextAssertionType.ENDS_WITH,
      TUITextAssertionType.REGEX_MATCH,
      TUITextAssertionType.NOT_CONTAINS,
    ];

    types.forEach(t => {
      const assertion: TUITextAssertion = { type: t, text: 'test' };
      expect(assertion.type).toBe(t);
    });
  });

  it('accepts a TUIPosition as target', () => {
    const assertion: TUITextAssertion = {
      type: TUITextAssertionType.CONTAINS,
      text: 'value',
      target: makePosition(),
    };

    expect((assertion.target as any).row).toBeDefined();
  });

  it('accepts a TUIRegion as target', () => {
    const assertion: TUITextAssertion = {
      type: TUITextAssertionType.CONTAINS,
      text: 'value',
      target: makeRegion(),
    };

    expect((assertion.target as any).start).toBeDefined();
    expect((assertion.target as any).end).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TUIPositionAssertion
// ---------------------------------------------------------------------------

describe('TUIPositionAssertion shape', () => {
  it('requires type and position fields', () => {
    const assertion: TUIPositionAssertion = {
      type: TUIPositionAssertionType.AT_POSITION,
      position: makePosition(),
    };

    expect(assertion.type).toBe(TUIPositionAssertionType.AT_POSITION);
    expect(assertion.position.row).toBe(0);
    expect(assertion.position.column).toBe(0);
  });

  it('accepts all TUIPositionAssertionType values', () => {
    const types = [
      TUIPositionAssertionType.AT_POSITION,
      TUIPositionAssertionType.IN_REGION,
      TUIPositionAssertionType.CURSOR_AT,
      TUIPositionAssertionType.RELATIVE_TO,
    ];

    types.forEach(t => {
      const assertion: TUIPositionAssertion = {
        type: t,
        position: makePosition(),
      };
      expect(assertion.type).toBe(t);
    });
  });

  it('accepts optional tolerance field', () => {
    const assertion: TUIPositionAssertion = {
      type: TUIPositionAssertionType.AT_POSITION,
      position: makePosition(),
      tolerance: 2,
    };

    expect(assertion.tolerance).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TUIStyleAssertion
// ---------------------------------------------------------------------------

describe('TUIStyleAssertion shape', () => {
  it('requires type, style, and target fields', () => {
    const assertion: TUIStyleAssertion = {
      type: TUIStyleAssertionType.HAS_STYLE,
      style: makeStyle(),
      target: makePosition(),
    };

    expect(assertion.type).toBe(TUIStyleAssertionType.HAS_STYLE);
    expect(assertion.style.bold).toBe(true);
  });

  it('accepts all TUIStyleAssertionType values', () => {
    const types = [
      TUIStyleAssertionType.HAS_STYLE,
      TUIStyleAssertionType.HAS_COLOR,
      TUIStyleAssertionType.IS_HIGHLIGHTED,
      TUIStyleAssertionType.IS_BOLD,
      TUIStyleAssertionType.IS_UNDERLINED,
    ];

    types.forEach(t => {
      const assertion: TUIStyleAssertion = {
        type: t,
        style: {},
        target: makePosition(),
      };
      expect(assertion.type).toBe(t);
    });
  });
});

// ---------------------------------------------------------------------------
// TUIScreenAssertion
// ---------------------------------------------------------------------------

describe('TUIScreenAssertion shape', () => {
  it('has required type and expected fields', () => {
    const assertion: TUIScreenAssertion = {
      type: TUIScreenAssertionType.SCREEN_SIZE,
      expected: { width: 80, height: 24 },
    };

    expect(assertion.type).toBe(TUIScreenAssertionType.SCREEN_SIZE);
    expect(assertion.expected).toEqual({ width: 80, height: 24 });
  });

  it('expected field accepts a string value', () => {
    const assertion: TUIScreenAssertion = {
      type: TUIScreenAssertionType.TITLE_EQUALS,
      expected: 'My App',
    };

    expect(typeof assertion.expected).toBe('string');
  });

  it('expected field accepts a number value', () => {
    const assertion: TUIScreenAssertion = {
      type: TUIScreenAssertionType.SCREEN_SIZE,
      expected: 80,
    };

    expect(typeof assertion.expected).toBe('number');
  });

  it('expected field accepts a boolean value', () => {
    const assertion: TUIScreenAssertion = {
      type: TUIScreenAssertionType.CURSOR_VISIBLE,
      expected: true,
    };

    expect(typeof assertion.expected).toBe('boolean');
  });

  it('accepts all TUIScreenAssertionType values', () => {
    const types = [
      TUIScreenAssertionType.SCREEN_SIZE,
      TUIScreenAssertionType.TITLE_EQUALS,
      TUIScreenAssertionType.CURSOR_VISIBLE,
      TUIScreenAssertionType.ALT_SCREEN_ACTIVE,
      TUIScreenAssertionType.PROCESS_RUNNING,
    ];

    types.forEach(t => {
      const assertion: TUIScreenAssertion = { type: t, expected: null };
      expect(assertion.type).toBe(t);
    });
  });
});

// ---------------------------------------------------------------------------
// TUITestStep
// ---------------------------------------------------------------------------

describe('TUITestStep shape', () => {
  it('requires action field', () => {
    const step: TUITestStep = {
      action: TUIActionType.TYPE,
    };

    expect(step.action).toBe(TUIActionType.TYPE);
  });

  it('accepts optional target as a string', () => {
    const step: TUITestStep = {
      action: TUIActionType.KEY_PRESS,
      target: 'Enter',
    };

    expect(step.target).toBe('Enter');
  });

  it('accepts optional target as TUIPosition', () => {
    const step: TUITestStep = {
      action: TUIActionType.MOUSE_CLICK,
      target: makePosition(),
    };

    expect((step.target as any).row).toBeDefined();
  });

  it('accepts optional assertions array', () => {
    const step: TUITestStep = {
      action: TUIActionType.ASSERT_TEXT,
      assertions: [
        { type: TUITextAssertionType.CONTAINS, text: 'hello' },
      ],
    };

    expect(step.assertions).toHaveLength(1);
  });

  it('accepts continueOnFailure flag', () => {
    const step: TUITestStep = {
      action: TUIActionType.TYPE,
      continueOnFailure: true,
    };

    expect(step.continueOnFailure).toBe(true);
  });

  it('accepts retry configuration', () => {
    const step: TUITestStep = {
      action: TUIActionType.WAIT_FOR_TEXT,
      retry: { attempts: 3, delay: 500 },
    };

    expect(step.retry?.attempts).toBe(3);
    expect(step.retry?.delay).toBe(500);
  });

  it('accepts screenshot capture configuration', () => {
    const step: TUITestStep = {
      action: TUIActionType.CAPTURE_SCREEN,
      screenshot: { before: true, after: true, onFailure: true, filename: 'capture.png' },
    };

    expect(step.screenshot?.filename).toBe('capture.png');
  });

  it('supports all TUIActionType values without TypeScript error', () => {
    const inputActions = [
      TUIActionType.TYPE,
      TUIActionType.KEY_PRESS,
      TUIActionType.KEY_COMBINATION,
      TUIActionType.MOUSE_CLICK,
      TUIActionType.MOUSE_DRAG,
      TUIActionType.SCROLL,
    ];
    const controlActions = [
      TUIActionType.RESIZE,
      TUIActionType.CLEAR_SCREEN,
      TUIActionType.SEND_SIGNAL,
    ];
    const waitActions = [
      TUIActionType.WAIT_FOR_TEXT,
      TUIActionType.WAIT_FOR_CURSOR,
      TUIActionType.WAIT_FOR_PROCESS,
      TUIActionType.WAIT_FOR_SCREEN,
    ];
    const captureActions = [
      TUIActionType.CAPTURE_SCREEN,
      TUIActionType.CAPTURE_REGION,
      TUIActionType.START_RECORDING,
      TUIActionType.STOP_RECORDING,
    ];
    const assertActions = [
      TUIActionType.ASSERT_TEXT,
      TUIActionType.ASSERT_POSITION,
      TUIActionType.ASSERT_STYLE,
      TUIActionType.ASSERT_SCREEN,
    ];

    const all = [...inputActions, ...controlActions, ...waitActions, ...captureActions, ...assertActions];

    all.forEach(actionType => {
      const step: TUITestStep = { action: actionType };
      expect(step.action).toBe(actionType);
    });
  });
});

// ---------------------------------------------------------------------------
// TUITestResult
// ---------------------------------------------------------------------------

describe('TUITestResult shape', () => {
  function makeMinimalState() {
    return {
      dimensions: { width: 80, height: 24 },
      cursor: makePosition(),
      cells: [],
      buffer: '',
      cursorVisible: true,
    };
  }

  function makeMinimalResult(): TUITestResult {
    return {
      scenarioId: 'test-scenario',
      status: TestStatus.PASSED,
      duration: 1000,
      startTime: new Date(),
      endTime: new Date(),
      tui: {
        initialState: makeMinimalState() as any,
        finalState: makeMinimalState() as any,
        interactions: [],
        screenshots: [],
        verifications: [],
        performance: {
          avgResponseTime: 50,
          refreshRate: 60,
          memoryUsage: 1024,
        },
      },
    };
  }

  it('has required base fields: scenarioId, status, duration, startTime, endTime', () => {
    const result = makeMinimalResult();

    expect(result.scenarioId).toBe('test-scenario');
    expect(result.status).toBe(TestStatus.PASSED);
    expect(typeof result.duration).toBe('number');
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
  });

  it('has tui.screenshots array', () => {
    const result = makeMinimalResult();

    expect(Array.isArray(result.tui.screenshots)).toBe(true);
  });

  it('has tui.interactions array', () => {
    const result = makeMinimalResult();

    expect(Array.isArray(result.tui.interactions)).toBe(true);
  });

  it('has tui.verifications array', () => {
    const result = makeMinimalResult();

    expect(Array.isArray(result.tui.verifications)).toBe(true);
  });

  it('has tui.performance with avgResponseTime, refreshRate, memoryUsage', () => {
    const result = makeMinimalResult();

    expect(typeof result.tui.performance.avgResponseTime).toBe('number');
    expect(typeof result.tui.performance.refreshRate).toBe('number');
    expect(typeof result.tui.performance.memoryUsage).toBe('number');
  });

  it('accepts optional error string', () => {
    const result: TUITestResult = {
      ...makeMinimalResult(),
      error: 'Something went wrong',
    };

    expect(result.error).toBe('Something went wrong');
  });

  it('accepts optional recording path in tui', () => {
    const result = makeMinimalResult();
    result.tui.recording = '/tmp/recording.cast';

    expect(result.tui.recording).toBe('/tmp/recording.cast');
  });
});

// ---------------------------------------------------------------------------
// TUIVerificationType enum
// ---------------------------------------------------------------------------

describe('TUIVerificationType enum values', () => {
  it('has SCREEN_CONTENT value', () => {
    expect(TUIVerificationType.SCREEN_CONTENT).toBe('SCREEN_CONTENT');
  });

  it('has CURSOR_POSITION value', () => {
    expect(TUIVerificationType.CURSOR_POSITION).toBe('CURSOR_POSITION');
  });

  it('has TERMINAL_STATE value', () => {
    expect(TUIVerificationType.TERMINAL_STATE).toBe('TERMINAL_STATE');
  });

  it('has PROCESS_STATE value', () => {
    expect(TUIVerificationType.PROCESS_STATE).toBe('PROCESS_STATE');
  });

  it('has OUTPUT_STREAM value', () => {
    expect(TUIVerificationType.OUTPUT_STREAM).toBe('OUTPUT_STREAM');
  });

  it('has VISUAL_STYLE value', () => {
    expect(TUIVerificationType.VISUAL_STYLE).toBe('VISUAL_STYLE');
  });

  it('has INTERACTION_RESPONSE value', () => {
    expect(TUIVerificationType.INTERACTION_RESPONSE).toBe('INTERACTION_RESPONSE');
  });
});
