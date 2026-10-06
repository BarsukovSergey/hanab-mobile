/** Room-owned presentation state; attendance and lifecycle remain App-owned. */
export type RoomChild = null | 'chat' | 'menu' | 'menu-participants' | 'menu-perspective'
  | 'menu-tools' | 'settings' | 'tag' | 'replay-export'
  | { kind: 'profile'; username: string; origin: 'menu-participants' };

export function isRoomProfileChild(child: RoomChild): child is Extract<RoomChild, { kind: 'profile' }> {
  return typeof child === 'object' && child !== null && child.kind === 'profile';
}

export type RoomChildBackDecision =
  | { kind: 'profile-origin'; origin: 'menu-participants' }
  | { kind: 'open-child'; child: 'menu' | 'menu-tools' }
  | { kind: 'chat' }
  | { kind: 'settings' }
  | { kind: 'close' };

/** Classifies Back only; App executes keyboard, Settings and state effects. */
export function getRoomChildBackDecision(child: RoomChild): RoomChildBackDecision {
  if (isRoomProfileChild(child)) return { kind: 'profile-origin', origin: child.origin };
  switch (child) {
    case 'chat': return { kind: 'chat' };
    case 'settings': return { kind: 'settings' };
    case 'tag':
    case 'replay-export': return { kind: 'open-child', child: 'menu-tools' };
    case 'menu': return { kind: 'close' };
    case 'menu-participants':
    case 'menu-perspective':
    case 'menu-tools':
    case null: return { kind: 'open-child', child: 'menu' };
  }
}

/** Chat and Settings own their chrome; this title is for the contextual panel. */
export function getRoomChildTitle(child: Exclude<RoomChild, null | 'chat' | 'settings'>, menuTitle: string): string {
  if (isRoomProfileChild(child)) return child.username;
  switch (child) {
    case 'menu': return menuTitle;
    case 'menu-participants': return 'Participants / spectators';
    case 'menu-perspective': return 'Perspective';
    case 'menu-tools': return 'Tags / replay tools';
    case 'tag': return 'Add tag';
    case 'replay-export': return 'Export replay';
  }
}
