import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  const previousAdminToken = process.env.ADMIN_TOKEN;

  afterEach(() => {
    if (previousAdminToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousAdminToken;
  });

  function socket() {
    return {
      join: jest.fn(),
      leave: jest.fn(),
    };
  }

  it('joins only well-formed room channels', () => {
    const gateway = new RealtimeGateway();
    const client = socket();

    expect(
      gateway.joinRoom(client as never, { roomId: 'abcDEF123_-4' }),
    ).toEqual({ ok: true, room: 'abcDEF123_-4' });
    expect(client.join).toHaveBeenCalledWith('room:abcDEF123_-4');

    expect(gateway.joinRoom(client as never, { roomId: '../../admin' })).toEqual(
      { ok: false },
    );
    expect(gateway.joinRoom(client as never, { roomId: 'short' })).toEqual({
      ok: false,
    });
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it('leaves only well-formed room channels', () => {
    const gateway = new RealtimeGateway();
    const client = socket();

    expect(gateway.leaveRoom(client as never, { roomId: 'ROOM_1234' })).toEqual({
      ok: true,
    });
    expect(client.leave).toHaveBeenCalledWith('room:ROOM_1234');

    expect(gateway.leaveRoom(client as never, { roomId: 'bad room' })).toEqual({
      ok: false,
    });
    expect(client.leave).toHaveBeenCalledTimes(1);
  });

  it('authenticates admin sockets with the configured token', () => {
    process.env.ADMIN_TOKEN = 'test-admin-token-32-chars-XXXXXX';
    const gateway = new RealtimeGateway();
    const client = socket();

    expect(
      gateway.adminAuth(client as never, {
        token: 'test-admin-token-32-chars-XXXXXX',
      }),
    ).toEqual({ ok: true });
    expect(client.join).toHaveBeenCalledWith('admin');

    expect(gateway.adminAuth(client as never, { token: 'wrong-token' })).toEqual(
      { ok: false },
    );
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it('does not enable admin sockets when ADMIN_TOKEN is missing or too short', () => {
    process.env.ADMIN_TOKEN = 'short';
    const gateway = new RealtimeGateway();
    const client = socket();

    expect(gateway.adminAuth(client as never, { token: 'short' })).toEqual({
      ok: false,
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('emits admin events only to the admin room', () => {
    const gateway = new RealtimeGateway();
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    gateway.server = { to } as never;

    gateway.emitAdminEvent('room_created', { roomId: 'abcDEF123456' });

    expect(to).toHaveBeenCalledWith('admin');
    expect(emit).toHaveBeenCalledWith(
      'admin:event',
      expect.objectContaining({
        type: 'room_created',
        roomId: 'abcDEF123456',
        ts: expect.any(String),
      }),
    );
  });
});
