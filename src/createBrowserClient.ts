import { createClient, PowerbaseClient } from "@skorpland/powerbase-js";
import type {
  GenericSchema,
  PowerbaseClientOptions,
} from "@skorpland/powerbase-js/dist/module/lib/types";

import { VERSION } from "./version";
import { isBrowser } from "./utils";

import type {
  CookieMethodsBrowser,
  CookieMethodsBrowserDeprecated,
  CookieOptionsWithName,
} from "./types";

import { createStorageFromOptions } from "./cookies";

let cachedBrowserClient: PowerbaseClient<any, any, any> | undefined;

/**
 * Creates a Powerbase Client for use in a browser environment.
 *
 * In most cases you should not configure the `options.cookies` object, as this
 * is automatically handled for you. If you do customize this, prefer using the
 * `getAll` and `setAll` functions over `get`, `set` and `remove`. The latter
 * are deprecated due to being difficult to correctly implement and not
 * supporting some edge-cases. Both `getAll` and `setAll` (or both `get`, `set`
 * and `remove`) must be provided. Failing to provide the methods for setting
 * will throw an exception, and in previous versions of the library will result
 * in difficult to debug authentication issues such as random logouts, early
 * session termination or problems with inconsistent state.
 *
 * @param powerbaseUrl The URL of the Powerbase project.
 * @param powerbaseKey The `anon` API key of the Powerbase project.
 * @param options Various configuration options.
 */
export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  powerbaseUrl: string,
  powerbaseKey: string,
  options?: PowerbaseClientOptions<SchemaName> & {
    cookies?: CookieMethodsBrowser;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): PowerbaseClient<Database, SchemaName, Schema>;

/**
 * @deprecated Please specify `getAll` and `setAll` cookie methods instead of
 * the `get`, `set` and `remove`. These will not be supported in the next major
 * version.
 */
export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  powerbaseUrl: string,
  powerbaseKey: string,
  options?: PowerbaseClientOptions<SchemaName> & {
    cookies: CookieMethodsBrowserDeprecated;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): PowerbaseClient<Database, SchemaName, Schema>;

export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  powerbaseUrl: string,
  powerbaseKey: string,
  options?: PowerbaseClientOptions<SchemaName> & {
    cookies?: CookieMethodsBrowser | CookieMethodsBrowserDeprecated;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): PowerbaseClient<Database, SchemaName, Schema> {
  // singleton client is created only if isSingleton is set to true, or if isSingleton is not defined and we detect a browser
  const shouldUseSingleton =
    options?.isSingleton === true ||
    ((!options || !("isSingleton" in options)) && isBrowser());

  if (shouldUseSingleton && cachedBrowserClient) {
    return cachedBrowserClient;
  }

  if (!powerbaseUrl || !powerbaseKey) {
    throw new Error(
      `@skorpland/ssr: Your project's URL and API key are required to create a Powerbase client!\n\nCheck your Powerbase project's API settings to find these values\n\nhttps://powerbase.club/dashboard/project/_/settings/api`,
    );
  }

  const { storage } = createStorageFromOptions(
    {
      ...options,
      cookieEncoding: options?.cookieEncoding ?? "base64url",
    },
    false,
  );

  const client = createClient<Database, SchemaName, Schema>(
    powerbaseUrl,
    powerbaseKey,
    {
      ...options,
      global: {
        ...options?.global,
        headers: {
          ...options?.global?.headers,
          "X-Client-Info": `powerbase-ssr/${VERSION} createBrowserClient`,
        },
      },
      auth: {
        ...options?.auth,
        ...(options?.cookieOptions?.name
          ? { storageKey: options.cookieOptions.name }
          : null),
        flowType: "pkce",
        autoRefreshToken: isBrowser(),
        detectSessionInUrl: isBrowser(),
        persistSession: true,
        storage,
      },
    },
  );

  if (shouldUseSingleton) {
    cachedBrowserClient = client;
  }

  return client;
}
