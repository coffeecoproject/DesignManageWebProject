import { createServer, type IncomingMessage, type Server } from 'node:http';

import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';

export type FinanceNodeHttpServerHandle = {
  close: () => Promise<void>;
  origin: string;
};

export type FinanceNodeHttpServerContract = {
  listen: (options?: {
    host?: string;
    port?: number;
  }) => Promise<FinanceNodeHttpServerHandle>;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let bodyText = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      bodyText += String(chunk ?? '');
    });
    request.on('end', () => resolve(bodyText));
    request.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function getListeningPort(server: Server) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Finance local HTTP server did not expose a listening port.');
  }

  return address.port;
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });
  });
}

export function createFinanceNodeHttpServerContract({
  handler
}: {
  handler: FinanceHttpServerHandler;
}): FinanceNodeHttpServerContract {
  const server = createServer((request, response) => {
    void readBody(request)
      .then((bodyText) => {
        const handlerResponse = handler.handleServerHandlerRequest({
          bodyText: bodyText || undefined,
          headers: request.headers,
          method: request.method || 'GET',
          url: request.url || '/'
        });

        response.statusCode = handlerResponse.status;
        Object.entries(handlerResponse.headers).forEach(([key, value]) => {
          response.setHeader(key, value);
        });
        response.setHeader('x-finance-local-server-handled', handlerResponse.handled ? 'true' : 'false');
        response.end(handlerResponse.bodyText);
      })
      .catch((error: unknown) => {
        response.statusCode = 500;
        Object.entries(jsonHeaders).forEach(([key, value]) => {
          response.setHeader(key, value);
        });
        response.end(
          JSON.stringify({
            code: 'FINANCE_LOCAL_HTTP_SERVER_ERROR',
            message: error instanceof Error ? error.message : '本地财务 HTTP 服务处理失败。'
          })
        );
      });
  });

  return {
    listen: ({ host = '127.0.0.1', port = 0 } = {}) =>
      new Promise((resolve, reject) => {
        const handleError = (error?: Error) => {
          reject(error ?? new Error('Finance local HTTP server failed to listen.'));
        };

        server.once('error', handleError);
        server.listen(port, host, () => {
          server.off('error', handleError);
          resolve({
            close: () => closeServer(server),
            origin: `http://${host}:${getListeningPort(server)}`
          });
        });
      })
  };
}
