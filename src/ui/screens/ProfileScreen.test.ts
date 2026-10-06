import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const read = (file: string) => readFileSync(resolve(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
const app = read('../../../App.tsx');
const profile = read('ProfileScreen.tsx');

test('own Profile keeps You and reserves friend-state labels for other users', () => {
  const markers = profile.slice(profile.indexOf('<View style='), profile.indexOf('</View>'));
  expect(markers).toContain('{profile.isOwnUser && <Pill>You</Pill>}');
  expect(markers).toContain("{!profile.isOwnUser && <Pill>{profile.isFriend ? 'Friend' : 'Not a friend'}</Pill>}");
  expect(markers.match(/<Pill>/g)).toHaveLength(2);
});

test('browsing origins share Profile with App-owned Back and existing global navigation', () => {
  expect(app).toContain('onProfile={(name) => setBrowsing((state) => openBrowsingProfile(state, name))}');
  expect(app).toContain('if (name !== undefined) setBrowsing((state) => openBrowsingProfile(state, name))');
  expect(read('MoreScreen.tsx')).toContain('<ActionButton title="My Profile" onPress={onProfile} />');
  expect(app).toContain("browsingSurface.kind === 'profile'");
  expect(app).toContain('setBrowsing((state) => backBrowsing(state))');
  expect(app).toContain('returnPresentation={returnPresentation} onReturn={returnToRoom}');
});

test('room-owned Profile retains participant origin, focus and attendance', () => {
  const opening = app.slice(app.indexOf('const renderLiveUser'), app.indexOf('const liveClientState'));
  expect(opening).toContain("kind: 'profile', username: name, origin: 'menu-participants'");
  expect(opening).not.toMatch(/setPresentationFocus|setBrowsing|lobbyRuntime|dispatch/);
  const back = app.slice(app.indexOf('const backRoomChild ='), app.indexOf("BackHandler.addEventListener"));
  expect(back).toContain('setRoomChild(decision.origin)');
  expect(back).not.toMatch(/lobbyRuntime|setFriend|sendPrivateMessage|dispatch/);
  expect(app).toContain('<ProfileScreen username={roomChild.username} roomOccupied={browsingRoomOccupied} room={`table${liveTableID}`} />');
  const globalNav = app.slice(app.indexOf('const showBrowsingNavigation'), app.indexOf('const railNavigation'));
  expect(globalNav).toContain("presentationFocus === 'browsing'");
  expect(profile).not.toMatch(/BrowsingNavigation|setPresentationFocus|unattend|leaveRoom/);
});

test('Profile uses current selectors and the unchanged context actions for Friend and Dialog', () => {
  expect(profile).toContain('useAppSelector(userSelectors.selectAll)');
  expect(profile).toContain('useAppSelector(tableSelectors.selectAll)');
  expect(profile).toContain('state.session.friends');
  expect(profile).toContain('getProfilePresentation(username, users, friends, authenticatedUser, tables)');
  expect(profile).toContain('isFriend={profile.isFriend} room={room}');
  expect(profile).toContain('!profile.isOwnUser');
  const actions = read('../UserContextActions.tsx');
  expect(actions).toContain('chatRuntime.setFriend(username, !isFriend, room)');
  expect(actions).toContain('sessionPrivateMessages(messagesByRoom, authenticatedUsername, username)');
  expect(actions).toContain('chatRuntime.sendPrivateMessage(username, message, room)');
  expect(profile).not.toMatch(/statistics|gameHistory|messagesByRoom|Delivered|typing/);
});
