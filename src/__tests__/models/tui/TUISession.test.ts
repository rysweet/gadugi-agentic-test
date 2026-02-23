/**
 * Pure shape / type tests for TUISession types
 *
 * Verifies structural contracts defined in src/models/tui/TUISession.ts and
 * src/models/tui/TUIConfig.ts.  No mocking required.
 */

import {
  TUIKeyType,
  TUISpecialKey,
  TUIMouseEventType,
  TUIMouseButton,
} from '../../../models/tui/TUISession';

import type {
  TUIPosition,
  TUIStyle,
  TUICell,
  TUIState,
  TUIModifiers,
  TUIKeyEvent,
  TUIMouseEvent,
  TUIResizeEvent,
  TUISession,
} from '../../../models/tui/TUISession';

import type { TUIDimensions, TUIConfig } from '../../../models/tui/TUIConfig';

// ---------------------------------------------------------------------------
// TUIPosition
// ---------------------------------------------------------------------------

describe('TUIPosition shape', () => {
  it('has row and column fields', () => {
    const pos: TUIPosition = { row: 5, column: 10 };

    expect(pos.row).toBe(5);
    expect(pos.column).toBe(10);
  });

  it('supports zero values', () => {
    const pos: TUIPosition = { row: 0, column: 0 };

    expect(pos.row).toBe(0);
    expect(pos.column).toBe(0);
  });

  it('supports large coordinates', () => {
    const pos: TUIPosition = { row: 9999, column: 9999 };

    expect(pos.row).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// TUIDimensions
// ---------------------------------------------------------------------------

describe('TUIDimensions shape', () => {
  it('has width and height fields', () => {
    const dims: TUIDimensions = { width: 80, height: 24 };

    expect(dims.width).toBe(80);
    expect(dims.height).toBe(24);
  });

  it('supports standard terminal dimensions (80x24)', () => {
    const dims: TUIDimensions = { width: 80, height: 24 };

    expect(dims.width).toBe(80);
    expect(dims.height).toBe(24);
  });

  it('supports wide terminal dimensions (220x50)', () => {
    const dims: TUIDimensions = { width: 220, height: 50 };

    expect(dims.width).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// TUIStyle
// ---------------------------------------------------------------------------

describe('TUIStyle shape', () => {
  it('accepts all optional fields', () => {
    const style: TUIStyle = {
      foreground: '#ffffff',
      background: '#000000',
      bold: true,
      italic: false,
      underline: true,
      strikethrough: false,
      bright: true,
      inverse: false,
    };

    expect(style.bold).toBe(true);
    expect(style.foreground).toBe('#ffffff');
  });

  it('is valid with no fields set', () => {
    const style: TUIStyle = {};

    expect(style.bold).toBeUndefined();
    expect(style.foreground).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TUICell
// ---------------------------------------------------------------------------

describe('TUICell shape', () => {
  it('has character, style, and position fields', () => {
    const cell: TUICell = {
      character: 'A',
      style: { bold: true },
      position: { row: 0, column: 0 },
    };

    expect(cell.character).toBe('A');
    expect(cell.style.bold).toBe(true);
    expect(cell.position.row).toBe(0);
  });

  it('supports space character', () => {
    const cell: TUICell = {
      character: ' ',
      style: {},
      position: { row: 1, column: 5 },
    };

    expect(cell.character).toBe(' ');
  });
});

// ---------------------------------------------------------------------------
// TUIState
// ---------------------------------------------------------------------------

describe('TUIState shape', () => {
  function makeDimensions(): TUIDimensions {
    return { width: 80, height: 24 };
  }

  it('has required fields: dimensions, cursor, cells, buffer, cursorVisible', () => {
    const state: TUIState = {
      dimensions: makeDimensions(),
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: true,
    };

    expect(state.dimensions.width).toBe(80);
    expect(state.cursor.row).toBe(0);
    expect(Array.isArray(state.cells)).toBe(true);
    expect(state.buffer).toBe('');
    expect(state.cursorVisible).toBe(true);
  });

  it('accepts optional title field', () => {
    const state: TUIState = {
      dimensions: makeDimensions(),
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: true,
      title: 'Terminal Title',
    };

    expect(state.title).toBe('Terminal Title');
  });

  it('accepts optional altScreenActive flag', () => {
    const state: TUIState = {
      dimensions: makeDimensions(),
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: false,
      altScreenActive: true,
    };

    expect(state.altScreenActive).toBe(true);
  });

  it('accepts optional activeProcess info', () => {
    const state: TUIState = {
      dimensions: makeDimensions(),
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: true,
      activeProcess: { pid: 1234, command: 'bash', args: ['-l'] },
    };

    expect(state.activeProcess?.pid).toBe(1234);
    expect(state.activeProcess?.command).toBe('bash');
  });

  it('accepts optional scrollback array', () => {
    const state: TUIState = {
      dimensions: makeDimensions(),
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: true,
      scrollback: ['line 1', 'line 2'],
    };

    expect(state.scrollback).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// TUIKeyEvent
// ---------------------------------------------------------------------------

describe('TUIKeyEvent shape', () => {
  it('has type, key, and modifiers fields', () => {
    const event: TUIKeyEvent = {
      type: TUIKeyType.PRINTABLE,
      key: 'a',
      modifiers: {},
    };

    expect(event.type).toBe(TUIKeyType.PRINTABLE);
    expect(event.key).toBe('a');
  });

  it('accepts special key identifiers', () => {
    const event: TUIKeyEvent = {
      type: TUIKeyType.SPECIAL,
      key: TUISpecialKey.ENTER,
      modifiers: {},
    };

    expect(event.key).toBe(TUISpecialKey.ENTER);
  });

  it('accepts modifier flags', () => {
    const event: TUIKeyEvent = {
      type: TUIKeyType.COMBINATION,
      key: 'c',
      modifiers: { ctrl: true, shift: false },
    };

    expect(event.modifiers.ctrl).toBe(true);
  });

  it('TUISpecialKey enum covers navigation keys', () => {
    const navKeys = [
      TUISpecialKey.ARROW_UP,
      TUISpecialKey.ARROW_DOWN,
      TUISpecialKey.ARROW_LEFT,
      TUISpecialKey.ARROW_RIGHT,
      TUISpecialKey.HOME,
      TUISpecialKey.END,
      TUISpecialKey.PAGE_UP,
      TUISpecialKey.PAGE_DOWN,
    ];

    navKeys.forEach(k => {
      expect(typeof k).toBe('string');
    });
  });

  it('TUISpecialKey enum covers editing keys', () => {
    const editKeys = [
      TUISpecialKey.ENTER,
      TUISpecialKey.TAB,
      TUISpecialKey.ESCAPE,
      TUISpecialKey.BACKSPACE,
      TUISpecialKey.DELETE,
      TUISpecialKey.INSERT,
    ];

    editKeys.forEach(k => {
      expect(typeof k).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// TUIMouseEvent
// ---------------------------------------------------------------------------

describe('TUIMouseEvent shape', () => {
  it('has type, button, position, and modifiers fields', () => {
    const event: TUIMouseEvent = {
      type: TUIMouseEventType.CLICK,
      button: TUIMouseButton.LEFT,
      position: { row: 5, column: 10 },
      modifiers: {},
    };

    expect(event.type).toBe(TUIMouseEventType.CLICK);
    expect(event.button).toBe(TUIMouseButton.LEFT);
  });

  it('accepts clickCount field', () => {
    const event: TUIMouseEvent = {
      type: TUIMouseEventType.DOUBLE_CLICK,
      button: TUIMouseButton.LEFT,
      position: { row: 0, column: 0 },
      modifiers: {},
      clickCount: 2,
    };

    expect(event.clickCount).toBe(2);
  });

  it('accepts scrollDelta for scroll events', () => {
    const event: TUIMouseEvent = {
      type: TUIMouseEventType.SCROLL,
      button: TUIMouseButton.WHEEL_UP,
      position: { row: 0, column: 0 },
      modifiers: {},
      scrollDelta: { x: 0, y: -3 },
    };

    expect(event.scrollDelta?.y).toBe(-3);
  });

  it('TUIMouseEventType covers all event variants', () => {
    const types = [
      TUIMouseEventType.CLICK,
      TUIMouseEventType.DOUBLE_CLICK,
      TUIMouseEventType.RIGHT_CLICK,
      TUIMouseEventType.SCROLL,
      TUIMouseEventType.DRAG,
      TUIMouseEventType.MOVE,
    ];

    types.forEach(t => expect(typeof t).toBe('string'));
  });

  it('TUIMouseButton covers all button variants', () => {
    const buttons = [
      TUIMouseButton.LEFT,
      TUIMouseButton.RIGHT,
      TUIMouseButton.MIDDLE,
      TUIMouseButton.WHEEL_UP,
      TUIMouseButton.WHEEL_DOWN,
    ];

    buttons.forEach(b => expect(typeof b).toBe('string'));
  });
});

// ---------------------------------------------------------------------------
// TUIResizeEvent
// ---------------------------------------------------------------------------

describe('TUIResizeEvent shape', () => {
  it('has dimensions and previousDimensions fields', () => {
    const event: TUIResizeEvent = {
      dimensions: { width: 120, height: 30 },
      previousDimensions: { width: 80, height: 24 },
    };

    expect(event.dimensions.width).toBe(120);
    expect(event.previousDimensions.width).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// TUISession
// ---------------------------------------------------------------------------

describe('TUISession shape', () => {
  function makeMinimalConfig(): TUIConfig {
    return {
      terminal: 'xterm',
      defaultDimensions: { width: 80, height: 24 },
      encoding: 'utf8',
      defaultTimeout: 30000,
      pollingInterval: 100,
      captureScreenshots: true,
      recordSessions: false,
      colorMode: '24bit',
      interpretAnsi: true,
      shell: '/bin/bash',
      shellArgs: [],
      environment: {},
      workingDirectory: '/tmp',
      accessibility: { highContrast: false, largeText: false, screenReader: false },
      performance: { refreshRate: 60, maxBufferSize: 1024 * 1024, hardwareAcceleration: false },
    };
  }

  function makeMinimalState(): TUIState {
    return {
      dimensions: { width: 80, height: 24 },
      cursor: { row: 0, column: 0 },
      cells: [],
      buffer: '',
      cursorVisible: true,
    };
  }

  it('has id, startTime, config, currentState, history, processes, recordings, screenshots', () => {
    const session: TUISession = {
      id: 'session-001',
      startTime: new Date(),
      config: makeMinimalConfig(),
      currentState: makeMinimalState(),
      history: [],
      processes: [],
      recordings: [],
      screenshots: [],
    };

    expect(session.id).toBe('session-001');
    expect(session.startTime).toBeInstanceOf(Date);
    expect(Array.isArray(session.history)).toBe(true);
    expect(Array.isArray(session.screenshots)).toBe(true);
  });

  it('accepts optional endTime', () => {
    const session: TUISession = {
      id: 'session-002',
      startTime: new Date(),
      config: makeMinimalConfig(),
      currentState: makeMinimalState(),
      history: [],
      processes: [],
      recordings: [],
      screenshots: [],
      endTime: new Date(),
    };

    expect(session.endTime).toBeInstanceOf(Date);
  });

  it('processes array accepts process objects with pid, command, startTime, status', () => {
    const session: TUISession = {
      id: 'session-003',
      startTime: new Date(),
      config: makeMinimalConfig(),
      currentState: makeMinimalState(),
      history: [],
      processes: [
        { pid: 1234, command: 'bash', startTime: new Date(), status: 'running' },
        { pid: 5678, command: 'vim', startTime: new Date(), status: 'completed' },
      ],
      recordings: [],
      screenshots: [],
    };

    expect(session.processes).toHaveLength(2);
    expect(session.processes[0].pid).toBe(1234);
    expect(session.processes[1].status).toBe('completed');
  });

  it('process status accepts "running", "completed", and "failed" values', () => {
    const validStatuses: Array<'running' | 'completed' | 'failed'> = [
      'running',
      'completed',
      'failed',
    ];

    validStatuses.forEach(status => {
      const proc = {
        pid: 1,
        command: 'test',
        startTime: new Date(),
        status,
      };
      expect(proc.status).toBe(status);
    });
  });
});

// ---------------------------------------------------------------------------
// TUIKeyType enum
// ---------------------------------------------------------------------------

describe('TUIKeyType enum values', () => {
  it('has PRINTABLE, SPECIAL, FUNCTION, MODIFIER, COMBINATION values', () => {
    expect(TUIKeyType.PRINTABLE).toBe('PRINTABLE');
    expect(TUIKeyType.SPECIAL).toBe('SPECIAL');
    expect(TUIKeyType.FUNCTION).toBe('FUNCTION');
    expect(TUIKeyType.MODIFIER).toBe('MODIFIER');
    expect(TUIKeyType.COMBINATION).toBe('COMBINATION');
  });
});
