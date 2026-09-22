import { describe, expect, it } from 'vitest';
import { createExperienceCoordinator } from './ExperienceCoordinator';

describe('ExperienceCoordinator', () => {
  it('launches only one journey at a time', () => {
    const journey = createExperienceCoordinator();
    expect(journey.move('DEPARTING')).toBe(true);
    expect(journey.move('DEPARTING')).toBe(false);
    expect(journey.move('ARRIVING')).toBe(true);
    expect(journey.move('EXPLORING')).toBe(true);
  });
  it('resumes the controller that was suspended', () => {
    const journey = createExperienceCoordinator();
    journey.move('DEPARTING'); journey.suspend(); journey.resume();
    expect(journey.state).toBe('DEPARTING');
  });
});
