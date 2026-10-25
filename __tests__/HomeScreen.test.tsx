/**
 * Screen test: renders the real Home screen and acts like a user.
 * Native modules are replaced with simple fakes (they can't run in Node).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../src/app/(tabs)/index';
import { AppThemeProvider } from '../src/theme/ThemeProvider';
import '@testing-library/react-native/matchers';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => 'https://youtu.be/abc123') }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = (p: any) => <Text>{`icon:${p.name}`}</Text>;
  Icon.glyphMap = {};
  return { Ionicons: Icon };
});
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));

const renderHome = () =>
  render(
    <AppThemeProvider>
      <HomeScreen />
    </AppThemeProvider>,
  );

afterEach(() => {
  (global as any).fetch = undefined;
});

test('Paste fills the field and explains YouTube is not permitted (no network call)', async () => {
  const fetchSpy = jest.fn();
  (global as any).fetch = fetchSpy;
  await renderHome();
  await fireEvent.press(screen.getByText('Paste'));
  expect(await screen.findByText("YouTube doesn't permit downloading here")).toBeTruthy();
  expect(screen.getByText('Open in YouTube')).toBeTruthy();
  expect(screen.getByDisplayValue('https://youtu.be/abc123')).toBeTruthy();
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('A direct MP3 link shows the file and needs permission confirmation before download', async () => {
  (global as any).fetch = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: (n: string) => ({ 'content-type': 'audio/mpeg', 'content-length': '3145728' } as any)[n.toLowerCase()] ?? null },
  }));
  await renderHome();
  await fireEvent.changeText(screen.getByLabelText('Media link'), 'https://cdn.example.com/My%20Song.mp3');
  await fireEvent.press(screen.getByText('Check link'));

  expect(await screen.findByText('My Song')).toBeTruthy();
  expect(screen.getByText('MP3 · original file · 3.0 MB')).toBeTruthy();

  expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  await fireEvent.press(screen.getByText(/I own this file/));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled());
});

test('Invalid text shows a friendly validation message', async () => {
  await renderHome();
  await fireEvent.changeText(screen.getByLabelText('Media link'), 'hello world');
  await fireEvent.press(screen.getByText('Check link'));
  expect(await screen.findByText(/doesn't look like a valid web link/)).toBeTruthy();
});
