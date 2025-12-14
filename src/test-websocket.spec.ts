// src/test-websocket.spec.ts
import { FastifyRequest } from 'fastify';

describe('websocketRoutes', () => {
  let mockRedis: any;
  let websocketRoutes: any;

  beforeEach(() => {
    jest.resetModules();

    let pmessageHandler: any = undefined;

    mockRedis = {
      psubscribe: jest.fn().mockResolvedValue('OK'),
      on: jest.fn((event: string, handler: any) => {
        if (event === 'pmessage') pmessageHandler = handler;
      }),
      removeListener: jest.fn((event: string, handler: any) => {
        if (event === 'pmessage' && pmessageHandler === handler) pmessageHandler = undefined;
      }),
      // helper for tests to trigger pmessage
      __emitPmessage: (pattern: string, channel: string, message: string) => {
        if (pmessageHandler) pmessageHandler(pattern, channel, message);
      },
    };

    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => mockRedis);
    });

    // import after mocking ioredis
    websocketRoutes = require('./lib/websocket').websocketRoutes;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards Redis pmessage to websocket client', async () => {
    const routeHandlerHolder: { handler?: any; postHandler?: any } = {};

    const mockFastify: any = {
      get: jest.fn((path: string, opts: any, handler: any) => {
        routeHandlerHolder.handler = handler;
      }),
      post: jest.fn((path: string, opts: any, handler: any) => {
        // also capture post handler (for upgrade via POST)
        routeHandlerHolder.postHandler = handler;
      }),
    };

    await websocketRoutes(mockFastify as any);

    expect(mockFastify.get).toHaveBeenCalled();

    // create a fake socket
    const sent: string[] = [];
    let closeCb: any;
    const mockSocket: any = {
      readyState: 1, // WebSocket.OPEN
      send: (msg: string) => sent.push(msg),
      on: (event: string, cb: any) => {
        if (event === 'close') closeCb = cb;
      },
    };

    const connection = { socket: mockSocket };
    const req: Partial<FastifyRequest> = { params: { orderId: 'abc123' } } as any;

    // call the registered handler
    routeHandlerHolder.handler(connection, req);

    // also ensure POST route was registered
    expect(mockFastify.post).toHaveBeenCalled();

    // trigger pmessage
    mockRedis.__emitPmessage(null, 'order-updates:abc123', 'hello-world');

    expect(sent).toContain('hello-world');

    // trigger close and expect removeListener to be called
    closeCb && closeCb();
    expect(mockRedis.removeListener).toHaveBeenCalled();
  });

  it('HTTP POST upgrades and first message is pending until open', async () => {
    const holder: { handler?: any; postHandler?: any } = {};
    const mockFastify: any = {
      get: jest.fn((p: string, o: any, h: any) => (holder.handler = h)),
      post: jest.fn((p: string, o: any, h: any) => (holder.postHandler = h)),
    };

    await websocketRoutes(mockFastify as any);

    // simulate socket that is not yet OPEN
    const sent: string[] = [];
    let openCb: any;
    const mockSocket: any = {
      readyState: 0, // CONNECTING
      send: (msg: string) => sent.push(msg),
      on: (event: string, cb: any) => {
        if (event === 'open') openCb = cb;
        if (event === 'close') {
          /* noop */
        }
      },
    };

    const connection = { socket: mockSocket };
    const req: Partial<FastifyRequest> = { params: { orderId: 'pending1' } } as any;

    // call POST handler (upgrade via POST)
    holder.postHandler(connection, req);

    // emit message before socket is open -> should be queued
    mockRedis.__emitPmessage(null, 'order-updates:pending1', 'first-message');
    expect(sent).toHaveLength(0);

    // now simulate socket opening
    mockSocket.readyState = 1;
    openCb && openCb();

    // queued message should have been flushed
    expect(sent).toContain('first-message');
  });

  it('does not send message for other channels', async () => {
    const routeHandlerHolder: { handler?: any; postHandler?: any } = {};

    const mockFastify: any = {
      get: jest.fn((path: string, opts: any, handler: any) => {
        routeHandlerHolder.handler = handler;
      }),
      post: jest.fn((path: string, opts: any, handler: any) => {
        routeHandlerHolder.postHandler = handler;
      }),
    };

    await websocketRoutes(mockFastify as any);

    const sent: string[] = [];
    const mockSocket: any = {
      readyState: 1,
      send: (msg: string) => sent.push(msg),
      on: (_: string, __: any) => {},
    };

    const connection = { socket: mockSocket };
    const req: Partial<FastifyRequest> = { params: { orderId: 'orderX' } } as any;

    routeHandlerHolder.handler(connection, req);

    // different channel should not be forwarded
    mockRedis.__emitPmessage(null, 'order-updates:other', 'nope');
    expect(sent).toHaveLength(0);
  });
});
