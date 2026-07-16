import { describe, it, expect } from 'vitest';
import { isValidTransition, VALID_TRANSITIONS, ORDER_STATUS_LABELS } from '@/lib/constants/order-status';

// ─── isValidTransition ───────────────────────────────────────────────────────

describe('isValidTransition', () => {
  // Happy path — transitions valides
  it('should_allow_NEW_to_CONFIRMED', () => {
    expect(isValidTransition('NEW', 'CONFIRMED')).toBe(true);
  });

  it('should_allow_NEW_to_CANCELLED', () => {
    expect(isValidTransition('NEW', 'CANCELLED')).toBe(true);
  });

  it('should_allow_CONFIRMED_to_IN_PREPARATION', () => {
    expect(isValidTransition('CONFIRMED', 'IN_PREPARATION')).toBe(true);
  });

  it('should_allow_CONFIRMED_to_CANCELLED', () => {
    expect(isValidTransition('CONFIRMED', 'CANCELLED')).toBe(true);
  });

  it('should_allow_IN_PREPARATION_to_READY', () => {
    expect(isValidTransition('IN_PREPARATION', 'READY')).toBe(true);
  });

  it('should_allow_IN_PREPARATION_to_CANCELLED', () => {
    expect(isValidTransition('IN_PREPARATION', 'CANCELLED')).toBe(true);
  });

  it('should_allow_READY_to_PICKED_UP', () => {
    expect(isValidTransition('READY', 'PICKED_UP')).toBe(true);
  });

  it('should_allow_READY_to_CANCELLED', () => {
    expect(isValidTransition('READY', 'CANCELLED')).toBe(true);
  });

  // Edge cases — transitions invalides
  it('should_not_allow_NEW_to_IN_PREPARATION_directly', () => {
    expect(isValidTransition('NEW', 'IN_PREPARATION')).toBe(false);
  });

  it('should_not_allow_NEW_to_PICKED_UP', () => {
    expect(isValidTransition('NEW', 'PICKED_UP')).toBe(false);
  });

  it('should_not_allow_NEW_to_READY', () => {
    expect(isValidTransition('NEW', 'READY')).toBe(false);
  });

  it('should_not_allow_PICKED_UP_to_any_state', () => {
    expect(isValidTransition('PICKED_UP', 'NEW')).toBe(false);
    expect(isValidTransition('PICKED_UP', 'CONFIRMED')).toBe(false);
    expect(isValidTransition('PICKED_UP', 'IN_PREPARATION')).toBe(false);
    expect(isValidTransition('PICKED_UP', 'READY')).toBe(false);
    expect(isValidTransition('PICKED_UP', 'CANCELLED')).toBe(false);
  });

  it('should_not_allow_CANCELLED_to_any_state', () => {
    expect(isValidTransition('CANCELLED', 'NEW')).toBe(false);
    expect(isValidTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(isValidTransition('CANCELLED', 'IN_PREPARATION')).toBe(false);
    expect(isValidTransition('CANCELLED', 'READY')).toBe(false);
    expect(isValidTransition('CANCELLED', 'PICKED_UP')).toBe(false);
  });

  it('should_not_allow_backward_transition_READY_to_IN_PREPARATION', () => {
    expect(isValidTransition('READY', 'IN_PREPARATION')).toBe(false);
  });

  it('should_not_allow_self_transition', () => {
    expect(isValidTransition('NEW', 'NEW')).toBe(false);
    expect(isValidTransition('CONFIRMED', 'CONFIRMED')).toBe(false);
    expect(isValidTransition('IN_PREPARATION', 'IN_PREPARATION')).toBe(false);
  });
});

// ─── VALID_TRANSITIONS ──────────────────────────────────────────────────────

describe('VALID_TRANSITIONS', () => {
  it('should_have_empty_transitions_for_terminal_states', () => {
    expect(VALID_TRANSITIONS.PICKED_UP).toHaveLength(0);
    expect(VALID_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it('should_include_CANCELLED_as_option_for_active_states', () => {
    expect(VALID_TRANSITIONS.NEW).toContain('CANCELLED');
    expect(VALID_TRANSITIONS.CONFIRMED).toContain('CANCELLED');
    expect(VALID_TRANSITIONS.IN_PREPARATION).toContain('CANCELLED');
    expect(VALID_TRANSITIONS.READY).toContain('CANCELLED');
  });

  it('should_require_CONFIRMED_before_IN_PREPARATION', () => {
    expect(VALID_TRANSITIONS.NEW).toContain('CONFIRMED');
    expect(VALID_TRANSITIONS.NEW).not.toContain('IN_PREPARATION');
    expect(VALID_TRANSITIONS.CONFIRMED).toContain('IN_PREPARATION');
  });
});

// ─── ORDER_STATUS_LABELS ─────────────────────────────────────────────────────

describe('ORDER_STATUS_LABELS', () => {
  it('should_have_a_label_for_every_order_status', () => {
    const statuses = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP', 'CANCELLED'];
    for (const status of statuses) {
      expect(ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]).toBeTruthy();
    }
  });
});
