import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type {
  FinanceHttpConcreteFrameworkRequest,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type {
  FinanceHttpPostgresManagedProjectRuntimeProcessContract,
  FinanceHttpPostgresManagedProjectRuntimeProcessSummary,
  FinanceHttpPostgresManagedProjectRuntimeProcessShutdownResult,
} from './financeHttpPostgresManagedProjectRuntimeProcessContract.js';
import {
  validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary,
} from './financeHttpPostgresManagedProjectRuntimeProcessContract.js';

export type FinanceHttpPostgresManagedProjectRuntimeNodeServerHandle = {
  close: (input?: { requestId?: string }) => Promise<FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult>;
  origin: string;
  summary: FinanceHttpPostgresManagedProjectRuntimeNodeServerSummary;
};

export type FinanceHttpPostgresManagedProjectRuntimeNodeServerSummary = {
  host: string;
  lifecycleState: FinanceHttpPostgresManagedProjectRuntimeProcessSummary['lifecycleState'];
  origin: string;
  port: number;
  runtimeBundleEvidenceId: string;
};

export type FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult = {
  httpServerClosed: boolean;
  processShutdown: FinanceHttpPostgresManagedProjectRuntimeProcessShutdownResult;
};

export type FinanceHttpPostgresManagedProjectRuntimeNodeServerContract = {
  listen: (options?: {
    host?: string;
    port?: number;
  }) => Promise<FinanceHttpPostgresManagedProjectRuntimeNodeServerHandle>;
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
    throw new Error('Finance managed project runtime local HTTP server did not expose a listening port.');
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

function writeHeaders(response: ServerResponse<IncomingMessage>, headers: Record<string, string>) {
  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
}

function writeErrorResponse({
  error,
  response,
}: {
  error: unknown;
  response: ServerResponse<IncomingMessage>;
}) {
  response.statusCode = 500;
  writeHeaders(response, JSON_HEADERS);
  response.setHeader('x-finance-local-project-runtime-node-server-entry', 'error');
  response.end(
    JSON.stringify({
      code: 'FINANCE_LOCAL_PROJECT_RUNTIME_NODE_SERVER_ERROR',
      message: error instanceof Error ? error.message : '本地财务项目运行进程 HTTP 服务处理失败。',
    }),
  );
}

function createConcreteFrameworkRequest({
  bodyText,
  request,
}: {
  bodyText: string;
  request: IncomingMessage;
}): FinanceHttpConcreteFrameworkRequest {
  return {
    bodyText: bodyText || undefined,
    headers: request.headers,
    method: request.method || 'GET',
    url: request.url || '/',
  };
}

function assertActiveProcess(process: FinanceHttpPostgresManagedProjectRuntimeProcessContract) {
  const summary = process.getProcessSummary();
  const validation = validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary(summary);

  if (!validation.ok) {
    throw new Error(`Finance project runtime process summary is invalid: ${validation.errors.join(', ')}`);
  }

  if (summary.lifecycleState !== 'active') {
    throw new Error(`Finance project runtime process is not active: ${summary.lifecycleState}`);
  }
}

function assertLocalHost(host: string) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('Finance project runtime local HTTP server may only bind localhost in this contract.');
  }
}

export function createFinanceHttpPostgresManagedProjectRuntimeNodeServerTraceHeaders(
  processSummary: FinanceHttpPostgresManagedProjectRuntimeProcessSummary,
) {
  return {
    'x-finance-local-project-runtime-node-server-entry': 'project-runtime-process',
    'x-finance-local-project-runtime-node-server-lifecycle': processSummary.lifecycleState,
    'x-finance-local-project-runtime-node-server-runtime-bundle':
      processSummary.runtimeImplementationBundle?.serviceRuntimeAdmissionEvidenceId ?? 'missing',
  };
}

export function createFinanceHttpPostgresManagedProjectRuntimeNodeServerContract({
  process,
}: {
  process: FinanceHttpPostgresManagedProjectRuntimeProcessContract;
}): FinanceHttpPostgresManagedProjectRuntimeNodeServerContract {
  return {
    listen: ({ host = '127.0.0.1', port = 0 } = {}) =>
      new Promise((resolve, reject) => {
        try {
          assertLocalHost(host);
          assertActiveProcess(process);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));

          return;
        }

        const server = createServer((request, response) => {
          void readBody(request)
            .then(async (bodyText) => {
              const runtimeResponse = await process.handleConcreteFrameworkRequest(
                createConcreteFrameworkRequest({ bodyText, request }),
              );
              const processSummary = process.getProcessSummary();

              response.statusCode = runtimeResponse.status;
              writeHeaders(response, runtimeResponse.headers);
              writeHeaders(
                response,
                createFinanceHttpPostgresManagedProjectRuntimeNodeServerTraceHeaders(processSummary),
              );
              response.end(runtimeResponse.bodyText);
            })
            .catch((error: unknown) => {
              writeErrorResponse({ error, response });
            });
        });

        const handleError = (error?: Error) => {
          reject(error ?? new Error('Finance managed project runtime local HTTP server failed to listen.'));
        };

        server.once('error', handleError);
        server.listen(port, host, () => {
          server.off('error', handleError);
          const listeningPort = getListeningPort(server);
          const processSummary = process.getProcessSummary();
          const origin = `http://${host}:${listeningPort}`;

          resolve({
            close: async ({ requestId = 'project-runtime-node-server-shutdown' } = {}) => {
              await closeServer(server);
              const processShutdown = await process.shutdown({ requestId });

              return {
                httpServerClosed: true,
                processShutdown,
              };
            },
            origin,
            summary: {
              host,
              lifecycleState: processSummary.lifecycleState,
              origin,
              port: listeningPort,
              runtimeBundleEvidenceId:
                processSummary.runtimeImplementationBundle?.serviceRuntimeAdmissionEvidenceId ?? 'missing',
            },
          });
        });
      }),
  };
}
