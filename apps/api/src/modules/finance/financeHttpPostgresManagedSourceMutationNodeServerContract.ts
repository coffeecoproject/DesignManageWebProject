import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

export type FinanceHttpPostgresManagedSourceMutationNodeServerHandle = {
  close: () => Promise<void>;
  origin: string;
};

export type FinanceHttpPostgresManagedSourceMutationNodeServerContract = {
  listen: (options?: {
    host?: string;
    port?: number;
  }) => Promise<FinanceHttpPostgresManagedSourceMutationNodeServerHandle>;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
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
    throw new Error('Finance managed source local HTTP server did not expose a listening port.');
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

function writeResponse({
  adapterResponse,
  response,
}: {
  adapterResponse: FinanceHttpPostgresManagedSourceMutationFrameworkResponse;
  response: ServerResponse<IncomingMessage>;
}) {
  response.statusCode = adapterResponse.status;
  Object.entries(adapterResponse.headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.setHeader('x-finance-local-managed-source-server-handled', adapterResponse.handled ? 'true' : 'false');
  response.setHeader(
    'x-finance-local-managed-source-server-delegated',
    adapterResponse.adapterTrace.delegatedToServerEntry ? 'true' : 'false',
  );
  response.end(adapterResponse.bodyText);
}

export function createFinanceHttpPostgresManagedSourceMutationNodeServerContract({
  adapter,
}: {
  adapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter;
}): FinanceHttpPostgresManagedSourceMutationNodeServerContract {
  const server = createServer((request, response) => {
    void readBody(request)
      .then(async (bodyText) => {
        const adapterResponse = await adapter.handleConcreteFrameworkRequest({
          bodyText: bodyText || undefined,
          headers: request.headers,
          method: request.method || 'GET',
          url: request.url || '/',
        });

        writeResponse({ adapterResponse, response });
      })
      .catch((error: unknown) => {
        response.statusCode = 500;
        Object.entries(JSON_HEADERS).forEach(([key, value]) => {
          response.setHeader(key, value);
        });
        response.end(
          JSON.stringify({
            code: 'FINANCE_LOCAL_MANAGED_SOURCE_HTTP_SERVER_ERROR',
            message: error instanceof Error ? error.message : '本地财务源单 HTTP 服务处理失败。',
          }),
        );
      });
  });

  return {
    listen: ({ host = '127.0.0.1', port = 0 } = {}) =>
      new Promise((resolve, reject) => {
        const handleError = (error?: Error) => {
          reject(error ?? new Error('Finance managed source local HTTP server failed to listen.'));
        };

        server.once('error', handleError);
        server.listen(port, host, () => {
          server.off('error', handleError);
          resolve({
            close: () => closeServer(server),
            origin: `http://${host}:${getListeningPort(server)}`,
          });
        });
      }),
  };
}
