export { type Client, createClient } from "./core/client"
export {
  ApiError,
  type ApiErrorKind,
  type ApiErrorOptions,
  toApiError,
} from "./core/error"
export {
  acceptHeaderFor,
  DEFAULT_TIMEOUT,
  normalizeBaseUrl,
} from "./core/http"
export type {
  ClientHooks,
  ClientOptions,
  FetchConfig,
  HeaderSource,
  HttpMethod,
  QueryParams,
  RequestContext,
  RequestOptions,
  ResourceFactory,
  RetryOptions,
  SendConfig,
} from "./core/types"
export type { Resources } from "./resources"
