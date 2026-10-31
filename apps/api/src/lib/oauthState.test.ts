import { describe, expect, it } from 'vitest';
import {
  OAUTH_STATE_PREFIX,
  signOAuthState,
  verifyOAuthState,
  type OAuthStateStore,
} from './oauthState';

const SECRET = 'oauth-state-test-secret';

function memoryStore() {
  const values = new Map<string, string>();
  const store: OAuthStateStore = {
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve('OK');
    },
    getdel: (key) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return Promise.resolve(value);
    },
  };
  return { store, values };
}

const input = {
  workspaceId: 'workspace-1',
  userId: 'user-1',
  platform: 'google_ads' as const,
};

describe('oauthState', () => {
  it('signs a state and consumes its jti on first use', async () => {
    const { store, values } = memoryStore();
    const token = await signOAuthState(input, { store, secret: SECRET });

    const claims = await verifyOAuthState(token, { store, secret: SECRET });
    expect(claims).toMatchObject(input);
    expect(claims.jti).toEqual(expect.any(String));
    expect(values.size).toBe(0);
    expect([...values.keys()].some((key) => key.startsWith(OAUTH_STATE_PREFIX))).toBe(false);
  });

  it('rejects a replayed state', async () => {
    const { store } = memoryStore();
    const token = await signOAuthState(input, { store, secret: SECRET });

    await verifyOAuthState(token, { store, secret: SECRET });
    await expect(verifyOAuthState(token, { store, secret: SECRET })).rejects.toThrow();
  });

  it('rejects an expired state', async () => {
    const { store } = memoryStore();
    const token = await signOAuthState(input, { store, secret: SECRET, ttlSeconds: 0 });
    await expect(verifyOAuthState(token, { store, secret: SECRET })).rejects.toThrow();
  });

  it('rejects a tampered or wrongly signed state', async () => {
    const { store } = memoryStore();
    const token = await signOAuthState(input, { store, secret: SECRET });

    await expect(
      verifyOAuthState(`${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`, {
        store,
        secret: SECRET,
      }),
    ).rejects.toThrow();
    await expect(verifyOAuthState(token, { store, secret: 'other-secret' })).rejects.toThrow();
  });
});
