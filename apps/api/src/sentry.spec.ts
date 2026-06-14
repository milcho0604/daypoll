type SentryInitOptions = {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  sendDefaultPii?: boolean;
  beforeSend?: (event: {
    request?: {
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
      data?: unknown;
      url?: string;
    };
  }) => unknown;
};

describe('initSentry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.dontMock('@sentry/node');
  });

  function loadWithMock(init: jest.Mock): typeof import('./sentry') {
    jest.doMock('@sentry/node', () => ({ init }));
    // Jest 설정이 CommonJS 기반이라 dynamic import 대신 require를 쓴다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./sentry') as typeof import('./sentry');
  }

  it('does not initialize Sentry when SENTRY_DSN is missing', () => {
    delete process.env.SENTRY_DSN;
    const init = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const { initSentry } = loadWithMock(init);
    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with privacy-preserving defaults', () => {
    process.env.SENTRY_DSN = 'https://public@example.com/1';
    process.env.NODE_ENV = 'test';
    const init = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const { initSentry } = loadWithMock(init);
    initSentry();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0] as SentryInitOptions;
    expect(options).toMatchObject({
      dsn: 'https://public@example.com/1',
      environment: 'test',
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });

    const event = {
      request: {
        headers: { authorization: 'Bearer secret' },
        cookies: { session: 'secret' },
        data: { pin: '1234' },
        url: '/rooms/abcDEF123456',
      },
    };
    const sanitized = options.beforeSend?.(event) as typeof event;
    expect(sanitized.request).toEqual({ url: '/rooms/abcDEF123456' });
  });
});
