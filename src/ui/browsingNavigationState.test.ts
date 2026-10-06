import { describe, expect, test } from '@jest/globals';

import {
  backBrowsing,
  createBrowsingPresentation,
  currentBrowsingSurface,
  isBrowsingSettings,
  navigateBrowsing,
  openMoreSurface,
  openBrowsingProfile,
  openBrowsingConversation,
  selectPeopleMode,
  openBrowsingSettings,
} from './browsingNavigationState';

describe('browsing presentation state', () => {
  test.each(['home', 'history', 'people', 'more'] as const)('represents %s as a browsing root', (destination) => {
    const state = createBrowsingPresentation(destination);
    expect(state.destination).toBe(destination);
    expect(state.stack).toEqual([{ kind: 'root', destination }]);
  });

  test('settings is nested and retains the browsing origin', () => {
    const state = openBrowsingSettings(createBrowsingPresentation('more'));
    expect(isBrowsingSettings(state)).toBe(true);
    expect(state.destination).toBe('more');
    expect(backBrowsing(state)).toEqual(createBrowsingPresentation('more'));
  });

  test('opening Settings again does not append another entry', () => {
    const settings = openBrowsingSettings(createBrowsingPresentation('people'));
    expect(openBrowsingSettings(settings)).toBe(settings);
    expect(settings.stack).toHaveLength(2);
  });

  test.each(['history', 'people', 'more'] as const)('root %s goes back to Home', (destination) => {
    expect(backBrowsing(createBrowsingPresentation(destination))).toEqual(createBrowsingPresentation('home'));
  });

  test('root Home leaves system Back available', () => {
    const home = createBrowsingPresentation('home');
    expect(backBrowsing(home)).toBe(home);
  });

  test('changing browsing root is a presentation-only transition', () => {
    const people = navigateBrowsing(createBrowsingPresentation('home'), 'people');
    expect(people).toEqual(createBrowsingPresentation('people'));
  });

  test.each(['tools', 'about'] as const)('nested More %s backs to More then Home', (kind) => {
    const more = createBrowsingPresentation('more');
    const nested = openMoreSurface(more, kind);
    expect(currentBrowsingSurface(nested)).toEqual({ kind, origin: 'more' });
    expect(openMoreSurface(nested, kind)).toBe(nested);
    expect(backBrowsing(nested)).toEqual(more);
    expect(backBrowsing(backBrowsing(nested))).toEqual(createBrowsingPresentation('home'));
  });

  test('selecting any destination resets its nested presentation to root', () => {
    const nested = openMoreSurface(createBrowsingPresentation('more'), 'tools');
    expect(navigateBrowsing(nested, 'more')).toEqual(createBrowsingPresentation('more'));
    expect(navigateBrowsing(nested, 'history')).toEqual(createBrowsingPresentation('history'));
    expect(openMoreSurface(createBrowsingPresentation('home'), 'tools')).toEqual(createBrowsingPresentation('home'));
  });

});


test('Live Home intent resets any previous browsing destination to Home root', () => {
  const settings = openBrowsingSettings(createBrowsingPresentation('more'));
  expect(navigateBrowsing(settings, 'home')).toEqual(createBrowsingPresentation('home'));
});


test.each(['people', 'more'] as const)('Profile opened from %s returns to its browsing origin', (origin) => {
  const root = createBrowsingPresentation(origin);
  const profile = openBrowsingProfile(root, 'Ada');
  expect(profile.destination).toBe(origin);
  expect(currentBrowsingSurface(profile)).toEqual({ kind: 'profile', origin, username: 'Ada' });
  expect(backBrowsing(profile)).toEqual(root);
  expect(navigateBrowsing(profile, 'home')).toEqual(createBrowsingPresentation('home'));
});


test('Messages Conversation Back restores the App-owned Messages selection', () => {
  const messages = selectPeopleMode(createBrowsingPresentation('people'), 'messages');
  const conversation = openBrowsingConversation(messages, 'Alice');
  expect(currentBrowsingSurface(conversation)).toEqual({ kind: 'conversation', username: 'Alice', origin: 'people' });
  expect(backBrowsing(conversation)).toEqual(messages);
  expect(openBrowsingConversation(conversation, 'Alice')).toBe(conversation);
});

test('People Profile Message Back restores Profile then People', () => {
  const people = createBrowsingPresentation('people');
  const profile = openBrowsingProfile(people, 'Bob');
  const conversation = openBrowsingConversation(profile, 'Bob');
  expect(backBrowsing(conversation)).toEqual(profile);
  expect(backBrowsing(backBrowsing(conversation))).toEqual(people);
});
