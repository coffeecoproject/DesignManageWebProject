declare module 'node:http' {
  export type IncomingHttpHeaders = Record<string, string | readonly string[] | undefined>;

  export interface IncomingMessage {
    headers: IncomingHttpHeaders;
    method?: string;
    setEncoding: (encoding: string) => void;
    statusCode?: number;
    url?: string;
    on: (event: string, listener: (chunk?: unknown) => void) => IncomingMessage;
  }

  export interface ServerResponse {
    end: (body?: string) => void;
    setHeader: (name: string, value: string) => void;
    statusCode: number;
  }

  export interface Server {
    address: () => { address: string; family: string; port: number } | string | null;
    close: (callback: (error?: Error) => void) => void;
    listen: (port: number, host: string, callback: () => void) => void;
    off: (event: string, listener: (error?: Error) => void) => Server;
    once: (event: string, listener: (error?: Error) => void) => Server;
  }

  export interface ClientRequest {
    end: () => void;
    on: (event: string, listener: (error?: Error) => void) => ClientRequest;
    write: (body: string) => void;
  }

  export type RequestOptions = {
    headers?: Record<string, string | undefined>;
    method?: string;
  };

  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void
  ): Server;

  export function request(
    url: string,
    options: RequestOptions,
    callback: (response: IncomingMessage) => void
  ): ClientRequest;
}
