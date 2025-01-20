// Runtime types generated with workerd@1.20241106.1 2024-11-12
/*! *****************************************************************************
Copyright (c) Cloudflare. All rights reserved.
Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.
See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* eslint-disable */
// noinspection JSUnusedGlobalSymbols
declare var onmessage: never;
/**
 * An abnormal event (called an exception) which occurs as a result of calling a method or accessing a property of a web API.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException)
 */
declare class DOMException extends Error {
    constructor(message?: string, name?: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/message) */
    readonly message: string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/name) */
    readonly name: string;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/code)
     */
    readonly code: number;
    static readonly INDEX_SIZE_ERR: number;
    static readonly DOMSTRING_SIZE_ERR: number;
    static readonly HIERARCHY_REQUEST_ERR: number;
    static readonly WRONG_DOCUMENT_ERR: number;
    static readonly INVALID_CHARACTER_ERR: number;
    static readonly NO_DATA_ALLOWED_ERR: number;
    static readonly NO_MODIFICATION_ALLOWED_ERR: number;
    static readonly NOT_FOUND_ERR: number;
    static readonly NOT_SUPPORTED_ERR: number;
    static readonly INUSE_ATTRIBUTE_ERR: number;
    static readonly INVALID_STATE_ERR: number;
    static readonly SYNTAX_ERR: number;
    static readonly INVALID_MODIFICATION_ERR: number;
    static readonly NAMESPACE_ERR: number;
    static readonly INVALID_ACCESS_ERR: number;
    static readonly VALIDATION_ERR: number;
    static readonly TYPE_MISMATCH_ERR: number;
    static readonly SECURITY_ERR: number;
    static readonly NETWORK_ERR: number;
    static readonly ABORT_ERR: number;
    static readonly URL_MISMATCH_ERR: number;
    static readonly QUOTA_EXCEEDED_ERR: number;
    static readonly TIMEOUT_ERR: number;
    static readonly INVALID_NODE_TYPE_ERR: number;
    static readonly DATA_CLONE_ERR: number;
    get stack(): any;
    set stack(value: any);
}
type WorkerGlobalScopeEventMap = {
    fetch: FetchEvent;
    scheduled: ScheduledEvent;
    queue: QueueEvent;
    unhandledrejection: PromiseRejectionEvent;
    rejectionhandled: PromiseRejectionEvent;
};
declare abstract class WorkerGlobalScope extends EventTarget<WorkerGlobalScopeEventMap> {
    EventTarget: typeof EventTarget;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console) */
interface Console {
    "assert"(condition?: boolean, ...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/clear_static) */
    clear(): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/count_static) */
    count(label?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/countReset_static) */
    countReset(label?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/debug_static) */
    debug(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dir_static) */
    dir(item?: any, options?: any): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dirxml_static) */
    dirxml(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/error_static) */
    error(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/group_static) */
    group(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupCollapsed_static) */
    groupCollapsed(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupEnd_static) */
    groupEnd(): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/info_static) */
    info(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/log_static) */
    log(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/table_static) */
    table(tabularData?: any, properties?: string[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/time_static) */
    time(label?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeEnd_static) */
    timeEnd(label?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeLog_static) */
    timeLog(label?: string, ...data: any[]): void;
    timeStamp(label?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/trace_static) */
    trace(...data: any[]): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/warn_static) */
    warn(...data: any[]): void;
}
declare const console: Console;
type BufferSource = ArrayBufferView | ArrayBuffer;
type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;
declare namespace WebAssembly {
    class CompileError extends Error {
        constructor(message?: string);
    }
    class RuntimeError extends Error {
        constructor(message?: string);
    }
    type ValueType = "anyfunc" | "externref" | "f32" | "f64" | "i32" | "i64" | "v128";
    interface GlobalDescriptor {
        value: ValueType;
        mutable?: boolean;
    }
    class Global {
        constructor(descriptor: GlobalDescriptor, value?: any);
        value: any;
        valueOf(): any;
    }
    type ImportValue = ExportValue | number;
    type ModuleImports = Record<string, ImportValue>;
    type Imports = Record<string, ModuleImports>;
    type ExportValue = Function | Global | Memory | Table;
    type Exports = Record<string, ExportValue>;
    class Instance {
        constructor(module: Module, imports?: Imports);
        readonly exports: Exports;
    }
    interface MemoryDescriptor {
        initial: number;
        maximum?: number;
        shared?: boolean;
    }
    class Memory {
        constructor(descriptor: MemoryDescriptor);
        readonly buffer: ArrayBuffer;
        grow(delta: number): number;
    }
    type ImportExportKind = "function" | "global" | "memory" | "table";
    interface ModuleExportDescriptor {
        kind: ImportExportKind;
        name: string;
    }
    interface ModuleImportDescriptor {
        kind: ImportExportKind;
        module: string;
        name: string;
    }
    abstract class Module {
        static customSections(module: Module, sectionName: string): ArrayBuffer[];
        static exports(module: Module): ModuleExportDescriptor[];
        static imports(module: Module): ModuleImportDescriptor[];
    }
    type TableKind = "anyfunc" | "externref";
    interface TableDescriptor {
        element: TableKind;
        initial: number;
        maximum?: number;
    }
    class Table {
        constructor(descriptor: TableDescriptor, value?: any);
        readonly length: number;
        get(index: number): any;
        grow(delta: number, value?: any): number;
        set(index: number, value?: any): void;
    }
    function instantiate(module: Module, imports?: Imports): Promise<Instance>;
    function validate(bytes: BufferSource): boolean;
}
/**
 * This ServiceWorker API interface represents the global execution context of a service worker.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope)
 */
interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
    DOMException: typeof DOMException;
    WorkerGlobalScope: typeof WorkerGlobalScope;
    btoa(data: string): string;
    atob(data: string): string;
    setTimeout(callback: (...args: any[]) => void, msDelay?: number): number;
    setTimeout<Args extends any[]>(callback: (...args: Args) => void, msDelay?: number, ...args: Args): number;
    clearTimeout(timeoutId: number | null): void;
    setInterval(callback: (...args: any[]) => void, msDelay?: number): number;
    setInterval<Args extends any[]>(callback: (...args: Args) => void, msDelay?: number, ...args: Args): number;
    clearInterval(timeoutId: number | null): void;
    queueMicrotask(task: Function): void;
    structuredClone<T>(value: T, options?: StructuredSerializeOptions): T;
    reportError(error: any): void;
    fetch(input: RequestInfo, init?: RequestInit<RequestInitCfProperties>): Promise<Response>;
    self: ServiceWorkerGlobalScope;
    crypto: Crypto;
    caches: CacheStorage;
    scheduler: Scheduler;
    performance: Performance;
    Cloudflare: Cloudflare;
    readonly origin: string;
    Event: typeof Event;
    ExtendableEvent: typeof ExtendableEvent;
    CustomEvent: typeof CustomEvent;
    PromiseRejectionEvent: typeof PromiseRejectionEvent;
    FetchEvent: typeof FetchEvent;
    TailEvent: typeof TailEvent;
    TraceEvent: typeof TailEvent;
    ScheduledEvent: typeof ScheduledEvent;
    MessageEvent: typeof MessageEvent;
    CloseEvent: typeof CloseEvent;
    ReadableStreamDefaultReader: typeof ReadableStreamDefaultReader;
    ReadableStreamBYOBReader: typeof ReadableStreamBYOBReader;
    ReadableStream: typeof ReadableStream;
    WritableStream: typeof WritableStream;
    WritableStreamDefaultWriter: typeof WritableStreamDefaultWriter;
    TransformStream: typeof TransformStream;
    ByteLengthQueuingStrategy: typeof ByteLengthQueuingStrategy;
    CountQueuingStrategy: typeof CountQueuingStrategy;
    ErrorEvent: typeof ErrorEvent;
    EventSource: typeof EventSource;
    ReadableStreamBYOBRequest: typeof ReadableStreamBYOBRequest;
    ReadableStreamDefaultController: typeof ReadableStreamDefaultController;
    ReadableByteStreamController: typeof ReadableByteStreamController;
    WritableStreamDefaultController: typeof WritableStreamDefaultController;
    TransformStreamDefaultController: typeof TransformStreamDefaultController;
    CompressionStream: typeof CompressionStream;
    DecompressionStream: typeof DecompressionStream;
    TextEncoderStream: typeof TextEncoderStream;
    TextDecoderStream: typeof TextDecoderStream;
    Headers: typeof Headers;
    Body: typeof Body;
    Request: typeof Request;
    Response: typeof Response;
    WebSocket: typeof WebSocket;
    WebSocketPair: typeof WebSocketPair;
    WebSocketRequestResponsePair: typeof WebSocketRequestResponsePair;
    AbortController: typeof AbortController;
    AbortSignal: typeof AbortSignal;
    TextDecoder: typeof TextDecoder;
    TextEncoder: typeof TextEncoder;
    navigator: Navigator;
    Navigator: typeof Navigator;
    URL: typeof URL;
    URLSearchParams: typeof URLSearchParams;
    URLPattern: typeof URLPattern;
    Blob: typeof Blob;
    File: typeof File;
    FormData: typeof FormData;
    Crypto: typeof Crypto;
    SubtleCrypto: typeof SubtleCrypto;
    CryptoKey: typeof CryptoKey;
    CacheStorage: typeof CacheStorage;
    Cache: typeof Cache;
    FixedLengthStream: typeof FixedLengthStream;
    IdentityTransformStream: typeof IdentityTransformStream;
    HTMLRewriter: typeof HTMLRewriter;
    GPUAdapter: typeof GPUAdapter;
    GPUOutOfMemoryError: typeof GPUOutOfMemoryError;
    GPUValidationError: typeof GPUValidationError;
    GPUInternalError: typeof GPUInternalError;
    GPUDeviceLostInfo: typeof GPUDeviceLostInfo;
    GPUBufferUsage: typeof GPUBufferUsage;
    GPUShaderStage: typeof GPUShaderStage;
    GPUMapMode: typeof GPUMapMode;
    GPUTextureUsage: typeof GPUTextureUsage;
    GPUColorWrite: typeof GPUColorWrite;
}
declare function addEventListener<Type extends keyof WorkerGlobalScopeEventMap>(type: Type, handler: EventListenerOrEventListenerObject<WorkerGlobalScopeEventMap[Type]>, options?: EventTargetAddEventListenerOptions | boolean): void;
declare function removeEventListener<Type extends keyof WorkerGlobalScopeEventMap>(type: Type, handler: EventListenerOrEventListenerObject<WorkerGlobalScopeEventMap[Type]>, options?: EventTargetEventListenerOptions | boolean): void;
/**
 * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
 */
declare function dispatchEvent(event: WorkerGlobalScopeEventMap[keyof WorkerGlobalScopeEventMap]): boolean;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/btoa) */
declare function btoa(data: string): string;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/atob) */
declare function atob(data: string): string;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/setTimeout) */
declare function setTimeout(callback: (...args: any[]) => void, msDelay?: number): number;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/setTimeout) */
declare function setTimeout<Args extends any[]>(callback: (...args: Args) => void, msDelay?: number, ...args: Args): number;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/clearTimeout) */
declare function clearTimeout(timeoutId: number | null): void;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/setInterval) */
declare function setInterval(callback: (...args: any[]) => void, msDelay?: number): number;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/setInterval) */
declare function setInterval<Args extends any[]>(callback: (...args: Args) => void, msDelay?: number, ...args: Args): number;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/clearInterval) */
declare function clearInterval(timeoutId: number | null): void;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/queueMicrotask) */
declare function queueMicrotask(task: Function): void;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/structuredClone) */
declare function structuredClone<T>(value: T, options?: StructuredSerializeOptions): T;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/reportError) */
declare function reportError(error: any): void;
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch) */
declare function fetch(input: RequestInfo, init?: RequestInit<RequestInitCfProperties>): Promise<Response>;
declare const self: ServiceWorkerGlobalScope;
/**
* The Web Crypto API provides a set of low-level functions for common cryptographic tasks.
* The Workers runtime implements the full surface of this API, but with some differences in
* the [supported algorithms](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#supported-algorithms)
* compared to those implemented in most browsers.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
*/
declare const crypto: Crypto;
/**
* The Cache API allows fine grained control of reading and writing from the Cloudflare global network cache.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/)
*/
declare const caches: CacheStorage;
declare const scheduler: Scheduler;
/**
* The Workers runtime supports a subset of the Performance API, used to measure timing and performance,
* as well as timing of subrequests and other operations.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/performance/)
*/
declare const performance: Performance;
declare const Cloudflare: Cloudflare;
declare const origin: string;
declare const navigator: Navigator;
interface TestController {
}
interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}
type ExportedHandlerFetchHandler<Env = unknown, CfHostMetadata = unknown> = (request: Request<CfHostMetadata, IncomingRequestCfProperties<CfHostMetadata>>, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
type ExportedHandlerTailHandler<Env = unknown> = (events: TraceItem[], env: Env, ctx: ExecutionContext) => void | Promise<void>;
type ExportedHandlerTraceHandler<Env = unknown> = (traces: TraceItem[], env: Env, ctx: ExecutionContext) => void | Promise<void>;
type ExportedHandlerScheduledHandler<Env = unknown> = (controller: ScheduledController, env: Env, ctx: ExecutionContext) => void | Promise<void>;
type ExportedHandlerQueueHandler<Env = unknown, Message = unknown> = (batch: MessageBatch<Message>, env: Env, ctx: ExecutionContext) => void | Promise<void>;
type ExportedHandlerTestHandler<Env = unknown> = (controller: TestController, env: Env, ctx: ExecutionContext) => void | Promise<void>;
interface ExportedHandler<Env = unknown, QueueHandlerMessage = unknown, CfHostMetadata = unknown> {
    fetch?: ExportedHandlerFetchHandler<Env, CfHostMetadata>;
    tail?: ExportedHandlerTailHandler<Env>;
    trace?: ExportedHandlerTraceHandler<Env>;
    scheduled?: ExportedHandlerScheduledHandler<Env>;
    test?: ExportedHandlerTestHandler<Env>;
    email?: EmailExportedHandler<Env>;
    queue?: ExportedHandlerQueueHandler<Env, QueueHandlerMessage>;
}
interface StructuredSerializeOptions {
    transfer?: any[];
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent) */
declare abstract class PromiseRejectionEvent extends Event {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent/promise) */
    readonly promise: Promise<any>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent/reason) */
    readonly reason: any;
}
declare abstract class Navigator {
    sendBeacon(url: string, body?: (ReadableStream | string | (ArrayBuffer | ArrayBufferView) | Blob | URLSearchParams | FormData)): boolean;
    readonly userAgent: string;
    readonly gpu: GPU;
}
/**
* The Workers runtime supports a subset of the Performance API, used to measure timing and performance,
* as well as timing of subrequests and other operations.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/performance/)
*/
interface Performance {
    /* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/performance/#performancetimeorigin) */
    readonly timeOrigin: number;
    /* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/performance/#performancenow) */
    now(): number;
}
interface AlarmInvocationInfo {
    readonly isRetry: boolean;
    readonly retryCount: number;
}
interface Cloudflare {
    readonly compatibilityFlags: Record<string, boolean>;
}
interface DurableObject {
    fetch(request: Request): Response | Promise<Response>;
    alarm?(): void | Promise<void>;
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
}
type DurableObjectStub<T extends Rpc.DurableObjectBranded | undefined = undefined> = Fetcher<T, "alarm" | "webSocketMessage" | "webSocketClose" | "webSocketError"> & {
    readonly id: DurableObjectId;
    readonly name?: string;
};
interface DurableObjectId {
    toString(): string;
    equals(other: DurableObjectId): boolean;
    readonly name?: string;
}
interface DurableObjectNamespace<T extends Rpc.DurableObjectBranded | undefined = undefined> {
    newUniqueId(options?: DurableObjectNamespaceNewUniqueIdOptions): DurableObjectId;
    idFromName(name: string): DurableObjectId;
    idFromString(id: string): DurableObjectId;
    get(id: DurableObjectId, options?: DurableObjectNamespaceGetDurableObjectOptions): DurableObjectStub<T>;
    jurisdiction(jurisdiction: DurableObjectJurisdiction): DurableObjectNamespace<T>;
}
type DurableObjectJurisdiction = "eu" | "fedramp";
interface DurableObjectNamespaceNewUniqueIdOptions {
    jurisdiction?: DurableObjectJurisdiction;
}
type DurableObjectLocationHint = "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
interface DurableObjectNamespaceGetDurableObjectOptions {
    locationHint?: DurableObjectLocationHint;
}
interface DurableObjectState {
    waitUntil(promise: Promise<any>): void;
    readonly id: DurableObjectId;
    readonly storage: DurableObjectStorage;
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
    setWebSocketAutoResponse(maybeReqResp?: WebSocketRequestResponsePair): void;
    getWebSocketAutoResponse(): WebSocketRequestResponsePair | null;
    getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null;
    setHibernatableWebSocketEventTimeout(timeoutMs?: number): void;
    getHibernatableWebSocketEventTimeout(): number | null;
    getTags(ws: WebSocket): string[];
    abort(reason?: string): void;
}
interface DurableObjectTransaction {
    get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>;
    get<T = unknown>(keys: string[], options?: DurableObjectGetOptions): Promise<Map<string, T>>;
    list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;
    put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
    put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>;
    delete(key: string, options?: DurableObjectPutOptions): Promise<boolean>;
    delete(keys: string[], options?: DurableObjectPutOptions): Promise<number>;
    rollback(): void;
    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null>;
    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void>;
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void>;
}
interface DurableObjectStorage {
    get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>;
    get<T = unknown>(keys: string[], options?: DurableObjectGetOptions): Promise<Map<string, T>>;
    list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;
    put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
    put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>;
    delete(key: string, options?: DurableObjectPutOptions): Promise<boolean>;
    delete(keys: string[], options?: DurableObjectPutOptions): Promise<number>;
    deleteAll(options?: DurableObjectPutOptions): Promise<void>;
    transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null>;
    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void>;
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void>;
    sync(): Promise<void>;
    sql: SqlStorage;
    transactionSync<T>(closure: () => T): T;
    getCurrentBookmark(): Promise<string>;
    getBookmarkForTime(timestamp: number | Date): Promise<string>;
    onNextSessionRestoreBookmark(bookmark: string): Promise<string>;
}
interface DurableObjectListOptions {
    start?: string;
    startAfter?: string;
    end?: string;
    prefix?: string;
    reverse?: boolean;
    limit?: number;
    allowConcurrency?: boolean;
    noCache?: boolean;
}
interface DurableObjectGetOptions {
    allowConcurrency?: boolean;
    noCache?: boolean;
}
interface DurableObjectGetAlarmOptions {
    allowConcurrency?: boolean;
}
interface DurableObjectPutOptions {
    allowConcurrency?: boolean;
    allowUnconfirmed?: boolean;
    noCache?: boolean;
}
interface DurableObjectSetAlarmOptions {
    allowConcurrency?: boolean;
    allowUnconfirmed?: boolean;
}
declare class WebSocketRequestResponsePair {
    constructor(request: string, response: string);
    get request(): string;
    get response(): string;
}
interface AnalyticsEngineDataset {
    writeDataPoint(event?: AnalyticsEngineDataPoint): void;
}
interface AnalyticsEngineDataPoint {
    indexes?: ((ArrayBuffer | string) | null)[];
    doubles?: number[];
    blobs?: ((ArrayBuffer | string) | null)[];
}
/**
 * An event which takes place in the DOM.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event)
 */
declare class Event {
    constructor(type: string, init?: EventInit);
    /**
     * Returns the type of event, e.g. "click", "hashchange", or "submit".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)
     */
    get type(): string;
    /**
     * Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)
     */
    get eventPhase(): number;
    /**
     * Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)
     */
    get composed(): boolean;
    /**
     * Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)
     */
    get bubbles(): boolean;
    /**
     * Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)
     */
    get cancelable(): boolean;
    /**
     * Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)
     */
    get defaultPrevented(): boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)
     */
    get returnValue(): boolean;
    /**
     * Returns the object whose event listener's callback is currently being invoked.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)
     */
    get currentTarget(): EventTarget | undefined;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)
     */
    get srcElement(): EventTarget | undefined;
    /**
     * Returns the event's timestamp as the number of milliseconds measured relative to the time origin.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)
     */
    get timeStamp(): number;
    /**
     * Returns true if event was dispatched by the user agent, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)
     */
    get isTrusted(): boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)
     */
    get cancelBubble(): boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)
     */
    set cancelBubble(value: boolean);
    /**
     * Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)
     */
    stopImmediatePropagation(): void;
    /**
     * If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)
     */
    preventDefault(): void;
    /**
     * When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)
     */
    stopPropagation(): void;
    /**
     * Returns the invocation target objects of event's path (objects on which listeners will be invoked), except for any nodes in shadow trees of which the shadow root's mode is "closed" that are not reachable from event's currentTarget.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)
     */
    composedPath(): EventTarget[];
    static readonly NONE: number;
    static readonly CAPTURING_PHASE: number;
    static readonly AT_TARGET: number;
    static readonly BUBBLING_PHASE: number;
}
interface EventInit {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
}
type EventListener<EventType extends Event = Event> = (event: EventType) => void;
interface EventListenerObject<EventType extends Event = Event> {
    handleEvent(event: EventType): void;
}
type EventListenerOrEventListenerObject<EventType extends Event = Event> = EventListener<EventType> | EventListenerObject<EventType>;
/**
 * EventTarget is a DOM interface implemented by objects that can receive events and may have listeners for them.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget)
 */
declare class EventTarget<EventMap extends Record<string, Event> = Record<string, Event>> {
    constructor();
    /**
     * Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.
     *
     * The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.
     *
     * When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.
     *
     * When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.
     *
     * When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.
     *
     * If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.
     *
     * The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)
     */
    addEventListener<Type extends keyof EventMap>(type: Type, handler: EventListenerOrEventListenerObject<EventMap[Type]>, options?: EventTargetAddEventListenerOptions | boolean): void;
    /**
     * Removes the event listener in target's event listener list with the same type, callback, and options.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)
     */
    removeEventListener<Type extends keyof EventMap>(type: Type, handler: EventListenerOrEventListenerObject<EventMap[Type]>, options?: EventTargetEventListenerOptions | boolean): void;
    /**
     * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
     */
    dispatchEvent(event: EventMap[keyof EventMap]): boolean;
}
interface EventTargetEventListenerOptions {
    capture?: boolean;
}
interface EventTargetAddEventListenerOptions {
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
    signal?: AbortSignal;
}
interface EventTargetHandlerObject {
    handleEvent: (event: Event) => any | undefined;
}
/**
 * A controller object that allows you to abort one or more DOM requests as and when desired.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController)
 */
declare class AbortController {
    constructor();
    /**
     * Returns the AbortSignal object associated with this object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/signal)
     */
    get signal(): AbortSignal;
    /**
     * Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)
     */
    abort(reason?: any): void;
}
/**
 * A signal object that allows you to communicate with a DOM request (such as a Fetch) and abort it if required via an AbortController object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal)
 */
declare abstract class AbortSignal extends EventTarget {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/abort_static) */
    static abort(reason?: any): AbortSignal;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static) */
    static timeout(delay: number): AbortSignal;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/any_static) */
    static any(signals: AbortSignal[]): AbortSignal;
    /**
     * Returns true if this AbortSignal's AbortController has signaled to abort, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/aborted)
     */
    get aborted(): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/reason) */
    get reason(): any;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/abort_event) */
    get onabort(): any | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/abort_event) */
    set onabort(value: any | null);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/throwIfAborted) */
    throwIfAborted(): void;
}
interface Scheduler {
    wait(delay: number, maybeOptions?: SchedulerWaitOptions): Promise<void>;
}
interface SchedulerWaitOptions {
    signal?: AbortSignal;
}
/**
 * Extends the lifetime of the install and activate events dispatched on the global scope as part of the service worker lifecycle. This ensures that any functional events (like FetchEvent) are not dispatched until it upgrades database schemas and deletes the outdated cache entries.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableEvent)
 */
declare abstract class ExtendableEvent extends Event {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableEvent/waitUntil) */
    waitUntil(promise: Promise<any>): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent) */
declare class CustomEvent<T = any> extends Event {
    constructor(type: string, init?: CustomEventCustomEventInit);
    /**
     * Returns any custom data event was created with. Typically used for synthetic events.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent/detail)
     */
    get detail(): T;
}
interface CustomEventCustomEventInit {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
    detail?: any;
}
/**
 * A file-like object of immutable, raw data. Blobs represent data that isn't necessarily in a JavaScript-native format. The File interface is based on Blob, inheriting blob functionality and expanding it to support files on the user's system.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob)
 */
declare class Blob {
    constructor(type?: ((ArrayBuffer | ArrayBufferView) | string | Blob)[], options?: BlobOptions);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/size) */
    get size(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/type) */
    get type(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/slice) */
    slice(start?: number, end?: number, type?: string): Blob;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/arrayBuffer) */
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/text) */
    text(): Promise<string>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/stream) */
    stream(): ReadableStream;
}
interface BlobOptions {
    type?: string;
}
/**
 * Provides information about files and allows JavaScript in a web page to access their content.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/File)
 */
declare class File extends Blob {
    constructor(bits: ((ArrayBuffer | ArrayBufferView) | string | Blob)[] | undefined, name: string, options?: FileOptions);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/name) */
    get name(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/lastModified) */
    get lastModified(): number;
}
interface FileOptions {
    type?: string;
    lastModified?: number;
}
/**
* The Cache API allows fine grained control of reading and writing from the Cloudflare global network cache.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/)
*/
declare abstract class CacheStorage {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/open) */
    open(cacheName: string): Promise<Cache>;
    readonly default: Cache;
}
/**
* The Cache API allows fine grained control of reading and writing from the Cloudflare global network cache.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/)
*/
declare abstract class Cache {
    /* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/#delete) */
    delete(request: RequestInfo, options?: CacheQueryOptions): Promise<boolean>;
    /* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/#match) */
    match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined>;
    /* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/cache/#put) */
    put(request: RequestInfo, response: Response): Promise<void>;
}
interface CacheQueryOptions {
    ignoreMethod?: boolean;
}
/**
* The Web Crypto API provides a set of low-level functions for common cryptographic tasks.
* The Workers runtime implements the full surface of this API, but with some differences in
* the [supported algorithms](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#supported-algorithms)
* compared to those implemented in most browsers.
*
* [Cloudflare Docs Reference](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
*/
declare abstract class Crypto {
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/subtle)
     */
    get subtle(): SubtleCrypto;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/getRandomValues) */
    getRandomValues<T extends Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array>(buffer: T): T;
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID)
     */
    randomUUID(): string;
    DigestStream: typeof DigestStream;
}
/**
 * This Web Crypto API interface provides a number of low-level cryptographic functions. It is accessed via the Crypto.subtle properties available in a window context (via Window.crypto).
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto)
 */
declare abstract class SubtleCrypto {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/encrypt) */
    encrypt(algorithm: string | SubtleCryptoEncryptAlgorithm, key: CryptoKey, plainText: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/decrypt) */
    decrypt(algorithm: string | SubtleCryptoEncryptAlgorithm, key: CryptoKey, cipherText: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/sign) */
    sign(algorithm: string | SubtleCryptoSignAlgorithm, key: CryptoKey, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/verify) */
    verify(algorithm: string | SubtleCryptoSignAlgorithm, key: CryptoKey, signature: ArrayBuffer | ArrayBufferView, data: ArrayBuffer | ArrayBufferView): Promise<boolean>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/digest) */
    digest(algorithm: string | SubtleCryptoHashAlgorithm, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/generateKey) */
    generateKey(algorithm: string | SubtleCryptoGenerateKeyAlgorithm, extractable: boolean, keyUsages: string[]): Promise<CryptoKey | CryptoKeyPair>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/deriveKey) */
    deriveKey(algorithm: string | SubtleCryptoDeriveKeyAlgorithm, baseKey: CryptoKey, derivedKeyAlgorithm: string | SubtleCryptoImportKeyAlgorithm, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/deriveBits) */
    deriveBits(algorithm: string | SubtleCryptoDeriveKeyAlgorithm, baseKey: CryptoKey, length?: (number | null)): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/importKey) */
    importKey(format: string, keyData: (ArrayBuffer | ArrayBufferView) | JsonWebKey, algorithm: string | SubtleCryptoImportKeyAlgorithm, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/exportKey) */
    exportKey(format: string, key: CryptoKey): Promise<ArrayBuffer | JsonWebKey>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/wrapKey) */
    wrapKey(format: string, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: string | SubtleCryptoEncryptAlgorithm): Promise<ArrayBuffer>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/unwrapKey) */
    unwrapKey(format: string, wrappedKey: ArrayBuffer | ArrayBufferView, unwrappingKey: CryptoKey, unwrapAlgorithm: string | SubtleCryptoEncryptAlgorithm, unwrappedKeyAlgorithm: string | SubtleCryptoImportKeyAlgorithm, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
    timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
}
/**
 * The CryptoKey dictionary of the Web Crypto API represents a cryptographic key.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey)
 */
declare abstract class CryptoKey {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/type) */
    readonly type: string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/extractable) */
    readonly extractable: boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/algorithm) */
    readonly algorithm: CryptoKeyKeyAlgorithm | CryptoKeyAesKeyAlgorithm | CryptoKeyHmacKeyAlgorithm | CryptoKeyRsaKeyAlgorithm | CryptoKeyEllipticKeyAlgorithm | CryptoKeyArbitraryKeyAlgorithm;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/usages) */
    readonly usages: string[];
}
interface CryptoKeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}
interface JsonWebKey {
    kty: string;
    use?: string;
    key_ops?: string[];
    alg?: string;
    ext?: boolean;
    crv?: string;
    x?: string;
    y?: string;
    d?: string;
    n?: string;
    e?: string;
    p?: string;
    q?: string;
    dp?: string;
    dq?: string;
    qi?: string;
    oth?: RsaOtherPrimesInfo[];
    k?: string;
}
interface RsaOtherPrimesInfo {
    r?: string;
    d?: string;
    t?: string;
}
interface SubtleCryptoDeriveKeyAlgorithm {
    name: string;
    salt?: ArrayBuffer;
    iterations?: number;
    hash?: (string | SubtleCryptoHashAlgorithm);
    $public?: CryptoKey;
    info?: ArrayBuffer;
}
interface SubtleCryptoEncryptAlgorithm {
    name: string;
    iv?: ArrayBuffer;
    additionalData?: ArrayBuffer;
    tagLength?: number;
    counter?: ArrayBuffer;
    length?: number;
    label?: ArrayBuffer;
}
interface SubtleCryptoGenerateKeyAlgorithm {
    name: string;
    hash?: (string | SubtleCryptoHashAlgorithm);
    modulusLength?: number;
    publicExponent?: ArrayBuffer;
    length?: number;
    namedCurve?: string;
}
interface SubtleCryptoHashAlgorithm {
    name: string;
}
interface SubtleCryptoImportKeyAlgorithm {
    name: string;
    hash?: (string | SubtleCryptoHashAlgorithm);
    length?: number;
    namedCurve?: string;
    compressed?: boolean;
}
interface SubtleCryptoSignAlgorithm {
    name: string;
    hash?: (string | SubtleCryptoHashAlgorithm);
    dataLength?: number;
    saltLength?: number;
}
interface CryptoKeyKeyAlgorithm {
    name: string;
}
interface CryptoKeyAesKeyAlgorithm {
    name: string;
    length: number;
}
interface CryptoKeyHmacKeyAlgorithm {
    name: string;
    hash: CryptoKeyKeyAlgorithm;
    length: number;
}
interface CryptoKeyRsaKeyAlgorithm {
    name: string;
    modulusLength: number;
    publicExponent: ArrayBuffer | (ArrayBuffer | ArrayBufferView);
    hash?: CryptoKeyKeyAlgorithm;
}
interface CryptoKeyEllipticKeyAlgorithm {
    name: string;
    namedCurve: string;
}
interface CryptoKeyArbitraryKeyAlgorithm {
    name: string;
    hash?: CryptoKeyKeyAlgorithm;
    namedCurve?: string;
    length?: number;
}
declare class DigestStream extends WritableStream<ArrayBuffer | ArrayBufferView> {
    constructor(algorithm: string | SubtleCryptoHashAlgorithm);
    get digest(): Promise<ArrayBuffer>;
    get bytesWritten(): number | bigint;
}
/**
 * A decoder for a specific method, that is a specific character encoding, like utf-8, iso-8859-2, koi8, cp1261, gbk, etc. A decoder takes a stream of bytes as input and emits a stream of code points. For a more scalable, non-native library, see StringView – a C-like representation of strings based on typed arrays.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder)
 */
declare class TextDecoder {
    constructor(decoder?: string, options?: TextDecoderConstructorOptions);
    /**
     * Returns the result of running encoding's decoder. The method can be invoked zero or more times with options's stream set to true, and then once without options's stream (or set to false), to process a fragmented input. If the invocation without options's stream (or set to false) has no input, it's clearest to omit both arguments.
     *
     * ```
     * var string = "", decoder = new TextDecoder(encoding), buffer;
     * while(buffer = next_chunk()) {
     *   string += decoder.decode(buffer, {stream:true});
     * }
     * string += decoder.decode(); // end-of-queue
     * ```
     *
     * If the error mode is "fatal" and encoding's decoder returns error, throws a TypeError.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder/decode)
     */
    decode(input?: (ArrayBuffer | ArrayBufferView), options?: TextDecoderDecodeOptions): string;
    get encoding(): string;
    get fatal(): boolean;
    get ignoreBOM(): boolean;
}
/**
 * TextEncoder takes a stream of code points as input and emits a stream of bytes. For a more scalable, non-native library, see StringView – a C-like representation of strings based on typed arrays.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder)
 */
declare class TextEncoder {
    constructor();
    /**
     * Returns the result of running UTF-8's encoder.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder/encode)
     */
    encode(input?: string): Uint8Array;
    /**
     * Runs the UTF-8 encoder on source, stores the result of that operation into destination, and returns the progress made as an object wherein read is the number of converted code units of source and written is the number of bytes modified in destination.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto)
     */
    encodeInto(input: string, buffer: ArrayBuffer | ArrayBufferView): TextEncoderEncodeIntoResult;
    get encoding(): string;
}
interface TextDecoderConstructorOptions {
    fatal: boolean;
    ignoreBOM: boolean;
}
interface TextDecoderDecodeOptions {
    stream: boolean;
}
interface TextEncoderEncodeIntoResult {
    read: number;
    written: number;
}
/**
 * Events providing information related to errors in scripts or in files.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent)
 */
declare class ErrorEvent extends Event {
    constructor(type: string, init?: ErrorEventErrorEventInit);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/filename) */
    get filename(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/message) */
    get message(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/lineno) */
    get lineno(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/colno) */
    get colno(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/error) */
    get error(): any;
}
interface ErrorEventErrorEventInit {
    message?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    error?: any;
}
/**
 * Provides a way to easily construct a set of key/value pairs representing form fields and their values, which can then be easily sent using the XMLHttpRequest.send() method. It uses the same format a form would use if the encoding type were set to "multipart/form-data".
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData)
 */
declare class FormData {
    constructor();
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/append) */
    append(name: string, value: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/append) */
    append(name: string, value: Blob, filename?: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/delete) */
    delete(name: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/get) */
    get(name: string): (File | string) | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/getAll) */
    getAll(name: string): (File | string)[];
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/has) */
    has(name: string): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/set) */
    set(name: string, value: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/set) */
    set(name: string, value: Blob, filename?: string): void;
    /* Returns an array of key, value pairs for every entry in the list. */
    entries(): IterableIterator<[
        key: string,
        value: File | string
    ]>;
    /* Returns a list of keys in the list. */
    keys(): IterableIterator<string>;
    /* Returns a list of values in the list. */
    values(): IterableIterator<(File | string)>;
    forEach<This = unknown>(callback: (this: This, value: File | string, key: string, parent: FormData) => void, thisArg?: This): void;
    [Symbol.iterator](): IterableIterator<[
        key: string,
        value: File | string
    ]>;
}
interface ContentOptions {
    html?: boolean;
}
declare class HTMLRewriter {
    constructor();
    on(selector: string, handlers: HTMLRewriterElementContentHandlers): HTMLRewriter;
    onDocument(handlers: HTMLRewriterDocumentContentHandlers): HTMLRewriter;
    transform(response: Response): Response;
}
interface HTMLRewriterElementContentHandlers {
    element?(element: Element): void | Promise<void>;
    comments?(comment: Comment): void | Promise<void>;
    text?(element: Text): void | Promise<void>;
}
interface HTMLRewriterDocumentContentHandlers {
    doctype?(doctype: Doctype): void | Promise<void>;
    comments?(comment: Comment): void | Promise<void>;
    text?(text: Text): void | Promise<void>;
    end?(end: DocumentEnd): void | Promise<void>;
}
interface Doctype {
    readonly name: string | null;
    readonly publicId: string | null;
    readonly systemId: string | null;
}
interface Element {
    tagName: string;
    readonly attributes: IterableIterator<string[]>;
    readonly removed: boolean;
    readonly namespaceURI: string;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    setAttribute(name: string, value: string): Element;
    removeAttribute(name: string): Element;
    before(content: string, options?: ContentOptions): Element;
    after(content: string, options?: ContentOptions): Element;
    prepend(content: string, options?: ContentOptions): Element;
    append(content: string, options?: ContentOptions): Element;
    replace(content: string, options?: ContentOptions): Element;
    remove(): Element;
    removeAndKeepContent(): Element;
    setInnerContent(content: string, options?: ContentOptions): Element;
    onEndTag(handler: (tag: EndTag) => void | Promise<void>): void;
}
interface EndTag {
    name: string;
    before(content: string, options?: ContentOptions): EndTag;
    after(content: string, options?: ContentOptions): EndTag;
    remove(): EndTag;
}
interface Comment {
    text: string;
    readonly removed: boolean;
    before(content: string, options?: ContentOptions): Comment;
    after(content: string, options?: ContentOptions): Comment;
    replace(content: string, options?: ContentOptions): Comment;
    remove(): Comment;
}
interface Text {
    readonly text: string;
    readonly lastInTextNode: boolean;
    readonly removed: boolean;
    before(content: string, options?: ContentOptions): Text;
    after(content: string, options?: ContentOptions): Text;
    replace(content: string, options?: ContentOptions): Text;
    remove(): Text;
}
interface DocumentEnd {
    append(content: string, options?: ContentOptions): DocumentEnd;
}
/**
 * This is the event type for fetch events dispatched on the service worker global scope. It contains information about the fetch, including the request and how the receiver will treat the response. It provides the event.respondWith() method, which allows us to provide a response to this fetch.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent)
 */
declare abstract class FetchEvent extends ExtendableEvent {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/request) */
    readonly request: Request;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/respondWith) */
    respondWith(promise: Response | Promise<Response>): void;
    passThroughOnException(): void;
}
type HeadersInit = Headers | Iterable<Iterable<string>> | Record<string, string>;
/**
 * This Fetch API interface allows you to perform various actions on HTTP request and response headers. These actions include retrieving, setting, adding to, and removing. A Headers object has an associated header list, which is initially empty and consists of zero or more name and value pairs.  You can add to this using methods like append() (see Examples.) In all methods of this interface, header names are matched by case-insensitive byte sequence.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers)
 */
declare class Headers {
    constructor(init?: HeadersInit);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get) */
    get(name: string): string | null;
    getAll(name: string): string[];
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie) */
    getSetCookie(): string[];
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has) */
    has(name: string): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set) */
    set(name: string, value: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append) */
    append(name: string, value: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete) */
    delete(name: string): void;
    forEach<This = unknown>(callback: (this: This, value: string, key: string, parent: Headers) => void, thisArg?: This): void;
    /* Returns an iterator allowing to go through all key/value pairs contained in this object. */
    entries(): IterableIterator<[
        key: string,
        value: string
    ]>;
    /* Returns an iterator allowing to go through all keys of the key/value pairs contained in this object. */
    keys(): IterableIterator<string>;
    /* Returns an iterator allowing to go through all values of the key/value pairs contained in this object. */
    values(): IterableIterator<string>;
    [Symbol.iterator](): IterableIterator<[
        key: string,
        value: string
    ]>;
}
type BodyInit = ReadableStream<Uint8Array> | string | ArrayBuffer | ArrayBufferView | Blob | URLSearchParams | FormData;
declare abstract class Body {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/body) */
    get body(): ReadableStream | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/bodyUsed) */
    get bodyUsed(): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/arrayBuffer) */
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/text) */
    text(): Promise<string>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/json) */
    json<T>(): Promise<T>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/formData) */
    formData(): Promise<FormData>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/blob) */
    blob(): Promise<Blob>;
}
/**
 * This Fetch API interface represents the response to a request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response)
 */
declare var Response: {
    prototype: Response;
    new (body?: BodyInit | null, init?: ResponseInit): Response;
    redirect(url: string, status?: number): Response;
    json(any: any, maybeInit?: (ResponseInit | Response)): Response;
};
/**
 * This Fetch API interface represents the response to a request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response)
 */
interface Response extends Body {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/clone) */
    clone(): Response;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/status) */
    status: number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/statusText) */
    statusText: string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/headers) */
    headers: Headers;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/ok) */
    ok: boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/redirected) */
    redirected: boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/url) */
    url: string;
    webSocket: WebSocket | null;
    cf: any | undefined;
}
interface ResponseInit {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
    cf?: any;
    webSocket?: (WebSocket | null);
    encodeBody?: "automatic" | "manual";
}
type RequestInfo<CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>> = Request<CfHostMetadata, Cf> | string | URL;
/**
 * This Fetch API interface represents a resource request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request)
 */
declare var Request: {
    prototype: Request;
    new <CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>>(input: RequestInfo<CfProperties>, init?: RequestInit<Cf>): Request<CfHostMetadata, Cf>;
};
/**
 * This Fetch API interface represents a resource request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request)
 */
interface Request<CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>> extends Body {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/clone) */
    clone(): Request<CfHostMetadata, Cf>;
    /**
     * Returns request's HTTP method, which is "GET" by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/method)
     */
    method: string;
    /**
     * Returns the URL of request as a string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/url)
     */
    url: string;
    /**
     * Returns a Headers object consisting of the headers associated with request. Note that headers added in the network layer by the user agent will not be accounted for in this object, e.g., the "Host" header.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/headers)
     */
    headers: Headers;
    /**
     * Returns the redirect mode associated with request, which is a string indicating how redirects for the request will be handled during fetching. A request will follow redirects by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/redirect)
     */
    redirect: string;
    fetcher: Fetcher | null;
    /**
     * Returns the signal associated with request, which is an AbortSignal object indicating whether or not request has been aborted, and its abort event handler.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/signal)
     */
    signal: AbortSignal;
    cf: Cf | undefined;
    /**
     * Returns request's subresource integrity metadata, which is a cryptographic hash of the resource being fetched. Its value consists of multiple hashes separated by whitespace. [SRI]
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/integrity)
     */
    integrity: string;
    /**
     * Returns a boolean indicating whether or not request can outlive the global in which it was created.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/keepalive)
     */
    keepalive: boolean;
    /**
     * Returns the cache mode associated with request, which is a string indicating how the request will interact with the browser's cache when fetching.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/cache)
     */
    cache?: "no-store";
}
interface RequestInit<Cf = CfProperties> {
    /* A string to set request's method. */
    method?: string;
    /* A Headers object, an object literal, or an array of two-item arrays to set request's headers. */
    headers?: HeadersInit;
    /* A BodyInit object or null to set request's body. */
    body?: BodyInit | null;
    /* A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect. */
    redirect?: string;
    fetcher?: (Fetcher | null);
    cf?: Cf;
    /* A string indicating how the request will interact with the browser's cache to set request's cache. */
    cache?: "no-store";
    /* A cryptographic hash of the resource to be fetched by request. Sets request's integrity. */
    integrity?: string;
    /* An AbortSignal to set request's signal. */
    signal?: (AbortSignal | null);
}
type Service<T extends Rpc.WorkerEntrypointBranded | undefined = undefined> = Fetcher<T>;
type Fetcher<T extends Rpc.EntrypointBranded | undefined = undefined, Reserved extends string = never> = (T extends Rpc.EntrypointBranded ? Rpc.Provider<T, Reserved | "fetch" | "connect"> : unknown) & {
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
    connect(address: SocketAddress | string, options?: SocketOptions): Socket;
};
interface KVNamespaceListKey<Metadata, Key extends string = string> {
    name: Key;
    expiration?: number;
    metadata?: Metadata;
}
type KVNamespaceListResult<Metadata, Key extends string = string> = {
    list_complete: false;
    keys: KVNamespaceListKey<Metadata, Key>[];
    cursor: string;
    cacheStatus: string | null;
} | {
    list_complete: true;
    keys: KVNamespaceListKey<Metadata, Key>[];
    cacheStatus: string | null;
};
interface KVNamespace<Key extends string = string> {
    get(key: Key, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<string | null>;
    get(key: Key, type: "text"): Promise<string | null>;
    get<ExpectedValue = unknown>(key: Key, type: "json"): Promise<ExpectedValue | null>;
    get(key: Key, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
    get(key: Key, type: "stream"): Promise<ReadableStream | null>;
    get(key: Key, options?: KVNamespaceGetOptions<"text">): Promise<string | null>;
    get<ExpectedValue = unknown>(key: Key, options?: KVNamespaceGetOptions<"json">): Promise<ExpectedValue | null>;
    get(key: Key, options?: KVNamespaceGetOptions<"arrayBuffer">): Promise<ArrayBuffer | null>;
    get(key: Key, options?: KVNamespaceGetOptions<"stream">): Promise<ReadableStream | null>;
    list<Metadata = unknown>(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<Metadata, Key>>;
    put(key: Key, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: KVNamespacePutOptions): Promise<void>;
    getWithMetadata<Metadata = unknown>(key: Key, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, type: "text"): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
    getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(key: Key, type: "json"): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, type: "arrayBuffer"): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, type: "stream"): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, options: KVNamespaceGetOptions<"text">): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
    getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(key: Key, options: KVNamespaceGetOptions<"json">): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, options: KVNamespaceGetOptions<"arrayBuffer">): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
    getWithMetadata<Metadata = unknown>(key: Key, options: KVNamespaceGetOptions<"stream">): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
    delete(key: Key): Promise<void>;
}
interface KVNamespaceListOptions {
    limit?: number;
    prefix?: (string | null);
    cursor?: (string | null);
}
interface KVNamespaceGetOptions<Type> {
    type: Type;
    cacheTtl?: number;
}
interface KVNamespacePutOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: (any | null);
}
interface KVNamespaceGetWithMetadataResult<Value, Metadata> {
    value: Value | null;
    metadata: Metadata | null;
    cacheStatus: string | null;
}
type QueueContentType = "text" | "bytes" | "json" | "v8";
interface Queue<Body = unknown> {
    send(message: Body, options?: QueueSendOptions): Promise<void>;
    sendBatch(messages: Iterable<MessageSendRequest<Body>>, options?: QueueSendBatchOptions): Promise<void>;
}
interface QueueSendOptions {
    contentType?: QueueContentType;
    delaySeconds?: number;
}
interface QueueSendBatchOptions {
    delaySeconds?: number;
}
interface MessageSendRequest<Body = unknown> {
    body: Body;
    contentType?: QueueContentType;
    delaySeconds?: number;
}
interface QueueRetryOptions {
    delaySeconds?: number;
}
interface Message<Body = unknown> {
    readonly id: string;
    readonly timestamp: Date;
    readonly body: Body;
    readonly attempts: number;
    retry(options?: QueueRetryOptions): void;
    ack(): void;
}
interface QueueEvent<Body = unknown> extends ExtendableEvent {
    readonly messages: readonly Message<Body>[];
    readonly queue: string;
    retryAll(options?: QueueRetryOptions): void;
    ackAll(): void;
}
interface MessageBatch<Body = unknown> {
    readonly messages: readonly Message<Body>[];
    readonly queue: string;
    retryAll(options?: QueueRetryOptions): void;
    ackAll(): void;
}
interface R2Error extends Error {
    readonly name: string;
    readonly code: number;
    readonly message: string;
    readonly action: string;
    readonly stack: any;
}
interface R2ListOptions {
    limit?: number;
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    startAfter?: string;
    include?: ("httpMetadata" | "customMetadata")[];
}
declare abstract class R2Bucket {
    head(key: string): Promise<R2Object | null>;
    get(key: string, options: R2GetOptions & {
        onlyIf: R2Conditional | Headers;
    }): Promise<R2ObjectBody | R2Object | null>;
    get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions & {
        onlyIf: R2Conditional | Headers;
    }): Promise<R2Object | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
    createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>;
    resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload;
    delete(keys: string | string[]): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
}
interface R2MultipartUpload {
    readonly key: string;
    readonly uploadId: string;
    uploadPart(partNumber: number, value: ReadableStream | (ArrayBuffer | ArrayBufferView) | string | Blob): Promise<R2UploadedPart>;
    abort(): Promise<void>;
    complete(uploadedParts: R2UploadedPart[]): Promise<R2Object>;
}
interface R2UploadedPart {
    partNumber: number;
    etag: string;
}
declare abstract class R2Object {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly checksums: R2Checksums;
    readonly uploaded: Date;
    readonly httpMetadata?: R2HTTPMetadata;
    readonly customMetadata?: Record<string, string>;
    readonly range?: R2Range;
    readonly storageClass: string;
    writeHttpMetadata(headers: Headers): void;
}
interface R2ObjectBody extends R2Object {
    get body(): ReadableStream;
    get bodyUsed(): boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T>(): Promise<T>;
    blob(): Promise<Blob>;
}
type R2Range = {
    offset: number;
    length?: number;
} | {
    offset?: number;
    length: number;
} | {
    suffix: number;
};
interface R2Conditional {
    etagMatches?: string;
    etagDoesNotMatch?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
    secondsGranularity?: boolean;
}
interface R2GetOptions {
    onlyIf?: (R2Conditional | Headers);
    range?: (R2Range | Headers);
}
interface R2PutOptions {
    onlyIf?: (R2Conditional | Headers);
    httpMetadata?: (R2HTTPMetadata | Headers);
    customMetadata?: Record<string, string>;
    md5?: (ArrayBuffer | string);
    sha1?: (ArrayBuffer | string);
    sha256?: (ArrayBuffer | string);
    sha384?: (ArrayBuffer | string);
    sha512?: (ArrayBuffer | string);
    storageClass?: string;
}
interface R2MultipartOptions {
    httpMetadata?: (R2HTTPMetadata | Headers);
    customMetadata?: Record<string, string>;
    storageClass?: string;
}
interface R2Checksums {
    readonly md5?: ArrayBuffer;
    readonly sha1?: ArrayBuffer;
    readonly sha256?: ArrayBuffer;
    readonly sha384?: ArrayBuffer;
    readonly sha512?: ArrayBuffer;
    toJSON(): R2StringChecksums;
}
interface R2StringChecksums {
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha384?: string;
    sha512?: string;
}
interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
}
type R2Objects = {
    objects: R2Object[];
    delimitedPrefixes: string[];
} & ({
    truncated: true;
    cursor: string;
} | {
    truncated: false;
});
declare abstract class ScheduledEvent extends ExtendableEvent {
    readonly scheduledTime: number;
    readonly cron: string;
    noRetry(): void;
}
interface ScheduledController {
    readonly scheduledTime: number;
    readonly cron: string;
    noRetry(): void;
}
interface QueuingStrategy<T = any> {
    highWaterMark?: (number | bigint);
    size?: (chunk: T) => number | bigint;
}
interface UnderlyingSink<W = any> {
    type?: string;
    start?: (controller: WritableStreamDefaultController) => void | Promise<void>;
    write?: (chunk: W, controller: WritableStreamDefaultController) => void | Promise<void>;
    abort?: (reason: any) => void | Promise<void>;
    close?: () => void | Promise<void>;
}
interface UnderlyingByteSource {
    type: "bytes";
    autoAllocateChunkSize?: number;
    start?: (controller: ReadableByteStreamController) => void | Promise<void>;
    pull?: (controller: ReadableByteStreamController) => void | Promise<void>;
    cancel?: (reason: any) => void | Promise<void>;
}
interface UnderlyingSource<R = any> {
    type?: "" | undefined;
    start?: (controller: ReadableStreamDefaultController<R>) => void | Promise<void>;
    pull?: (controller: ReadableStreamDefaultController<R>) => void | Promise<void>;
    cancel?: (reason: any) => void | Promise<void>;
    expectedLength?: (number | bigint);
}
interface Transformer<I = any, O = any> {
    readableType?: string;
    writableType?: string;
    start?: (controller: TransformStreamDefaultController<O>) => void | Promise<void>;
    transform?: (chunk: I, controller: TransformStreamDefaultController<O>) => void | Promise<void>;
    flush?: (controller: TransformStreamDefaultController<O>) => void | Promise<void>;
    cancel?: (reason: any) => void | Promise<void>;
    expectedLength?: number;
}
interface StreamPipeOptions {
    /**
     * Pipes this readable stream to a given writable stream destination. The way in which the piping process behaves under various error conditions can be customized with a number of passed options. It returns a promise that fulfills when the piping process completes successfully, or rejects if any errors were encountered.
     *
     * Piping a stream will lock it for the duration of the pipe, preventing any other consumer from acquiring a reader.
     *
     * Errors and closures of the source and destination streams propagate as follows:
     *
     * An error in this source readable stream will abort destination, unless preventAbort is truthy. The returned promise will be rejected with the source's error, or with any error that occurs during aborting the destination.
     *
     * An error in destination will cancel this source readable stream, unless preventCancel is truthy. The returned promise will be rejected with the destination's error, or with any error that occurs during canceling the source.
     *
     * When this source readable stream closes, destination will be closed, unless preventClose is truthy. The returned promise will be fulfilled once this process completes, unless an error is encountered while closing the destination, in which case it will be rejected with that error.
     *
     * If destination starts out closed or closing, this source readable stream will be canceled, unless preventCancel is true. The returned promise will be rejected with an error indicating piping to a closed stream failed, or with any error that occurs during canceling the source.
     *
     * The signal option can be set to an AbortSignal to allow aborting an ongoing pipe operation via the corresponding AbortController. In this case, this source readable stream will be canceled, and destination aborted, unless the respective options preventCancel or preventAbort are set.
     */
    preventClose?: boolean;
    preventAbort?: boolean;
    preventCancel?: boolean;
    signal?: AbortSignal;
}
type ReadableStreamReadResult<R = any> = {
    done: false;
    value: R;
} | {
    done: true;
    value?: undefined;
};
/**
 * This Streams API interface represents a readable stream of byte data. The Fetch API offers a concrete instance of a ReadableStream through the body property of a Response object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream)
 */
interface ReadableStream<R = any> {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/locked) */
    get locked(): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/cancel) */
    cancel(reason?: any): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/getReader) */
    getReader(): ReadableStreamDefaultReader<R>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/getReader) */
    getReader(options: ReadableStreamGetReaderOptions): ReadableStreamBYOBReader;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/pipeThrough) */
    pipeThrough<T>(transform: ReadableWritablePair<T, R>, options?: StreamPipeOptions): ReadableStream<T>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/pipeTo) */
    pipeTo(destination: WritableStream<R>, options?: StreamPipeOptions): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/tee) */
    tee(): [
        ReadableStream<R>,
        ReadableStream<R>
    ];
    values(options?: ReadableStreamValuesOptions): AsyncIterableIterator<R>;
    [Symbol.asyncIterator](options?: ReadableStreamValuesOptions): AsyncIterableIterator<R>;
}
/**
 * This Streams API interface represents a readable stream of byte data. The Fetch API offers a concrete instance of a ReadableStream through the body property of a Response object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream)
 */
declare const ReadableStream: {
    prototype: ReadableStream;
    new (underlyingSource: UnderlyingByteSource, strategy?: QueuingStrategy<Uint8Array>): ReadableStream<Uint8Array>;
    new <R = any>(underlyingSource?: UnderlyingSource<R>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
};
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader) */
declare class ReadableStreamDefaultReader<R = any> {
    constructor(stream: ReadableStream);
    get closed(): Promise<void>;
    cancel(reason?: any): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader/read) */
    read(): Promise<ReadableStreamReadResult<R>>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader/releaseLock) */
    releaseLock(): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader) */
declare class ReadableStreamBYOBReader {
    constructor(stream: ReadableStream);
    get closed(): Promise<void>;
    cancel(reason?: any): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/read) */
    read<T extends ArrayBufferView>(view: T): Promise<ReadableStreamReadResult<T>>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/releaseLock) */
    releaseLock(): void;
    readAtLeast<T extends ArrayBufferView>(minElements: number, view: T): Promise<ReadableStreamReadResult<T>>;
}
interface ReadableStreamBYOBReaderReadableStreamBYOBReaderReadOptions {
    min?: number;
}
interface ReadableStreamGetReaderOptions {
    /**
     * Creates a ReadableStreamBYOBReader and locks the stream to the new reader.
     *
     * This call behaves the same way as the no-argument variant, except that it only works on readable byte streams, i.e. streams which were constructed specifically with the ability to handle "bring your own buffer" reading. The returned BYOB reader provides the ability to directly read individual chunks from the stream via its read() method, into developer-supplied buffers, allowing more precise control over allocation.
     */
    mode: "byob";
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest) */
declare abstract class ReadableStreamBYOBRequest {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/view) */
    get view(): Uint8Array | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/respond) */
    respond(bytesWritten: number): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/respondWithNewView) */
    respondWithNewView(view: ArrayBuffer | ArrayBufferView): void;
    get atLeast(): number | null;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController) */
declare abstract class ReadableStreamDefaultController<R = any> {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/desiredSize) */
    get desiredSize(): number | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/close) */
    close(): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/enqueue) */
    enqueue(chunk?: R): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/error) */
    error(reason: any): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController) */
declare abstract class ReadableByteStreamController {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/byobRequest) */
    get byobRequest(): ReadableStreamBYOBRequest | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/desiredSize) */
    get desiredSize(): number | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/close) */
    close(): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/enqueue) */
    enqueue(chunk: ArrayBuffer | ArrayBufferView): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/error) */
    error(reason: any): void;
}
/**
 * This Streams API interface represents a controller allowing control of a WritableStream's state. When constructing a WritableStream, the underlying sink is given a corresponding WritableStreamDefaultController instance to manipulate.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController)
 */
declare abstract class WritableStreamDefaultController {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController/signal) */
    get signal(): AbortSignal;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController/error) */
    error(reason?: any): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController) */
declare abstract class TransformStreamDefaultController<O = any> {
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/desiredSize) */
    get desiredSize(): number | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/enqueue) */
    enqueue(chunk?: O): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/error) */
    error(reason: any): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/terminate) */
    terminate(): void;
}
interface ReadableWritablePair<R = any, W = any> {
    /**
     * Provides a convenient, chainable way of piping this readable stream through a transform stream (or any other { writable, readable } pair). It simply pipes the stream into the writable side of the supplied pair, and returns the readable side for further use.
     *
     * Piping a stream will lock it for the duration of the pipe, preventing any other consumer from acquiring a reader.
     */
    writable: WritableStream<W>;
    readable: ReadableStream<R>;
}
/**
 * This Streams API interface provides a standard abstraction for writing streaming data to a destination, known as a sink. This object comes with built-in backpressure and queuing.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream)
 */
declare class WritableStream<W = any> {
    constructor(underlyingSink?: UnderlyingSink, queuingStrategy?: QueuingStrategy);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/locked) */
    get locked(): boolean;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/abort) */
    abort(reason?: any): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/close) */
    close(): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/getWriter) */
    getWriter(): WritableStreamDefaultWriter<W>;
}
/**
 * This Streams API interface is the object returned by WritableStream.getWriter() and once created locks the < writer to the WritableStream ensuring that no other streams can write to the underlying sink.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter)
 */
declare class WritableStreamDefaultWriter<W = any> {
    constructor(stream: WritableStream);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/closed) */
    get closed(): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/ready) */
    get ready(): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/desiredSize) */
    get desiredSize(): number | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/abort) */
    abort(reason?: any): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/close) */
    close(): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/write) */
    write(chunk?: W): Promise<void>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/releaseLock) */
    releaseLock(): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream) */
declare class TransformStream<I = any, O = any> {
    constructor(transformer?: Transformer<I, O>, writableStrategy?: QueuingStrategy<I>, readableStrategy?: QueuingStrategy<O>);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream/readable) */
    get readable(): ReadableStream<O>;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream/writable) */
    get writable(): WritableStream<I>;
}
declare class FixedLengthStream extends IdentityTransformStream {
    constructor(expectedLength: number | bigint, queuingStrategy?: IdentityTransformStreamQueuingStrategy);
}
declare class IdentityTransformStream extends TransformStream<ArrayBuffer | ArrayBufferView, Uint8Array> {
    constructor(queuingStrategy?: IdentityTransformStreamQueuingStrategy);
}
interface IdentityTransformStreamQueuingStrategy {
    highWaterMark?: (number | bigint);
}
interface ReadableStreamValuesOptions {
    preventCancel?: boolean;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CompressionStream) */
declare class CompressionStream extends TransformStream<ArrayBuffer | ArrayBufferView, Uint8Array> {
    constructor(format: "gzip" | "deflate" | "deflate-raw");
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/DecompressionStream) */
declare class DecompressionStream extends TransformStream<ArrayBuffer | ArrayBufferView, Uint8Array> {
    constructor(format: "gzip" | "deflate" | "deflate-raw");
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoderStream) */
declare class TextEncoderStream extends TransformStream<string, Uint8Array> {
    constructor();
    get encoding(): string;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoderStream) */
declare class TextDecoderStream extends TransformStream<ArrayBuffer | ArrayBufferView, string> {
    constructor(label?: string, options?: TextDecoderStreamTextDecoderStreamInit);
    get encoding(): string;
    get fatal(): boolean;
    get ignoreBOM(): boolean;
}
interface TextDecoderStreamTextDecoderStreamInit {
    fatal?: boolean;
    ignoreBOM?: boolean;
}
/**
 * This Streams API interface provides a built-in byte length queuing strategy that can be used when constructing streams.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy)
 */
declare class ByteLengthQueuingStrategy implements QueuingStrategy<ArrayBufferView> {
    constructor(init: QueuingStrategyInit);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy/highWaterMark) */
    get highWaterMark(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy/size) */
    get size(): (chunk?: any) => number;
}
/**
 * This Streams API interface provides a built-in byte length queuing strategy that can be used when constructing streams.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy)
 */
declare class CountQueuingStrategy implements QueuingStrategy {
    constructor(init: QueuingStrategyInit);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy/highWaterMark) */
    get highWaterMark(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy/size) */
    get size(): (chunk?: any) => number;
}
interface QueuingStrategyInit {
    /**
     * Creates a new ByteLengthQueuingStrategy with the provided high water mark.
     *
     * Note that the provided high water mark will not be validated ahead of time. Instead, if it is negative, NaN, or not a number, the resulting ByteLengthQueuingStrategy will cause the corresponding stream constructor to throw.
     */
    highWaterMark: number;
}
interface ScriptVersion {
    id?: string;
    tag?: string;
    message?: string;
}
declare abstract class TailEvent extends ExtendableEvent {
    readonly events: TraceItem[];
    readonly traces: TraceItem[];
}
interface TraceItem {
    readonly event: (TraceItemFetchEventInfo | TraceItemJsRpcEventInfo | TraceItemScheduledEventInfo | TraceItemAlarmEventInfo | TraceItemQueueEventInfo | TraceItemEmailEventInfo | TraceItemTailEventInfo | TraceItemCustomEventInfo | TraceItemHibernatableWebSocketEventInfo) | null;
    readonly eventTimestamp: number | null;
    readonly logs: TraceLog[];
    readonly exceptions: TraceException[];
    readonly diagnosticsChannelEvents: TraceDiagnosticChannelEvent[];
    readonly scriptName: string | null;
    readonly entrypoint?: string;
    readonly scriptVersion?: ScriptVersion;
    readonly dispatchNamespace?: string;
    readonly scriptTags?: string[];
    readonly outcome: string;
    readonly executionModel: string;
    readonly truncated: boolean;
}
interface TraceItemAlarmEventInfo {
    readonly scheduledTime: Date;
}
interface TraceItemCustomEventInfo {
}
interface TraceItemScheduledEventInfo {
    readonly scheduledTime: number;
    readonly cron: string;
}
interface TraceItemQueueEventInfo {
    readonly queue: string;
    readonly batchSize: number;
}
interface TraceItemEmailEventInfo {
    readonly mailFrom: string;
    readonly rcptTo: string;
    readonly rawSize: number;
}
interface TraceItemTailEventInfo {
    readonly consumedEvents: TraceItemTailEventInfoTailItem[];
}
interface TraceItemTailEventInfoTailItem {
    readonly scriptName: string | null;
}
interface TraceItemFetchEventInfo {
    readonly response?: TraceItemFetchEventInfoResponse;
    readonly request: TraceItemFetchEventInfoRequest;
}
interface TraceItemFetchEventInfoRequest {
    readonly cf?: any;
    readonly headers: Record<string, string>;
    readonly method: string;
    readonly url: string;
    getUnredacted(): TraceItemFetchEventInfoRequest;
}
interface TraceItemFetchEventInfoResponse {
    readonly status: number;
}
interface TraceItemJsRpcEventInfo {
    readonly rpcMethod: string;
}
interface TraceItemHibernatableWebSocketEventInfo {
    readonly getWebSocketEvent: TraceItemHibernatableWebSocketEventInfoMessage | TraceItemHibernatableWebSocketEventInfoClose | TraceItemHibernatableWebSocketEventInfoError;
}
interface TraceItemHibernatableWebSocketEventInfoMessage {
    readonly webSocketEventType: string;
}
interface TraceItemHibernatableWebSocketEventInfoClose {
    readonly webSocketEventType: string;
    readonly code: number;
    readonly wasClean: boolean;
}
interface TraceItemHibernatableWebSocketEventInfoError {
    readonly webSocketEventType: string;
}
interface TraceLog {
    readonly timestamp: number;
    readonly level: string;
    readonly message: any;
}
interface TraceException {
    readonly timestamp: number;
    readonly message: string;
    readonly name: string;
    readonly stack?: string;
}
interface TraceDiagnosticChannelEvent {
    readonly timestamp: number;
    readonly channel: string;
    readonly message: any;
}
interface TraceMetrics {
    readonly cpuTime: number;
    readonly wallTime: number;
}
interface UnsafeTraceMetrics {
    fromTrace(item: TraceItem): TraceMetrics;
}
/**
 * The URL interface represents an object providing static methods used for creating object URLs.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL)
 */
declare class URL {
    constructor(url: string | URL, base?: string | URL);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/origin) */
    get origin(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/href) */
    get href(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/href) */
    set href(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/protocol) */
    get protocol(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/protocol) */
    set protocol(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/username) */
    get username(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/username) */
    set username(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/password) */
    get password(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/password) */
    set password(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/host) */
    get host(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/host) */
    set host(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hostname) */
    get hostname(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hostname) */
    set hostname(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/port) */
    get port(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/port) */
    set port(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/pathname) */
    get pathname(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/pathname) */
    set pathname(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/search) */
    get search(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/search) */
    set search(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hash) */
    get hash(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hash) */
    set hash(value: string);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/searchParams) */
    get searchParams(): URLSearchParams;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/toJSON) */
    toJSON(): string;
    /*function toString() { [native code] }*/
    toString(): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/canParse_static) */
    static canParse(url: string, base?: string): boolean;
    static parse(url: string, base?: string): URL | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/createObjectURL_static) */
    static createObjectURL(object: File | Blob): string;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/revokeObjectURL_static) */
    static revokeObjectURL(object_url: string): void;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams) */
declare class URLSearchParams {
    constructor(init?: (Iterable<Iterable<string>> | Record<string, string> | string));
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/size) */
    get size(): number;
    /**
     * Appends a specified key/value pair as a new search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/append)
     */
    append(name: string, value: string): void;
    /**
     * Deletes the given search parameter, and its associated value, from the list of all search parameters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/delete)
     */
    delete(name: string, value?: string): void;
    /**
     * Returns the first value associated to the given search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/get)
     */
    get(name: string): string | null;
    /**
     * Returns all the values association with a given search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/getAll)
     */
    getAll(name: string): string[];
    /**
     * Returns a Boolean indicating if such a search parameter exists.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/has)
     */
    has(name: string, value?: string): boolean;
    /**
     * Sets the value associated to a given search parameter to the given value. If there were several values, delete the others.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/set)
     */
    set(name: string, value: string): void;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/sort) */
    sort(): void;
    /* Returns an array of key, value pairs for every entry in the search params. */
    entries(): IterableIterator<[
        key: string,
        value: string
    ]>;
    /* Returns a list of keys in the search params. */
    keys(): IterableIterator<string>;
    /* Returns a list of values in the search params. */
    values(): IterableIterator<string>;
    forEach<This = unknown>(callback: (this: This, value: string, key: string, parent: URLSearchParams) => void, thisArg?: This): void;
    /*function toString() { [native code] } Returns a string containing a query string suitable for use in a URL. Does not include the question mark. */
    toString(): string;
    [Symbol.iterator](): IterableIterator<[
        key: string,
        value: string
    ]>;
}
declare class URLPattern {
    constructor(input?: (string | URLPatternURLPatternInit), baseURL?: string, patternOptions?: URLPatternURLPatternOptions);
    get protocol(): string;
    get username(): string;
    get password(): string;
    get hostname(): string;
    get port(): string;
    get pathname(): string;
    get search(): string;
    get hash(): string;
    test(input?: (string | URLPatternURLPatternInit), baseURL?: string): boolean;
    exec(input?: (string | URLPatternURLPatternInit), baseURL?: string): URLPatternURLPatternResult | null;
}
interface URLPatternURLPatternInit {
    protocol?: string;
    username?: string;
    password?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
    baseURL?: string;
}
interface URLPatternURLPatternComponentResult {
    input: string;
    groups: Record<string, string>;
}
interface URLPatternURLPatternResult {
    inputs: (string | URLPatternURLPatternInit)[];
    protocol: URLPatternURLPatternComponentResult;
    username: URLPatternURLPatternComponentResult;
    password: URLPatternURLPatternComponentResult;
    hostname: URLPatternURLPatternComponentResult;
    port: URLPatternURLPatternComponentResult;
    pathname: URLPatternURLPatternComponentResult;
    search: URLPatternURLPatternComponentResult;
    hash: URLPatternURLPatternComponentResult;
}
interface URLPatternURLPatternOptions {
    ignoreCase?: boolean;
}
/**
 * A CloseEvent is sent to clients using WebSockets when the connection is closed. This is delivered to the listener indicated by the WebSocket object's onclose attribute.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent)
 */
declare class CloseEvent extends Event {
    constructor(type: string, initializer?: CloseEventInit);
    /**
     * Returns the WebSocket connection close code provided by the server.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/code)
     */
    readonly code: number;
    /**
     * Returns the WebSocket connection close reason provided by the server.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/reason)
     */
    readonly reason: string;
    /**
     * Returns true if the connection closed cleanly; false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/wasClean)
     */
    readonly wasClean: boolean;
}
interface CloseEventInit {
    code?: number;
    reason?: string;
    wasClean?: boolean;
}
/**
 * A message received by a target object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent)
 */
declare class MessageEvent extends Event {
    constructor(type: string, initializer: MessageEventInit);
    /**
     * Returns the data of the message.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/data)
     */
    readonly data: ArrayBuffer | string;
}
interface MessageEventInit {
    data: ArrayBuffer | string;
}
type WebSocketEventMap = {
    close: CloseEvent;
    message: MessageEvent;
    open: Event;
    error: ErrorEvent;
};
/**
 * Provides the API for creating and managing a WebSocket connection to a server, as well as for sending and receiving data on the connection.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket)
 */
declare var WebSocket: {
    prototype: WebSocket;
    new (url: string, protocols?: (string[] | string)): WebSocket;
    readonly READY_STATE_CONNECTING: number;
    readonly CONNECTING: number;
    readonly READY_STATE_OPEN: number;
    readonly OPEN: number;
    readonly READY_STATE_CLOSING: number;
    readonly CLOSING: number;
    readonly READY_STATE_CLOSED: number;
    readonly CLOSED: number;
};
/**
 * Provides the API for creating and managing a WebSocket connection to a server, as well as for sending and receiving data on the connection.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket)
 */
interface WebSocket extends EventTarget<WebSocketEventMap> {
    accept(): void;
    /**
     * Transmits data using the WebSocket connection. data can be a string, a Blob, an ArrayBuffer, or an ArrayBufferView.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/send)
     */
    send(message: (ArrayBuffer | ArrayBufferView) | string): void;
    /**
     * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/close)
     */
    close(code?: number, reason?: string): void;
    serializeAttachment(attachment: any): void;
    deserializeAttachment(): any | null;
    /**
     * Returns the state of the WebSocket object's connection. It can have the values described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/readyState)
     */
    readyState: number;
    /**
     * Returns the URL that was used to establish the WebSocket connection.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/url)
     */
    url: string | null;
    /**
     * Returns the subprotocol selected by the server, if any. It can be used in conjunction with the array form of the constructor's second argument to perform subprotocol negotiation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/protocol)
     */
    protocol: string | null;
    /**
     * Returns the extensions selected by the server, if any.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/extensions)
     */
    extensions: string | null;
}
declare const WebSocketPair: {
    new (): {
        0: WebSocket;
        1: WebSocket;
    };
};
interface SqlStorage {
    exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: any[]): SqlStorageCursor<T>;
    get databaseSize(): number;
    Cursor: typeof SqlStorageCursor;
    Statement: typeof SqlStorageStatement;
}
declare abstract class SqlStorageStatement {
}
type SqlStorageValue = ArrayBuffer | string | number | null;
declare abstract class SqlStorageCursor<T extends Record<string, SqlStorageValue>> {
    next(): {
        done?: false;
        value: T;
    } | {
        done: true;
        value?: never;
    };
    toArray(): T[];
    one(): T;
    raw<U extends SqlStorageValue[]>(): IterableIterator<U>;
    columnNames: string[];
    get rowsRead(): number;
    get rowsWritten(): number;
    [Symbol.iterator](): IterableIterator<T>;
}
interface Socket {
    get readable(): ReadableStream;
    get writable(): WritableStream;
    get closed(): Promise<void>;
    get opened(): Promise<SocketInfo>;
    close(): Promise<void>;
    startTls(options?: TlsOptions): Socket;
}
interface SocketOptions {
    secureTransport?: string;
    allowHalfOpen: boolean;
    highWaterMark?: (number | bigint);
}
interface SocketAddress {
    hostname: string;
    port: number;
}
interface TlsOptions {
    expectedServerHostname?: string;
}
interface SocketInfo {
    remoteAddress?: string;
    localAddress?: string;
}
interface GPU {
    requestAdapter(param1?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}
declare abstract class GPUAdapter {
    requestDevice(param1?: GPUDeviceDescriptor): Promise<GPUDevice>;
    requestAdapterInfo(unmaskHints?: string[]): Promise<GPUAdapterInfo>;
    get features(): GPUSupportedFeatures;
    get limits(): GPUSupportedLimits;
}
interface GPUDevice extends EventTarget {
    createBuffer(param1: GPUBufferDescriptor): GPUBuffer;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createSampler(descriptor: GPUSamplerDescriptor): GPUSampler;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    createTexture(param1: GPUTextureDescriptor): GPUTexture;
    destroy(): void;
    createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet;
    pushErrorScope(filter: string): void;
    popErrorScope(): Promise<GPUError | null>;
    get queue(): GPUQueue;
    get lost(): Promise<GPUDeviceLostInfo>;
    get features(): GPUSupportedFeatures;
    get limits(): GPUSupportedLimits;
}
interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: string[];
    requiredLimits?: Record<string, number | bigint>;
    defaultQueue?: GPUQueueDescriptor;
}
interface GPUBufferDescriptor {
    label: string;
    size: number | bigint;
    usage: number;
    mappedAtCreation: boolean;
}
interface GPUQueueDescriptor {
    label?: string;
}
declare abstract class GPUBufferUsage {
    static readonly MAP_READ: number;
    static readonly MAP_WRITE: number;
    static readonly COPY_SRC: number;
    static readonly COPY_DST: number;
    static readonly INDEX: number;
    static readonly VERTEX: number;
    static readonly UNIFORM: number;
    static readonly STORAGE: number;
    static readonly INDIRECT: number;
    static readonly QUERY_RESOLVE: number;
}
interface GPUBuffer {
    getMappedRange(size?: (number | bigint), param2?: (number | bigint)): ArrayBuffer;
    unmap(): void;
    destroy(): void;
    mapAsync(offset: number, size?: (number | bigint), param3?: (number | bigint)): Promise<void>;
    get size(): number | bigint;
    get usage(): number;
    get mapState(): string;
}
declare abstract class GPUShaderStage {
    static readonly VERTEX: number;
    static readonly FRAGMENT: number;
    static readonly COMPUTE: number;
}
interface GPUBindGroupLayoutDescriptor {
    label?: string;
    entries: GPUBindGroupLayoutEntry[];
}
interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: number;
    buffer?: GPUBufferBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    texture?: GPUTextureBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
}
interface GPUStorageTextureBindingLayout {
    access?: string;
    format: string;
    viewDimension?: string;
}
interface GPUTextureBindingLayout {
    sampleType?: string;
    viewDimension?: string;
    multisampled?: boolean;
}
interface GPUSamplerBindingLayout {
    type?: string;
}
interface GPUBufferBindingLayout {
    type?: string;
    hasDynamicOffset?: boolean;
    minBindingSize?: (number | bigint);
}
interface GPUBindGroupLayout {
}
interface GPUBindGroup {
}
interface GPUBindGroupDescriptor {
    label?: string;
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
}
interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBufferBinding | GPUSampler;
}
interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: (number | bigint);
    size?: (number | bigint);
}
interface GPUSampler {
}
interface GPUSamplerDescriptor {
    label?: string;
    addressModeU?: string;
    addressModeV?: string;
    addressModeW?: string;
    magFilter?: string;
    minFilter?: string;
    mipmapFilter?: string;
    lodMinClamp?: number;
    lodMaxClamp?: number;
    compare: string;
    maxAnisotropy?: number;
}
interface GPUShaderModule {
    getCompilationInfo(): Promise<GPUCompilationInfo>;
}
interface GPUShaderModuleDescriptor {
    label?: string;
    code: string;
}
interface GPUPipelineLayout {
}
interface GPUPipelineLayoutDescriptor {
    label?: string;
    bindGroupLayouts: GPUBindGroupLayout[];
}
interface GPUComputePipeline {
    getBindGroupLayout(index: number): GPUBindGroupLayout;
}
interface GPUComputePipelineDescriptor {
    label?: string;
    compute: GPUProgrammableStage;
    layout: string | GPUPipelineLayout;
}
interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
}
interface GPUCommandEncoder {
    get label(): string;
    beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
    beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number | bigint, destination: GPUBuffer, destinationOffset: number | bigint, size: number | bigint): void;
    finish(param0?: GPUCommandBufferDescriptor): GPUCommandBuffer;
    copyTextureToBuffer(source: GPUImageCopyTexture, destination: GPUImageCopyBuffer, copySize: Iterable<number> | GPUExtent3DDict): void;
    copyBufferToTexture(source: GPUImageCopyBuffer, destination: GPUImageCopyTexture, copySize: Iterable<number> | GPUExtent3DDict): void;
    copyTextureToTexture(source: GPUImageCopyTexture, destination: GPUImageCopyTexture, copySize: Iterable<number> | GPUExtent3DDict): void;
    clearBuffer(buffer: GPUBuffer, offset?: (number | bigint), size?: (number | bigint)): void;
}
interface GPUCommandEncoderDescriptor {
    label?: string;
}
interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup | null, dynamicOffsets?: Iterable<number>): void;
    dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
    end(): void;
}
interface GPUComputePassDescriptor {
    label?: string;
    timestampWrites?: GPUComputePassTimestampWrites;
}
interface GPUQuerySet {
}
interface GPUQuerySetDescriptor {
    label?: string;
}
interface GPUComputePassTimestampWrites {
    querySet: GPUQuerySet;
    beginningOfPassWriteIndex?: number;
    endOfPassWriteIndex?: number;
}
interface GPUCommandBufferDescriptor {
    label?: string;
}
interface GPUCommandBuffer {
}
interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
    writeBuffer(buffer: GPUBuffer, bufferOffset: number | bigint, data: ArrayBuffer | ArrayBufferView, dataOffset?: (number | bigint), size?: (number | bigint)): void;
}
declare abstract class GPUMapMode {
    static readonly READ: number;
    static readonly WRITE: number;
}
interface GPURequestAdapterOptions {
    powerPreference: string;
    forceFallbackAdapter?: boolean;
}
interface GPUAdapterInfo {
    get vendor(): string;
    get architecture(): string;
    get device(): string;
    get description(): string;
}
interface GPUSupportedFeatures {
    has(name: string): boolean;
    keys(): string[];
}
interface GPUSupportedLimits {
    get maxTextureDimension1D(): number;
    get maxTextureDimension2D(): number;
    get maxTextureDimension3D(): number;
    get maxTextureArrayLayers(): number;
    get maxBindGroups(): number;
    get maxBindingsPerBindGroup(): number;
    get maxDynamicUniformBuffersPerPipelineLayout(): number;
    get maxDynamicStorageBuffersPerPipelineLayout(): number;
    get maxSampledTexturesPerShaderStage(): number;
    get maxSamplersPerShaderStage(): number;
    get maxStorageBuffersPerShaderStage(): number;
    get maxStorageTexturesPerShaderStage(): number;
    get maxUniformBuffersPerShaderStage(): number;
    get maxUniformBufferBindingSize(): number | bigint;
    get maxStorageBufferBindingSize(): number | bigint;
    get minUniformBufferOffsetAlignment(): number;
    get minStorageBufferOffsetAlignment(): number;
    get maxVertexBuffers(): number;
    get maxBufferSize(): number | bigint;
    get maxVertexAttributes(): number;
    get maxVertexBufferArrayStride(): number;
    get maxInterStageShaderComponents(): number;
    get maxInterStageShaderVariables(): number;
    get maxColorAttachments(): number;
    get maxColorAttachmentBytesPerSample(): number;
    get maxComputeWorkgroupStorageSize(): number;
    get maxComputeInvocationsPerWorkgroup(): number;
    get maxComputeWorkgroupSizeX(): number;
    get maxComputeWorkgroupSizeY(): number;
    get maxComputeWorkgroupSizeZ(): number;
    get maxComputeWorkgroupsPerDimension(): number;
}
declare abstract class GPUError {
    get message(): string;
}
declare abstract class GPUOutOfMemoryError extends GPUError {
}
declare abstract class GPUInternalError extends GPUError {
}
declare abstract class GPUValidationError extends GPUError {
}
declare abstract class GPUDeviceLostInfo {
    get message(): string;
    get reason(): string;
}
interface GPUCompilationMessage {
    get message(): string;
    get type(): string;
    get lineNum(): number;
    get linePos(): number;
    get offset(): number;
    get length(): number;
}
interface GPUCompilationInfo {
    get messages(): GPUCompilationMessage[];
}
declare abstract class GPUTextureUsage {
    static readonly COPY_SRC: number;
    static readonly COPY_DST: number;
    static readonly TEXTURE_BINDING: number;
    static readonly STORAGE_BINDING: number;
    static readonly RENDER_ATTACHMENT: number;
}
interface GPUTextureDescriptor {
    label: string;
    size: number[] | GPUExtent3DDict;
    mipLevelCount?: number;
    sampleCount?: number;
    dimension?: string;
    format: string;
    usage: number;
    viewFormats?: string[];
}
interface GPUExtent3DDict {
    width: number;
    height?: number;
    depthOrArrayLayers?: number;
}
interface GPUTexture {
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    destroy(): void;
    get width(): number;
    get height(): number;
    get depthOrArrayLayers(): number;
    get mipLevelCount(): number;
    get dimension(): string;
    get format(): string;
    get usage(): number;
}
interface GPUTextureView {
}
interface GPUTextureViewDescriptor {
    label: string;
    format: string;
    dimension: string;
    aspect?: string;
    baseMipLevel?: number;
    mipLevelCount: number;
    baseArrayLayer?: number;
    arrayLayerCount: number;
}
declare abstract class GPUColorWrite {
    static readonly RED: number;
    static readonly GREEN: number;
    static readonly BLUE: number;
    static readonly ALPHA: number;
    static readonly ALL: number;
}
interface GPURenderPipeline {
}
interface GPURenderPipelineDescriptor {
    label?: string;
    layout: string | GPUPipelineLayout;
    vertex: GPUVertexState;
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    fragment?: GPUFragmentState;
}
interface GPUVertexState {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
    buffers?: GPUVertexBufferLayout[];
}
interface GPUVertexBufferLayout {
    arrayStride: number | bigint;
    stepMode?: string;
    attributes: GPUVertexAttribute[];
}
interface GPUVertexAttribute {
    format: string;
    offset: number | bigint;
    shaderLocation: number;
}
interface GPUPrimitiveState {
    topology?: string;
    stripIndexFormat?: string;
    frontFace?: string;
    cullMode?: string;
    unclippedDepth?: boolean;
}
interface GPUStencilFaceState {
    compare?: string;
    failOp?: string;
    depthFailOp?: string;
    passOp?: string;
}
interface GPUDepthStencilState {
    format: string;
    depthWriteEnabled: boolean;
    depthCompare: string;
    stencilFront?: GPUStencilFaceState;
    stencilBack?: GPUStencilFaceState;
    stencilReadMask?: number;
    stencilWriteMask?: number;
    depthBias?: number;
    depthBiasSlopeScale?: number;
    depthBiasClamp?: number;
}
interface GPUMultisampleState {
    count?: number;
    mask?: number;
    alphaToCoverageEnabled?: boolean;
}
interface GPUFragmentState {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
    targets: GPUColorTargetState[];
}
interface GPUColorTargetState {
    format: string;
    blend: GPUBlendState;
    writeMask?: number;
}
interface GPUBlendState {
    color: GPUBlendComponent;
    alpha: GPUBlendComponent;
}
interface GPUBlendComponent {
    operation?: string;
    srcFactor?: string;
    dstFactor?: string;
}
interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
    end(): void;
}
interface GPURenderPassDescriptor {
    label?: string;
    colorAttachments: GPURenderPassColorAttachment[];
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
    occlusionQuerySet?: GPUQuerySet;
    timestampWrites?: GPURenderPassTimestampWrites;
    maxDrawCount?: (number | bigint);
}
interface GPURenderPassColorAttachment {
    view: GPUTextureView;
    depthSlice?: number;
    resolveTarget?: GPUTextureView;
    clearValue?: (number[] | GPUColorDict);
    loadOp: string;
    storeOp: string;
}
interface GPUColorDict {
    r: number;
    g: number;
    b: number;
    a: number;
}
interface GPURenderPassDepthStencilAttachment {
    view: GPUTextureView;
    depthClearValue?: number;
    depthLoadOp?: string;
    depthStoreOp?: string;
    depthReadOnly?: boolean;
    stencilClearValue?: number;
    stencilLoadOp?: string;
    stencilStoreOp?: string;
    stencilReadOnly?: boolean;
}
interface GPURenderPassTimestampWrites {
    querySet: GPUQuerySet;
    beginningOfPassWriteIndex?: number;
    endOfPassWriteIndex?: number;
}
interface GPUImageCopyTexture {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: (number[] | GPUOrigin3DDict);
    aspect?: string;
}
interface GPUImageCopyBuffer {
    buffer: GPUBuffer;
    offset?: (number | bigint);
    bytesPerRow?: number;
    rowsPerImage?: number;
}
interface GPUOrigin3DDict {
    x?: number;
    y?: number;
    z?: number;
}
/* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource) */
declare class EventSource extends EventTarget {
    constructor(url: string, init?: EventSourceEventSourceInit);
    /**
     * Aborts any instances of the fetch algorithm started for this EventSource object, and sets the readyState attribute to CLOSED.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/close)
     */
    close(): void;
    /**
     * Returns the URL providing the event stream.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/url)
     */
    get url(): string;
    /**
     * Returns true if the credentials mode for connection requests to the URL providing the event stream is set to "include", and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/withCredentials)
     */
    get withCredentials(): boolean;
    /**
     * Returns the state of this EventSource object's connection. It can have the values described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/readyState)
     */
    get readyState(): number;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/open_event) */
    get onopen(): any | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/open_event) */
    set onopen(value: any | null);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/message_event) */
    get onmessage(): any | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/message_event) */
    set onmessage(value: any | null);
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/error_event) */
    get onerror(): any | null;
    /* [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/error_event) */
    set onerror(value: any | null);
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
    static from(stream: ReadableStream): EventSource;
}
interface EventSourceEventSourceInit {
    withCredentials?: boolean;
    fetcher?: Fetcher;
}
type AiImageClassificationInput = {
    image: number[];
};
type AiImageClassificationOutput = {
    score?: number;
    label?: string;
}[];
declare abstract class BaseAiImageClassification {
    inputs: AiImageClassificationInput;
    postProcessedOutputs: AiImageClassificationOutput;
}
type AiImageToTextInput = {
    image: number[];
    prompt?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    seed?: number;
    repetition_penalty?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    raw?: boolean;
    messages?: RoleScopedChatInput[];
};
type AiImageToTextOutput = {
    description: string;
};
declare abstract class BaseAiImageToText {
    inputs: AiImageToTextInput;
    postProcessedOutputs: AiImageToTextOutput;
}
type AiObjectDetectionInput = {
    image: number[];
};
type AiObjectDetectionOutput = {
    score?: number;
    label?: string;
}[];
declare abstract class BaseAiObjectDetection {
    inputs: AiObjectDetectionInput;
    postProcessedOutputs: AiObjectDetectionOutput;
}
type AiSentenceSimilarityInput = {
    source: string;
    sentences: string[];
};
type AiSentenceSimilarityOutput = number[];
declare abstract class BaseAiSentenceSimilarity {
    inputs: AiSentenceSimilarityInput;
    postProcessedOutputs: AiSentenceSimilarityOutput;
}
type AiSpeechRecognitionInput = {
    audio: number[];
};
type AiSpeechRecognitionOutput = {
    text?: string;
    words?: {
        word: string;
        start: number;
        end: number;
    }[];
    vtt?: string;
};
declare abstract class BaseAiSpeechRecognition {
    inputs: AiSpeechRecognitionInput;
    postProcessedOutputs: AiSpeechRecognitionOutput;
}
type AiSummarizationInput = {
    input_text: string;
    max_length?: number;
};
type AiSummarizationOutput = {
    summary: string;
};
declare abstract class BaseAiSummarization {
    inputs: AiSummarizationInput;
    postProcessedOutputs: AiSummarizationOutput;
}
type AiTextClassificationInput = {
    text: string;
};
type AiTextClassificationOutput = {
    score?: number;
    label?: string;
}[];
declare abstract class BaseAiTextClassification {
    inputs: AiTextClassificationInput;
    postProcessedOutputs: AiTextClassificationOutput;
}
type AiTextEmbeddingsInput = {
    text: string | string[];
};
type AiTextEmbeddingsOutput = {
    shape: number[];
    data: number[][];
};
declare abstract class BaseAiTextEmbeddings {
    inputs: AiTextEmbeddingsInput;
    postProcessedOutputs: AiTextEmbeddingsOutput;
}
type RoleScopedChatInput = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
};
type AiTextGenerationToolInput = {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters?: {
            type: "object";
            properties: {
                [key: string]: {
                    type: string;
                    description?: string;
                };
            };
            required: string[];
        };
    };
};
type AiTextGenerationInput = {
    prompt?: string;
    raw?: boolean;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    seed?: number;
    repetition_penalty?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    messages?: RoleScopedChatInput[];
    tools?: AiTextGenerationToolInput[];
};
type AiTextGenerationOutput = {
    response?: string;
    tool_calls?: {
        name: string;
        arguments: unknown;
    }[];
} | ReadableStream;
declare abstract class BaseAiTextGeneration {
    inputs: AiTextGenerationInput;
    postProcessedOutputs: AiTextGenerationOutput;
}
type AiTextToImageInput = {
    prompt: string;
    image?: number[];
    mask?: number[];
    num_steps?: number;
    strength?: number;
    guidance?: number;
};
type AiTextToImageOutput = ReadableStream<Uint8Array>;
declare abstract class BaseAiTextToImage {
    inputs: AiTextToImageInput;
    postProcessedOutputs: AiTextToImageOutput;
}
type AiTranslationInput = {
    text: string;
    target_lang: string;
    source_lang?: string;
};
type AiTranslationOutput = {
    translated_text?: string;
};
declare abstract class BaseAiTranslation {
    inputs: AiTranslationInput;
    postProcessedOutputs: AiTranslationOutput;
}
type GatewayOptions = {
    id: string;
    cacheKey?: string;
    cacheTtl?: number;
    skipCache?: boolean;
    metadata?: Record<string, number | string | boolean | null | bigint>;
    collectLog?: boolean;
};
type AiOptions = {
    gateway?: GatewayOptions;
    prefix?: string;
    extraHeaders?: object;
};
type BaseAiTextClassificationModels = "@cf/huggingface/distilbert-sst-2-int8";
type BaseAiTextToImageModels = "@cf/stabilityai/stable-diffusion-xl-base-1.0" | "@cf/runwayml/stable-diffusion-v1-5-inpainting" | "@cf/runwayml/stable-diffusion-v1-5-img2img" | "@cf/lykon/dreamshaper-8-lcm" | "@cf/bytedance/stable-diffusion-xl-lightning";
type BaseAiTextEmbeddingsModels = "@cf/baai/bge-small-en-v1.5" | "@cf/baai/bge-base-en-v1.5" | "@cf/baai/bge-large-en-v1.5";
type BaseAiSpeechRecognitionModels = "@cf/openai/whisper" | "@cf/openai/whisper-tiny-en" | "@cf/openai/whisper-sherpa";
type BaseAiImageClassificationModels = "@cf/microsoft/resnet-50";
type BaseAiObjectDetectionModels = "@cf/facebook/detr-resnet-50";
type BaseAiTextGenerationModels = "@cf/meta/llama-3.1-8b-instruct" | "@cf/meta/llama-3-8b-instruct" | "@cf/meta/llama-3-8b-instruct-awq" | "@cf/meta/llama-2-7b-chat-int8" | "@cf/mistral/mistral-7b-instruct-v0.1" | "@cf/mistral/mistral-7b-instruct-v0.2-lora" | "@cf/meta/llama-2-7b-chat-fp16" | "@hf/thebloke/llama-2-13b-chat-awq" | "@hf/thebloke/zephyr-7b-beta-awq" | "@hf/thebloke/mistral-7b-instruct-v0.1-awq" | "@hf/thebloke/codellama-7b-instruct-awq" | "@hf/thebloke/openhermes-2.5-mistral-7b-awq" | "@hf/thebloke/neural-chat-7b-v3-1-awq" | "@hf/thebloke/llamaguard-7b-awq" | "@hf/thebloke/deepseek-coder-6.7b-base-awq" | "@hf/thebloke/deepseek-coder-6.7b-instruct-awq" | "@hf/nousresearch/hermes-2-pro-mistral-7b" | "@hf/mistral/mistral-7b-instruct-v0.2" | "@hf/google/gemma-7b-it" | "@hf/nexusflow/starling-lm-7b-beta" | "@cf/deepseek-ai/deepseek-math-7b-instruct" | "@cf/defog/sqlcoder-7b-2" | "@cf/openchat/openchat-3.5-0106" | "@cf/tiiuae/falcon-7b-instruct" | "@cf/thebloke/discolm-german-7b-v1-awq" | "@cf/qwen/qwen1.5-0.5b-chat" | "@cf/qwen/qwen1.5-1.8b-chat" | "@cf/qwen/qwen1.5-7b-chat-awq" | "@cf/qwen/qwen1.5-14b-chat-awq" | "@cf/tinyllama/tinyllama-1.1b-chat-v1.0" | "@cf/microsoft/phi-2" | "@cf/google/gemma-2b-it-lora" | "@cf/google/gemma-7b-it-lora" | "@cf/meta-llama/llama-2-7b-chat-hf-lora" | "@cf/fblgit/una-cybertron-7b-v2-bf16" | "@cf/fblgit/una-cybertron-7b-v2-awq";
type BaseAiTranslationModels = "@cf/meta/m2m100-1.2b";
type BaseAiSummarizationModels = "@cf/facebook/bart-large-cnn";
type BaseAiImageToTextModels = "@cf/unum/uform-gen2-qwen-500m" | "@cf/llava-hf/llava-1.5-7b-hf";
declare abstract class Ai {
    run(model: BaseAiTextClassificationModels, inputs: BaseAiTextClassification["inputs"], options?: AiOptions): Promise<BaseAiTextClassification["postProcessedOutputs"]>;
    run(model: BaseAiTextToImageModels, inputs: BaseAiTextToImage["inputs"], options?: AiOptions): Promise<BaseAiTextToImage["postProcessedOutputs"]>;
    run(model: BaseAiTextEmbeddingsModels, inputs: BaseAiTextEmbeddings["inputs"], options?: AiOptions): Promise<BaseAiTextEmbeddings["postProcessedOutputs"]>;
    run(model: BaseAiSpeechRecognitionModels, inputs: BaseAiSpeechRecognition["inputs"], options?: AiOptions): Promise<BaseAiSpeechRecognition["postProcessedOutputs"]>;
    run(model: BaseAiImageClassificationModels, inputs: BaseAiImageClassification["inputs"], options?: AiOptions): Promise<BaseAiImageClassification["postProcessedOutputs"]>;
    run(model: BaseAiObjectDetectionModels, inputs: BaseAiObjectDetection["inputs"], options?: AiOptions): Promise<BaseAiObjectDetection["postProcessedOutputs"]>;
    run(model: BaseAiTextGenerationModels, inputs: BaseAiTextGeneration["inputs"], options?: AiOptions): Promise<BaseAiTextGeneration["postProcessedOutputs"]>;
    run(model: BaseAiTranslationModels, inputs: BaseAiTranslation["inputs"], options?: AiOptions): Promise<BaseAiTranslation["postProcessedOutputs"]>;
    run(model: BaseAiSummarizationModels, inputs: BaseAiSummarization["inputs"], options?: AiOptions): Promise<BaseAiSummarization["postProcessedOutputs"]>;
    run(model: BaseAiImageToTextModels, inputs: BaseAiImageToText["inputs"], options?: AiOptions): Promise<BaseAiImageToText["postProcessedOutputs"]>;
}
interface BasicImageTransformations {
    /**
     * Maximum width in image pixels. The value must be an integer.
     */
    width?: number;
    /**
     * Maximum height in image pixels. The value must be an integer.
     */
    height?: number;
    /**
     * Resizing mode as a string. It affects interpretation of width and height
     * options:
     *  - scale-down: Similar to contain, but the image is never enlarged. If
     *    the image is larger than given width or height, it will be resized.
     *    Otherwise its original size will be kept.
     *  - contain: Resizes to maximum size that fits within the given width and
     *    height. If only a single dimension is given (e.g. only width), the
     *    image will be shrunk or enlarged to exactly match that dimension.
     *    Aspect ratio is always preserved.
     *  - cover: Resizes (shrinks or enlarges) to fill the entire area of width
     *    and height. If the image has an aspect ratio different from the ratio
     *    of width and height, it will be cropped to fit.
     *  - crop: The image will be shrunk and cropped to fit within the area
     *    specified by width and height. The image will not be enlarged. For images
     *    smaller than the given dimensions it's the same as scale-down. For
     *    images larger than the given dimensions, it's the same as cover.
     *    See also trim.
     *  - pad: Resizes to the maximum size that fits within the given width and
     *    height, and then fills the remaining area with a background color
     *    (white by default). Use of this mode is not recommended, as the same
     *    effect can be more efficiently achieved with the contain mode and the
     *    CSS object-fit: contain property.
     */
    fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
    /**
     * When cropping with fit: "cover", this defines the side or point that should
     * be left uncropped. The value is either a string
     * "left", "right", "top", "bottom", "auto", or "center" (the default),
     * or an object {x, y} containing focal point coordinates in the original
     * image expressed as fractions ranging from 0.0 (top or left) to 1.0
     * (bottom or right), 0.5 being the center. {fit: "cover", gravity: "top"} will
     * crop bottom or left and right sides as necessary, but won’t crop anything
     * from the top. {fit: "cover", gravity: {x:0.5, y:0.2}} will crop each side to
     * preserve as much as possible around a point at 20% of the height of the
     * source image.
     */
    gravity?: "left" | "right" | "top" | "bottom" | "center" | "auto" | BasicImageTransformationsGravityCoordinates;
    /**
     * Background color to add underneath the image. Applies only to images with
     * transparency (such as PNG). Accepts any CSS color (#RRGGBB, rgba(…),
     * hsl(…), etc.)
     */
    background?: string;
    /**
     * Number of degrees (90, 180, 270) to rotate the image by. width and height
     * options refer to axes after rotation.
     */
    rotate?: 0 | 90 | 180 | 270 | 360;
}
interface BasicImageTransformationsGravityCoordinates {
    x: number;
    y: number;
}
/**
 * In addition to the properties you can set in the RequestInit dict
 * that you pass as an argument to the Request constructor, you can
 * set certain properties of a `cf` object to control how Cloudflare
 * features are applied to that new Request.
 *
 * Note: Currently, these properties cannot be tested in the
 * playground.
 */
interface RequestInitCfProperties extends Record<string, unknown> {
    cacheEverything?: boolean;
    /**
     * A request's cache key is what determines if two requests are
     * "the same" for caching purposes. If a request has the same cache key
     * as some previous request, then we can serve the same cached response for
     * both. (e.g. 'some-key')
     *
     * Only available for Enterprise customers.
     */
    cacheKey?: string;
    /**
     * This allows you to append additional Cache-Tag response headers
     * to the origin response without modifications to the origin server.
     * This will allow for greater control over the Purge by Cache Tag feature
     * utilizing changes only in the Workers process.
     *
     * Only available for Enterprise customers.
     */
    cacheTags?: string[];
    /**
     * Force response to be cached for a given number of seconds. (e.g. 300)
     */
    cacheTtl?: number;
    /**
     * Force response to be cached for a given number of seconds based on the Origin status code.
     * (e.g. { '200-299': 86400, '404': 1, '500-599': 0 })
     */
    cacheTtlByStatus?: Record<string, number>;
    scrapeShield?: boolean;
    apps?: boolean;
    image?: RequestInitCfPropertiesImage;
    minify?: RequestInitCfPropertiesImageMinify;
    mirage?: boolean;
    polish?: "lossy" | "lossless" | "off";
    r2?: RequestInitCfPropertiesR2;
    /**
     * Redirects the request to an alternate origin server. You can use this,
     * for example, to implement load balancing across several origins.
     * (e.g.us-east.example.com)
     *
     * Note - For security reasons, the hostname set in resolveOverride must
     * be proxied on the same Cloudflare zone of the incoming request.
     * Otherwise, the setting is ignored. CNAME hosts are allowed, so to
     * resolve to a host under a different domain or a DNS only domain first
     * declare a CNAME record within your own zone’s DNS mapping to the
     * external hostname, set proxy on Cloudflare, then set resolveOverride
     * to point to that CNAME record.
     */
    resolveOverride?: string;
}
interface RequestInitCfPropertiesImageDraw extends BasicImageTransformations {
    /**
     * Absolute URL of the image file to use for the drawing. It can be any of
     * the supported file formats. For drawing of watermarks or non-rectangular
     * overlays we recommend using PNG or WebP images.
     */
    url: string;
    /**
     * Floating-point number between 0 (transparent) and 1 (opaque).
     * For example, opacity: 0.5 makes overlay semitransparent.
     */
    opacity?: number;
    /**
     * - If set to true, the overlay image will be tiled to cover the entire
     *   area. This is useful for stock-photo-like watermarks.
     * - If set to "x", the overlay image will be tiled horizontally only
     *   (form a line).
     * - If set to "y", the overlay image will be tiled vertically only
     *   (form a line).
     */
    repeat?: true | "x" | "y";
    /**
     * Position of the overlay image relative to a given edge. Each property is
     * an offset in pixels. 0 aligns exactly to the edge. For example, left: 10
     * positions left side of the overlay 10 pixels from the left edge of the
     * image it's drawn over. bottom: 0 aligns bottom of the overlay with bottom
     * of the background image.
     *
     * Setting both left & right, or both top & bottom is an error.
     *
     * If no position is specified, the image will be centered.
     */
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
}
interface RequestInitCfPropertiesImage extends BasicImageTransformations {
    /**
     * Device Pixel Ratio. Default 1. Multiplier for width/height that makes it
     * easier to specify higher-DPI sizes in <img srcset>.
     */
    dpr?: number;
    /**
     * An object with four properties {left, top, right, bottom} that specify
     * a number of pixels to cut off on each side. Allows removal of borders
     * or cutting out a specific fragment of an image. Trimming is performed
     * before resizing or rotation. Takes dpr into account.
     */
    trim?: {
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
    };
    /**
     * Quality setting from 1-100 (useful values are in 60-90 range). Lower values
     * make images look worse, but load faster. The default is 85. It applies only
     * to JPEG and WebP images. It doesn’t have any effect on PNG.
     */
    quality?: number;
    /**
     * Output format to generate. It can be:
     *  - avif: generate images in AVIF format.
     *  - webp: generate images in Google WebP format. Set quality to 100 to get
     *    the WebP-lossless format.
     *  - json: instead of generating an image, outputs information about the
     *    image, in JSON format. The JSON object will contain image size
     *    (before and after resizing), source image’s MIME type, file size, etc.
     * - jpeg: generate images in JPEG format.
     * - png: generate images in PNG format.
     */
    format?: "avif" | "webp" | "json" | "jpeg" | "png";
    /**
     * Whether to preserve animation frames from input files. Default is true.
     * Setting it to false reduces animations to still images. This setting is
     * recommended when enlarging images or processing arbitrary user content,
     * because large GIF animations can weigh tens or even hundreds of megabytes.
     * It is also useful to set anim:false when using format:"json" to get the
     * response quicker without the number of frames.
     */
    anim?: boolean;
    /**
     * What EXIF data should be preserved in the output image. Note that EXIF
     * rotation and embedded color profiles are always applied ("baked in" into
     * the image), and aren't affected by this option. Note that if the Polish
     * feature is enabled, all metadata may have been removed already and this
     * option may have no effect.
     *  - keep: Preserve most of EXIF metadata, including GPS location if there's
     *    any.
     *  - copyright: Only keep the copyright tag, and discard everything else.
     *    This is the default behavior for JPEG files.
     *  - none: Discard all invisible EXIF metadata. Currently WebP and PNG
     *    output formats always discard metadata.
     */
    metadata?: "keep" | "copyright" | "none";
    /**
     * Strength of sharpening filter to apply to the image. Floating-point
     * number between 0 (no sharpening, default) and 10 (maximum). 1.0 is a
     * recommended value for downscaled images.
     */
    sharpen?: number;
    /**
     * Radius of a blur filter (approximate gaussian). Maximum supported radius
     * is 250.
     */
    blur?: number;
    /**
     * Overlays are drawn in the order they appear in the array (last array
     * entry is the topmost layer).
     */
    draw?: RequestInitCfPropertiesImageDraw[];
    /**
     * Fetching image from authenticated origin. Setting this property will
     * pass authentication headers (Authorization, Cookie, etc.) through to
     * the origin.
     */
    "origin-auth"?: "share-publicly";
    /**
     * Adds a border around the image. The border is added after resizing. Border
     * width takes dpr into account, and can be specified either using a single
     * width property, or individually for each side.
     */
    border?: {
        color: string;
        width: number;
    } | {
        color: string;
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    /**
     * Increase brightness by a factor. A value of 1.0 equals no change, a value
     * of 0.5 equals half brightness, and a value of 2.0 equals twice as bright.
     * 0 is ignored.
     */
    brightness?: number;
    /**
     * Increase contrast by a factor. A value of 1.0 equals no change, a value of
     * 0.5 equals low contrast, and a value of 2.0 equals high contrast. 0 is
     * ignored.
     */
    contrast?: number;
    /**
     * Increase exposure by a factor. A value of 1.0 equals no change, a value of
     * 0.5 darkens the image, and a value of 2.0 lightens the image. 0 is ignored.
     */
    gamma?: number;
    /**
     * Slightly reduces latency on a cache miss by selecting a
     * quickest-to-compress file format, at a cost of increased file size and
     * lower image quality. It will usually override the format option and choose
     * JPEG over WebP or AVIF. We do not recommend using this option, except in
     * unusual circumstances like resizing uncacheable dynamically-generated
     * images.
     */
    compression?: "fast";
}
interface RequestInitCfPropertiesImageMinify {
    javascript?: boolean;
    css?: boolean;
    html?: boolean;
}
interface RequestInitCfPropertiesR2 {
    /**
     * Colo id of bucket that an object is stored in
     */
    bucketColoId?: number;
}
/**
 * Request metadata provided by Cloudflare's edge.
 */
type IncomingRequestCfProperties<HostMetadata = unknown> = IncomingRequestCfPropertiesBase & IncomingRequestCfPropertiesBotManagementEnterprise & IncomingRequestCfPropertiesCloudflareForSaaSEnterprise<HostMetadata> & IncomingRequestCfPropertiesGeographicInformation & IncomingRequestCfPropertiesCloudflareAccessOrApiShield;
interface IncomingRequestCfPropertiesBase extends Record<string, unknown> {
    /**
     * [ASN](https://www.iana.org/assignments/as-numbers/as-numbers.xhtml) of the incoming request.
     *
     * @example 395747
     */
    asn: number;
    /**
     * The organization which owns the ASN of the incoming request.
     *
     * @example "Google Cloud"
     */
    asOrganization: string;
    /**
     * The original value of the `Accept-Encoding` header if Cloudflare modified it.
     *
     * @example "gzip, deflate, br"
     */
    clientAcceptEncoding?: string;
    /**
     * The number of milliseconds it took for the request to reach your worker.
     *
     * @example 22
     */
    clientTcpRtt?: number;
    /**
     * The three-letter [IATA](https://en.wikipedia.org/wiki/IATA_airport_code)
     * airport code of the data center that the request hit.
     *
     * @example "DFW"
     */
    colo: string;
    /**
     * Represents the upstream's response to a
     * [TCP `keepalive` message](https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/overview.html)
     * from cloudflare.
     *
     * For workers with no upstream, this will always be `1`.
     *
     * @example 3
     */
    edgeRequestKeepAliveStatus: IncomingRequestCfPropertiesEdgeRequestKeepAliveStatus;
    /**
     * The HTTP Protocol the request used.
     *
     * @example "HTTP/2"
     */
    httpProtocol: string;
    /**
     * The browser-requested prioritization information in the request object.
     *
     * If no information was set, defaults to the empty string `""`
     *
     * @example "weight=192;exclusive=0;group=3;group-weight=127"
     * @default ""
     */
    requestPriority: string;
    /**
     * The TLS version of the connection to Cloudflare.
     * In requests served over plaintext (without TLS), this property is the empty string `""`.
     *
     * @example "TLSv1.3"
     */
    tlsVersion: string;
    /**
     * The cipher for the connection to Cloudflare.
     * In requests served over plaintext (without TLS), this property is the empty string `""`.
     *
     * @example "AEAD-AES128-GCM-SHA256"
     */
    tlsCipher: string;
    /**
     * Metadata containing the [`HELLO`](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2) and [`FINISHED`](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9) messages from this request's TLS handshake.
     *
     * If the incoming request was served over plaintext (without TLS) this field is undefined.
     */
    tlsExportedAuthenticator?: IncomingRequestCfPropertiesExportedAuthenticatorMetadata;
}
interface IncomingRequestCfPropertiesBotManagementBase {
    /**
     * Cloudflare’s [level of certainty](https://developers.cloudflare.com/bots/concepts/bot-score/) that a request comes from a bot,
     * represented as an integer percentage between `1` (almost certainly a bot) and `99` (almost certainly human).
     *
     * @example 54
     */
    score: number;
    /**
     * A boolean value that is true if the request comes from a good bot, like Google or Bing.
     * Most customers choose to allow this traffic. For more details, see [Traffic from known bots](https://developers.cloudflare.com/firewall/known-issues-and-faq/#how-does-firewall-rules-handle-traffic-from-known-bots).
     */
    verifiedBot: boolean;
    /**
     * A boolean value that is true if the request originates from a
     * Cloudflare-verified proxy service.
     */
    corporateProxy: boolean;
    /**
     * A boolean value that's true if the request matches [file extensions](https://developers.cloudflare.com/bots/reference/static-resources/) for many types of static resources.
     */
    staticResource: boolean;
    /**
     * List of IDs that correlate to the Bot Management heuristic detections made on a request (you can have multiple heuristic detections on the same request).
     */
    detectionIds: number[];
}
interface IncomingRequestCfPropertiesBotManagement {
    /**
     * Results of Cloudflare's Bot Management analysis
     */
    botManagement: IncomingRequestCfPropertiesBotManagementBase;
    /**
     * Duplicate of `botManagement.score`.
     *
     * @deprecated
     */
    clientTrustScore: number;
}
interface IncomingRequestCfPropertiesBotManagementEnterprise extends IncomingRequestCfPropertiesBotManagement {
    /**
     * Results of Cloudflare's Bot Management analysis
     */
    botManagement: IncomingRequestCfPropertiesBotManagementBase & {
        /**
         * A [JA3 Fingerprint](https://developers.cloudflare.com/bots/concepts/ja3-fingerprint/) to help profile specific SSL/TLS clients
         * across different destination IPs, Ports, and X509 certificates.
         */
        ja3Hash: string;
    };
}
interface IncomingRequestCfPropertiesCloudflareForSaaSEnterprise<HostMetadata> {
    /**
     * Custom metadata set per-host in [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/).
     *
     * This field is only present if you have Cloudflare for SaaS enabled on your account
     * and you have followed the [required steps to enable it]((https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/custom-metadata/)).
     */
    hostMetadata: HostMetadata;
}
interface IncomingRequestCfPropertiesCloudflareAccessOrApiShield {
    /**
     * Information about the client certificate presented to Cloudflare.
     *
     * This is populated when the incoming request is served over TLS using
     * either Cloudflare Access or API Shield (mTLS)
     * and the presented SSL certificate has a valid
     * [Certificate Serial Number](https://ldapwiki.com/wiki/Certificate%20Serial%20Number)
     * (i.e., not `null` or `""`).
     *
     * Otherwise, a set of placeholder values are used.
     *
     * The property `certPresented` will be set to `"1"` when
     * the object is populated (i.e. the above conditions were met).
     */
    tlsClientAuth: IncomingRequestCfPropertiesTLSClientAuth | IncomingRequestCfPropertiesTLSClientAuthPlaceholder;
}
/**
 * Metadata about the request's TLS handshake
 */
interface IncomingRequestCfPropertiesExportedAuthenticatorMetadata {
    /**
     * The client's [`HELLO` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2), encoded in hexadecimal
     *
     * @example "44372ba35fa1270921d318f34c12f155dc87b682cf36a790cfaa3ba8737a1b5d"
     */
    clientHandshake: string;
    /**
     * The server's [`HELLO` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2), encoded in hexadecimal
     *
     * @example "44372ba35fa1270921d318f34c12f155dc87b682cf36a790cfaa3ba8737a1b5d"
     */
    serverHandshake: string;
    /**
     * The client's [`FINISHED` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9), encoded in hexadecimal
     *
     * @example "084ee802fe1348f688220e2a6040a05b2199a761f33cf753abb1b006792d3f8b"
     */
    clientFinished: string;
    /**
     * The server's [`FINISHED` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9), encoded in hexadecimal
     *
     * @example "084ee802fe1348f688220e2a6040a05b2199a761f33cf753abb1b006792d3f8b"
     */
    serverFinished: string;
}
/**
 * Geographic data about the request's origin.
 */
interface IncomingRequestCfPropertiesGeographicInformation {
    /**
     * The [ISO 3166-1 Alpha 2](https://www.iso.org/iso-3166-country-codes.html) country code the request originated from.
     *
     * If your worker is [configured to accept TOR connections](https://support.cloudflare.com/hc/en-us/articles/203306930-Understanding-Cloudflare-Tor-support-and-Onion-Routing), this may also be `"T1"`, indicating a request that originated over TOR.
     *
     * If Cloudflare is unable to determine where the request originated this property is omitted.
     *
     * The country code `"T1"` is used for requests originating on TOR.
     *
     * @example "GB"
     */
    country?: Iso3166Alpha2Code | "T1";
    /**
     * If present, this property indicates that the request originated in the EU
     *
     * @example "1"
     */
    isEUCountry?: "1";
    /**
     * A two-letter code indicating the continent the request originated from.
     *
     * @example "AN"
     */
    continent?: ContinentCode;
    /**
     * The city the request originated from
     *
     * @example "Austin"
     */
    city?: string;
    /**
     * Postal code of the incoming request
     *
     * @example "78701"
     */
    postalCode?: string;
    /**
     * Latitude of the incoming request
     *
     * @example "30.27130"
     */
    latitude?: string;
    /**
     * Longitude of the incoming request
     *
     * @example "-97.74260"
     */
    longitude?: string;
    /**
     * Timezone of the incoming request
     *
     * @example "America/Chicago"
     */
    timezone?: string;
    /**
     * If known, the ISO 3166-2 name for the first level region associated with
     * the IP address of the incoming request
     *
     * @example "Texas"
     */
    region?: string;
    /**
     * If known, the ISO 3166-2 code for the first-level region associated with
     * the IP address of the incoming request
     *
     * @example "TX"
     */
    regionCode?: string;
    /**
     * Metro code (DMA) of the incoming request
     *
     * @example "635"
     */
    metroCode?: string;
}
/** Data about the incoming request's TLS certificate */
interface IncomingRequestCfPropertiesTLSClientAuth {
    /** Always `"1"`, indicating that the certificate was presented */
    certPresented: "1";
    /**
     * Result of certificate verification.
     *
     * @example "FAILED:self signed certificate"
     */
    certVerified: Exclude<CertVerificationStatus, "NONE">;
    /** The presented certificate's revokation status.
     *
     * - A value of `"1"` indicates the certificate has been revoked
     * - A value of `"0"` indicates the certificate has not been revoked
     */
    certRevoked: "1" | "0";
    /**
     * The certificate issuer's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html)
     *
     * @example "CN=cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    certIssuerDN: string;
    /**
     * The certificate subject's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html)
     *
     * @example "CN=*.cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    certSubjectDN: string;
    /**
     * The certificate issuer's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html) ([RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html) formatted)
     *
     * @example "CN=cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    certIssuerDNRFC2253: string;
    /**
     * The certificate subject's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html) ([RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html) formatted)
     *
     * @example "CN=*.cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    certSubjectDNRFC2253: string;
    /** The certificate issuer's distinguished name (legacy policies) */
    certIssuerDNLegacy: string;
    /** The certificate subject's distinguished name (legacy policies) */
    certSubjectDNLegacy: string;
    /**
     * The certificate's serial number
     *
     * @example "00936EACBE07F201DF"
     */
    certSerial: string;
    /**
     * The certificate issuer's serial number
     *
     * @example "2489002934BDFEA34"
     */
    certIssuerSerial: string;
    /**
     * The certificate's Subject Key Identifier
     *
     * @example "BB:AF:7E:02:3D:FA:A6:F1:3C:84:8E:AD:EE:38:98:EC:D9:32:32:D4"
     */
    certSKI: string;
    /**
     * The certificate issuer's Subject Key Identifier
     *
     * @example "BB:AF:7E:02:3D:FA:A6:F1:3C:84:8E:AD:EE:38:98:EC:D9:32:32:D4"
     */
    certIssuerSKI: string;
    /**
     * The certificate's SHA-1 fingerprint
     *
     * @example "6b9109f323999e52259cda7373ff0b4d26bd232e"
     */
    certFingerprintSHA1: string;
    /**
     * The certificate's SHA-256 fingerprint
     *
     * @example "acf77cf37b4156a2708e34c4eb755f9b5dbbe5ebb55adfec8f11493438d19e6ad3f157f81fa3b98278453d5652b0c1fd1d71e5695ae4d709803a4d3f39de9dea"
     */
    certFingerprintSHA256: string;
    /**
     * The effective starting date of the certificate
     *
     * @example "Dec 22 19:39:00 2018 GMT"
     */
    certNotBefore: string;
    /**
     * The effective expiration date of the certificate
     *
     * @example "Dec 22 19:39:00 2018 GMT"
     */
    certNotAfter: string;
}
/** Placeholder values for TLS Client Authorization */
interface IncomingRequestCfPropertiesTLSClientAuthPlaceholder {
    certPresented: "0";
    certVerified: "NONE";
    certRevoked: "0";
    certIssuerDN: "";
    certSubjectDN: "";
    certIssuerDNRFC2253: "";
    certSubjectDNRFC2253: "";
    certIssuerDNLegacy: "";
    certSubjectDNLegacy: "";
    certSerial: "";
    certIssuerSerial: "";
    certSKI: "";
    certIssuerSKI: "";
    certFingerprintSHA1: "";
    certFingerprintSHA256: "";
    certNotBefore: "";
    certNotAfter: "";
}
/** Possible outcomes of TLS verification */
declare type CertVerificationStatus = 
/** Authentication succeeded */
"SUCCESS"
/** No certificate was presented */
 | "NONE"
/** Failed because the certificate was self-signed */
 | "FAILED:self signed certificate"
/** Failed because the certificate failed a trust chain check */
 | "FAILED:unable to verify the first certificate"
/** Failed because the certificate not yet valid */
 | "FAILED:certificate is not yet valid"
/** Failed because the certificate is expired */
 | "FAILED:certificate has expired"
/** Failed for another unspecified reason */
 | "FAILED";
/**
 * An upstream endpoint's response to a TCP `keepalive` message from Cloudflare.
 */
declare type IncomingRequestCfPropertiesEdgeRequestKeepAliveStatus = 0 /** Unknown */ | 1 /** no keepalives (not found) */ | 2 /** no connection re-use, opening keepalive connection failed */ | 3 /** no connection re-use, keepalive accepted and saved */ | 4 /** connection re-use, refused by the origin server (`TCP FIN`) */ | 5; /** connection re-use, accepted by the origin server */
/** ISO 3166-1 Alpha-2 codes */
declare type Iso3166Alpha2Code = "AD" | "AE" | "AF" | "AG" | "AI" | "AL" | "AM" | "AO" | "AQ" | "AR" | "AS" | "AT" | "AU" | "AW" | "AX" | "AZ" | "BA" | "BB" | "BD" | "BE" | "BF" | "BG" | "BH" | "BI" | "BJ" | "BL" | "BM" | "BN" | "BO" | "BQ" | "BR" | "BS" | "BT" | "BV" | "BW" | "BY" | "BZ" | "CA" | "CC" | "CD" | "CF" | "CG" | "CH" | "CI" | "CK" | "CL" | "CM" | "CN" | "CO" | "CR" | "CU" | "CV" | "CW" | "CX" | "CY" | "CZ" | "DE" | "DJ" | "DK" | "DM" | "DO" | "DZ" | "EC" | "EE" | "EG" | "EH" | "ER" | "ES" | "ET" | "FI" | "FJ" | "FK" | "FM" | "FO" | "FR" | "GA" | "GB" | "GD" | "GE" | "GF" | "GG" | "GH" | "GI" | "GL" | "GM" | "GN" | "GP" | "GQ" | "GR" | "GS" | "GT" | "GU" | "GW" | "GY" | "HK" | "HM" | "HN" | "HR" | "HT" | "HU" | "ID" | "IE" | "IL" | "IM" | "IN" | "IO" | "IQ" | "IR" | "IS" | "IT" | "JE" | "JM" | "JO" | "JP" | "KE" | "KG" | "KH" | "KI" | "KM" | "KN" | "KP" | "KR" | "KW" | "KY" | "KZ" | "LA" | "LB" | "LC" | "LI" | "LK" | "LR" | "LS" | "LT" | "LU" | "LV" | "LY" | "MA" | "MC" | "MD" | "ME" | "MF" | "MG" | "MH" | "MK" | "ML" | "MM" | "MN" | "MO" | "MP" | "MQ" | "MR" | "MS" | "MT" | "MU" | "MV" | "MW" | "MX" | "MY" | "MZ" | "NA" | "NC" | "NE" | "NF" | "NG" | "NI" | "NL" | "NO" | "NP" | "NR" | "NU" | "NZ" | "OM" | "PA" | "PE" | "PF" | "PG" | "PH" | "PK" | "PL" | "PM" | "PN" | "PR" | "PS" | "PT" | "PW" | "PY" | "QA" | "RE" | "RO" | "RS" | "RU" | "RW" | "SA" | "SB" | "SC" | "SD" | "SE" | "SG" | "SH" | "SI" | "SJ" | "SK" | "SL" | "SM" | "SN" | "SO" | "SR" | "SS" | "ST" | "SV" | "SX" | "SY" | "SZ" | "TC" | "TD" | "TF" | "TG" | "TH" | "TJ" | "TK" | "TL" | "TM" | "TN" | "TO" | "TR" | "TT" | "TV" | "TW" | "TZ" | "UA" | "UG" | "UM" | "US" | "UY" | "UZ" | "VA" | "VC" | "VE" | "VG" | "VI" | "VN" | "VU" | "WF" | "WS" | "YE" | "YT" | "ZA" | "ZM" | "ZW";
/** The 2-letter continent codes Cloudflare uses */
declare type ContinentCode = "AF" | "AN" | "AS" | "EU" | "NA" | "OC" | "SA";
type CfProperties<HostMetadata = unknown> = IncomingRequestCfProperties<HostMetadata> | RequestInitCfProperties;
interface D1Meta {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
}
interface D1Response {
    success: true;
    meta: D1Meta & Record<string, unknown>;
    error?: never;
}
type D1Result<T = unknown> = D1Response & {
    results: T[];
};
interface D1ExecResult {
    count: number;
    duration: number;
}
declare abstract class D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
}
declare abstract class D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    raw<T = unknown[]>(options: {
        columnNames: true;
    }): Promise<[
        string[],
        ...T[]
    ]>;
    raw<T = unknown[]>(options?: {
        columnNames?: false;
    }): Promise<T[]>;
}
// `Disposable` was added to TypeScript's standard lib types in version 5.2.
// To support older TypeScript versions, define an empty `Disposable` interface.
// Users won't be able to use `using`/`Symbol.dispose` without upgrading to 5.2,
// but this will ensure type checking on older versions still passes.
// TypeScript's interface merging will ensure our empty interface is effectively
// ignored when `Disposable` is included in the standard lib.
interface Disposable {
}
/**
 * An email message that can be sent from a Worker.
 */
interface EmailMessage {
    /**
     * Envelope From attribute of the email message.
     */
    readonly from: string;
    /**
     * Envelope To attribute of the email message.
     */
    readonly to: string;
}
/**
 * An email message that is sent to a consumer Worker and can be rejected/forwarded.
 */
interface ForwardableEmailMessage extends EmailMessage {
    /**
     * Stream of the email message content.
     */
    readonly raw: ReadableStream<Uint8Array>;
    /**
     * An [Headers object](https://developer.mozilla.org/en-US/docs/Web/API/Headers).
     */
    readonly headers: Headers;
    /**
     * Size of the email message content.
     */
    readonly rawSize: number;
    /**
     * Reject this email message by returning a permanent SMTP error back to the connecting client including the given reason.
     * @param reason The reject reason.
     * @returns void
     */
    setReject(reason: string): void;
    /**
     * Forward this email message to a verified destination address of the account.
     * @param rcptTo Verified destination address.
     * @param headers A [Headers object](https://developer.mozilla.org/en-US/docs/Web/API/Headers).
     * @returns A promise that resolves when the email message is forwarded.
     */
    forward(rcptTo: string, headers?: Headers): Promise<void>;
    /**
     * Reply to the sender of this email message with a new EmailMessage object.
     * @param message The reply message.
     * @returns A promise that resolves when the email message is replied.
     */
    reply(message: EmailMessage): Promise<void>;
}
/**
 * A binding that allows a Worker to send email messages.
 */
interface SendEmail {
    send(message: EmailMessage): Promise<void>;
}
declare abstract class EmailEvent extends ExtendableEvent {
    readonly message: ForwardableEmailMessage;
}
declare type EmailExportedHandler<Env = unknown> = (message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) => void | Promise<void>;
declare module "cloudflare:email" {
    let _EmailMessage: {
        prototype: EmailMessage;
        new (from: string, to: string, raw: ReadableStream | string): EmailMessage;
    };
    export { _EmailMessage as EmailMessage };
}
interface Hyperdrive {
    /**
     * Connect directly to Hyperdrive as if it's your database, returning a TCP socket.
     *
     * Calling this method returns an idential socket to if you call
     * `connect("host:port")` using the `host` and `port` fields from this object.
     * Pick whichever approach works better with your preferred DB client library.
     *
     * Note that this socket is not yet authenticated -- it's expected that your
     * code (or preferably, the client library of your choice) will authenticate
     * using the information in this class's readonly fields.
     */
    connect(): Socket;
    /**
     * A valid DB connection string that can be passed straight into the typical
     * client library/driver/ORM. This will typically be the easiest way to use
     * Hyperdrive.
     */
    readonly connectionString: string;
    /*
     * A randomly generated hostname that is only valid within the context of the
     * currently running Worker which, when passed into `connect()` function from
     * the "cloudflare:sockets" module, will connect to the Hyperdrive instance
     * for your database.
     */
    readonly host: string;
    /*
     * The port that must be paired the the host field when connecting.
     */
    readonly port: number;
    /*
     * The username to use when authenticating to your database via Hyperdrive.
     * Unlike the host and password, this will be the same every time
     */
    readonly user: string;
    /*
     * The randomly generated password to use when authenticating to your
     * database via Hyperdrive. Like the host field, this password is only valid
     * within the context of the currently running Worker instance from which
     * it's read.
     */
    readonly password: string;
    /*
     * The name of the database to connect to.
     */
    readonly database: string;
}
// Copyright (c) 2024 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
type ImageInfoResponse = {
    format: 'image/svg+xml';
} | {
    format: string;
    fileSize: number;
    width: number;
    height: number;
};
type ImageTransform = {
    fit?: 'scale-down' | 'contain' | 'pad' | 'squeeze' | 'cover' | 'crop';
    gravity?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'auto' | 'entropy' | 'face' | {
        x?: number;
        y?: number;
        mode: 'remainder' | 'box-center';
    };
    trim?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        width?: number;
        height?: number;
        border?: boolean | {
            color?: string;
            tolerance?: number;
            keep?: number;
        };
    };
    width?: number;
    height?: number;
    background?: string;
    rotate?: number;
    sharpen?: number;
    blur?: number;
    contrast?: number;
    brightness?: number;
    gamma?: number;
    border?: {
        color?: string;
        width?: number;
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
    zoom?: number;
};
type ImageOutputOptions = {
    format: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/avif' | 'rgb' | 'rgba';
    quality?: number;
    background?: string;
};
interface ImagesBinding {
    /**
     * Get image metadata (type, width and height)
     * @throws {@link ImagesError} with code 9412 if input is not an image
     * @param stream The image bytes
     */
    info(stream: ReadableStream<Uint8Array>): Promise<ImageInfoResponse>;
    /**
     * Begin applying a series of transformations to an image
     * @param stream The image bytes
     * @returns A transform handle
     */
    input(stream: ReadableStream<Uint8Array>): ImageTransformer;
}
interface ImageTransformer {
    /**
     * Apply transform next, returning a transform handle.
     * You can then apply more transformations or retrieve the output.
     * @param transform
     */
    transform(transform: ImageTransform): ImageTransformer;
    /**
     * Retrieve the image that results from applying the transforms to the
     * provided input
     * @param options Options that apply to the output e.g. output format
     */
    output(options: ImageOutputOptions): Promise<ImageTransformationResult>;
}
interface ImageTransformationResult {
    /**
     * The image as a response, ready to store in cache or return to users
     */
    response(): Response;
    /**
     * The content type of the returned image
     */
    contentType(): string;
    /**
     * The bytes of the response
     */
    image(): ReadableStream<Uint8Array>;
}
interface ImagesError extends Error {
    readonly code: number;
    readonly message: string;
    readonly stack?: string;
}
type Params<P extends string = any> = Record<P, string | string[]>;
type EventContext<Env, P extends string, Data> = {
    request: Request<unknown, IncomingRequestCfProperties<unknown>>;
    functionPath: string;
    waitUntil: (promise: Promise<any>) => void;
    passThroughOnException: () => void;
    next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
    env: Env & {
        ASSETS: {
            fetch: typeof fetch;
        };
    };
    params: Params<P>;
    data: Data;
};
type PagesFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;
type EventPluginContext<Env, P extends string, Data, PluginArgs> = {
    request: Request<unknown, IncomingRequestCfProperties<unknown>>;
    functionPath: string;
    waitUntil: (promise: Promise<any>) => void;
    passThroughOnException: () => void;
    next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
    env: Env & {
        ASSETS: {
            fetch: typeof fetch;
        };
    };
    params: Params<P>;
    data: Data;
    pluginArgs: PluginArgs;
};
type PagesPluginFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>, PluginArgs = unknown> = (context: EventPluginContext<Env, Params, Data, PluginArgs>) => Response | Promise<Response>;
declare module "assets:*" {
    export const onRequest: PagesFunction;
}
// Copyright (c) 2022-2023 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
declare abstract class PipelineTransform {
    /**
     * transformJson recieves an array of javascript objects which can be
     * mutated and returned to the pipeline
     * @param data The data to be mutated
     * @returns A promise containing the mutated data
     */
    public transformJson(data: object[]): Promise<object[]>;
}
// Copyright (c) 2022-2023 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
interface Pipeline {
    /**
     * send takes an array of javascript objects which are
     * then received by the pipeline for processing
     *
     * @param data The data to be sent
     */
    send(data: object[]): Promise<void>;
}
// PubSubMessage represents an incoming PubSub message.
// The message includes metadata about the broker, the client, and the payload
// itself.
// https://developers.cloudflare.com/pub-sub/
interface PubSubMessage {
    // Message ID
    readonly mid: number;
    // MQTT broker FQDN in the form mqtts://BROKER.NAMESPACE.cloudflarepubsub.com:PORT
    readonly broker: string;
    // The MQTT topic the message was sent on.
    readonly topic: string;
    // The client ID of the client that published this message.
    readonly clientId: string;
    // The unique identifier (JWT ID) used by the client to authenticate, if token
    // auth was used.
    readonly jti?: string;
    // A Unix timestamp (seconds from Jan 1, 1970), set when the Pub/Sub Broker
    // received the message from the client.
    readonly receivedAt: number;
    // An (optional) string with the MIME type of the payload, if set by the
    // client.
    readonly contentType: string;
    // Set to 1 when the payload is a UTF-8 string
    // https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html#_Toc3901063
    readonly payloadFormatIndicator: number;
    // Pub/Sub (MQTT) payloads can be UTF-8 strings, or byte arrays.
    // You can use payloadFormatIndicator to inspect this before decoding.
    payload: string | Uint8Array;
}
// JsonWebKey extended by kid parameter
interface JsonWebKeyWithKid extends JsonWebKey {
    // Key Identifier of the JWK
    readonly kid: string;
}
interface RateLimitOptions {
    key: string;
}
interface RateLimitOutcome {
    success: boolean;
}
interface RateLimit {
    /**
     * Rate limit a request based on the provided options.
     * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
     * @returns A promise that resolves with the outcome of the rate limit.
     */
    limit(options: RateLimitOptions): Promise<RateLimitOutcome>;
}
// Namespace for RPC utility types. Unfortunately, we can't use a `module` here as these types need
// to referenced by `Fetcher`. This is included in the "importable" version of the types which
// strips all `module` blocks.
declare namespace Rpc {
    // Branded types for identifying `WorkerEntrypoint`/`DurableObject`/`Target`s.
    // TypeScript uses *structural* typing meaning anything with the same shape as type `T` is a `T`.
    // For the classes exported by `cloudflare:workers` we want *nominal* typing (i.e. we only want to
    // accept `WorkerEntrypoint` from `cloudflare:workers`, not any other class with the same shape)
    export const __RPC_STUB_BRAND: "__RPC_STUB_BRAND";
    export const __RPC_TARGET_BRAND: "__RPC_TARGET_BRAND";
    export const __WORKER_ENTRYPOINT_BRAND: "__WORKER_ENTRYPOINT_BRAND";
    export const __DURABLE_OBJECT_BRAND: "__DURABLE_OBJECT_BRAND";
    export const __WORKFLOW_ENTRYPOINT_BRAND: "__WORKFLOW_ENTRYPOINT_BRAND";
    export interface RpcTargetBranded {
        [__RPC_TARGET_BRAND]: never;
    }
    export interface WorkerEntrypointBranded {
        [__WORKER_ENTRYPOINT_BRAND]: never;
    }
    export interface DurableObjectBranded {
        [__DURABLE_OBJECT_BRAND]: never;
    }
    export interface WorkflowEntrypointBranded {
        [__WORKFLOW_ENTRYPOINT_BRAND]: never;
    }
    export type EntrypointBranded = WorkerEntrypointBranded | DurableObjectBranded | WorkflowEntrypointBranded;
    // Types that can be used through `Stub`s
    export type Stubable = RpcTargetBranded | ((...args: any[]) => any);
    // Types that can be passed over RPC
    // The reason for using a generic type here is to build a serializable subset of structured
    //   cloneable composite types. This allows types defined with the "interface" keyword to pass the
    //   serializable check as well. Otherwise, only types defined with the "type" keyword would pass.
    type Serializable<T> = 
    // Structured cloneables
    void | undefined | null | boolean | number | bigint | string | TypedArray | ArrayBuffer | DataView | Date | Error | RegExp
    // Structured cloneable composites
     | Map<T extends Map<infer U, unknown> ? Serializable<U> : never, T extends Map<unknown, infer U> ? Serializable<U> : never> | Set<T extends Set<infer U> ? Serializable<U> : never> | ReadonlyArray<T extends ReadonlyArray<infer U> ? Serializable<U> : never> | {
        [K in keyof T]: K extends number | string ? Serializable<T[K]> : never;
    }
    // Special types
     | ReadableStream<Uint8Array> | WritableStream<Uint8Array> | Request | Response | Headers | Stub<Stubable>
    // Serialized as stubs, see `Stubify`
     | Stubable;
    // Base type for all RPC stubs, including common memory management methods.
    // `T` is used as a marker type for unwrapping `Stub`s later.
    interface StubBase<T extends Stubable> extends Disposable {
        [__RPC_STUB_BRAND]: T;
        dup(): this;
    }
    export type Stub<T extends Stubable> = Provider<T> & StubBase<T>;
    // Recursively rewrite all `Stubable` types with `Stub`s
    // prettier-ignore
    type Stubify<T> = T extends Stubable ? Stub<T> : T extends Map<infer K, infer V> ? Map<Stubify<K>, Stubify<V>> : T extends Set<infer V> ? Set<Stubify<V>> : T extends Array<infer V> ? Array<Stubify<V>> : T extends ReadonlyArray<infer V> ? ReadonlyArray<Stubify<V>> : T extends {
        [key: string | number]: any;
    } ? {
        [K in keyof T]: Stubify<T[K]>;
    } : T;
    // Recursively rewrite all `Stub<T>`s with the corresponding `T`s.
    // Note we use `StubBase` instead of `Stub` here to avoid circular dependencies:
    // `Stub` depends on `Provider`, which depends on `Unstubify`, which would depend on `Stub`.
    // prettier-ignore
    type Unstubify<T> = T extends StubBase<infer V> ? V : T extends Map<infer K, infer V> ? Map<Unstubify<K>, Unstubify<V>> : T extends Set<infer V> ? Set<Unstubify<V>> : T extends Array<infer V> ? Array<Unstubify<V>> : T extends ReadonlyArray<infer V> ? ReadonlyArray<Unstubify<V>> : T extends {
        [key: string | number]: unknown;
    } ? {
        [K in keyof T]: Unstubify<T[K]>;
    } : T;
    type UnstubifyAll<A extends any[]> = {
        [I in keyof A]: Unstubify<A[I]>;
    };
    // Utility type for adding `Provider`/`Disposable`s to `object` types only.
    // Note `unknown & T` is equivalent to `T`.
    type MaybeProvider<T> = T extends object ? Provider<T> : unknown;
    type MaybeDisposable<T> = T extends object ? Disposable : unknown;
    // Type for method return or property on an RPC interface.
    // - Stubable types are replaced by stubs.
    // - Serializable types are passed by value, with stubable types replaced by stubs
    //   and a top-level `Disposer`.
    // Everything else can't be passed over PRC.
    // Technically, we use custom thenables here, but they quack like `Promise`s.
    // Intersecting with `(Maybe)Provider` allows pipelining.
    // prettier-ignore
    type Result<R> = R extends Stubable ? Promise<Stub<R>> & Provider<R> : R extends Serializable<R> ? Promise<Stubify<R> & MaybeDisposable<R>> & MaybeProvider<R> : never;
    // Type for method or property on an RPC interface.
    // For methods, unwrap `Stub`s in parameters, and rewrite returns to be `Result`s.
    // Unwrapping `Stub`s allows calling with `Stubable` arguments.
    // For properties, rewrite types to be `Result`s.
    // In each case, unwrap `Promise`s.
    type MethodOrProperty<V> = V extends (...args: infer P) => infer R ? (...args: UnstubifyAll<P>) => Result<Awaited<R>> : Result<Awaited<V>>;
    // Type for the callable part of an `Provider` if `T` is callable.
    // This is intersected with methods/properties.
    type MaybeCallableProvider<T> = T extends (...args: any[]) => any ? MethodOrProperty<T> : unknown;
    // Base type for all other types providing RPC-like interfaces.
    // Rewrites all methods/properties to be `MethodOrProperty`s, while preserving callable types.
    // `Reserved` names (e.g. stub method names like `dup()`) and symbols can't be accessed over RPC.
    export type Provider<T extends object, Reserved extends string = never> = MaybeCallableProvider<T> & {
        [K in Exclude<keyof T, Reserved | symbol | keyof StubBase<never>>]: MethodOrProperty<T[K]>;
    };
}
declare module "cloudflare:workers" {
    export type RpcStub<T extends Rpc.Stubable> = Rpc.Stub<T>;
    export const RpcStub: {
        new <T extends Rpc.Stubable>(value: T): Rpc.Stub<T>;
    };
    export abstract class RpcTarget implements Rpc.RpcTargetBranded {
        [Rpc.__RPC_TARGET_BRAND]: never;
    }
    // `protected` fields don't appear in `keyof`s, so can't be accessed over RPC
    export abstract class WorkerEntrypoint<Env = unknown> implements Rpc.WorkerEntrypointBranded {
        [Rpc.__WORKER_ENTRYPOINT_BRAND]: never;
        protected ctx: ExecutionContext;
        protected env: Env;
        constructor(ctx: ExecutionContext, env: Env);
        fetch?(request: Request): Response | Promise<Response>;
        tail?(events: TraceItem[]): void | Promise<void>;
        trace?(traces: TraceItem[]): void | Promise<void>;
        scheduled?(controller: ScheduledController): void | Promise<void>;
        queue?(batch: MessageBatch<unknown>): void | Promise<void>;
        test?(controller: TestController): void | Promise<void>;
    }
    export abstract class DurableObject<Env = unknown> implements Rpc.DurableObjectBranded {
        [Rpc.__DURABLE_OBJECT_BRAND]: never;
        protected ctx: DurableObjectState;
        protected env: Env;
        constructor(ctx: DurableObjectState, env: Env);
        fetch?(request: Request): Response | Promise<Response>;
        alarm?(): void | Promise<void>;
        webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
        webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
        webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
    }
    export type WorkflowDurationLabel = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
    export type WorkflowSleepDuration = `${number} ${WorkflowDurationLabel}${"s" | ""}` | number;
    export type WorkflowBackoff = "constant" | "linear" | "exponential";
    export type WorkflowStepConfig = {
        retries?: {
            limit: number;
            delay: string | number;
            backoff?: WorkflowBackoff;
        };
        timeout?: string | number;
    };
    export type WorkflowEvent<T> = {
        payload: Readonly<T>;
        timestamp: Date;
    };
    export abstract class WorkflowStep {
        do<T extends Rpc.Serializable<T>>(name: string, callback: () => Promise<T>): Promise<T>;
        do<T extends Rpc.Serializable<T>>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
        sleep: (name: string, duration: WorkflowSleepDuration) => Promise<void>;
        sleepUntil: (name: string, timestamp: Date | number) => Promise<void>;
    }
    export abstract class WorkflowEntrypoint<Env = unknown, T extends Rpc.Serializable<T> | unknown = unknown> implements Rpc.WorkflowEntrypointBranded {
        [Rpc.__WORKFLOW_ENTRYPOINT_BRAND]: never;
        protected ctx: ExecutionContext;
        protected env: Env;
        run(event: Readonly<WorkflowEvent<T>>, step: WorkflowStep): Promise<unknown>;
    }
}
declare module "cloudflare:sockets" {
    function _connect(address: string | SocketAddress, options?: SocketOptions): Socket;
    export { _connect as connect };
}
// Copyright (c) 2022-2023 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
/**
 * Data types supported for holding vector metadata.
 */
type VectorizeVectorMetadataValue = string | number | boolean | string[];
/**
 * Additional information to associate with a vector.
 */
type VectorizeVectorMetadata = VectorizeVectorMetadataValue | Record<string, VectorizeVectorMetadataValue>;
type VectorFloatArray = Float32Array | Float64Array;
interface VectorizeError {
    code?: number;
    error: string;
}
/**
 * Comparison logic/operation to use for metadata filtering.
 *
 * This list is expected to grow as support for more operations are released.
 */
type VectorizeVectorMetadataFilterOp = "$eq" | "$ne";
/**
 * Filter criteria for vector metadata used to limit the retrieved query result set.
 */
type VectorizeVectorMetadataFilter = {
    [field: string]: Exclude<VectorizeVectorMetadataValue, string[]> | null | {
        [Op in VectorizeVectorMetadataFilterOp]?: Exclude<VectorizeVectorMetadataValue, string[]> | null;
    };
};
/**
 * Supported distance metrics for an index.
 * Distance metrics determine how other "similar" vectors are determined.
 */
type VectorizeDistanceMetric = "euclidean" | "cosine" | "dot-product";
/**
 * Metadata return levels for a Vectorize query.
 *
 * Default to "none".
 *
 * @property all      Full metadata for the vector return set, including all fields (including those un-indexed) without truncation. This is a more expensive retrieval, as it requires additional fetching & reading of un-indexed data.
 * @property indexed  Return all metadata fields configured for indexing in the vector return set. This level of retrieval is "free" in that no additional overhead is incurred returning this data. However, note that indexed metadata is subject to truncation (especially for larger strings).
 * @property none     No indexed metadata will be returned.
 */
type VectorizeMetadataRetrievalLevel = "all" | "indexed" | "none";
interface VectorizeQueryOptions {
    topK?: number;
    namespace?: string;
    returnValues?: boolean;
    returnMetadata?: boolean | VectorizeMetadataRetrievalLevel;
    filter?: VectorizeVectorMetadataFilter;
}
/**
 * Information about the configuration of an index.
 */
type VectorizeIndexConfig = {
    dimensions: number;
    metric: VectorizeDistanceMetric;
} | {
    preset: string; // keep this generic, as we'll be adding more presets in the future and this is only in a read capacity
};
/**
 * Metadata about an existing index.
 *
 * This type is exclusively for the Vectorize **beta** and will be deprecated once Vectorize RC is released.
 * See {@link VectorizeIndexInfo} for its post-beta equivalent.
 */
interface VectorizeIndexDetails {
    /** The unique ID of the index */
    readonly id: string;
    /** The name of the index. */
    name: string;
    /** (optional) A human readable description for the index. */
    description?: string;
    /** The index configuration, including the dimension size and distance metric. */
    config: VectorizeIndexConfig;
    /** The number of records containing vectors within the index. */
    vectorsCount: number;
}
/**
 * Metadata about an existing index.
 */
interface VectorizeIndexInfo {
    /** The number of records containing vectors within the index. */
    vectorCount: number;
    /** Number of dimensions the index has been configured for. */
    dimensions: number;
    /** ISO 8601 datetime of the last processed mutation on in the index. All changes before this mutation will be reflected in the index state. */
    processedUpToDatetime: number;
    /** UUIDv4 of the last mutation processed by the index. All changes before this mutation will be reflected in the index state. */
    processedUpToMutation: number;
}
/**
 * Represents a single vector value set along with its associated metadata.
 */
interface VectorizeVector {
    /** The ID for the vector. This can be user-defined, and must be unique. It should uniquely identify the object, and is best set based on the ID of what the vector represents. */
    id: string;
    /** The vector values */
    values: VectorFloatArray | number[];
    /** The namespace this vector belongs to. */
    namespace?: string;
    /** Metadata associated with the vector. Includes the values of other fields and potentially additional details. */
    metadata?: Record<string, VectorizeVectorMetadata>;
}
/**
 * Represents a matched vector for a query along with its score and (if specified) the matching vector information.
 */
type VectorizeMatch = Pick<Partial<VectorizeVector>, "values"> & Omit<VectorizeVector, "values"> & {
    /** The score or rank for similarity, when returned as a result */
    score: number;
};
/**
 * A set of matching {@link VectorizeMatch} for a particular query.
 */
interface VectorizeMatches {
    matches: VectorizeMatch[];
    count: number;
}
/**
 * Results of an operation that performed a mutation on a set of vectors.
 * Here, `ids` is a list of vectors that were successfully processed.
 *
 * This type is exclusively for the Vectorize **beta** and will be deprecated once Vectorize RC is released.
 * See {@link VectorizeAsyncMutation} for its post-beta equivalent.
 */
interface VectorizeVectorMutation {
    /* List of ids of vectors that were successfully processed. */
    ids: string[];
    /* Total count of the number of processed vectors. */
    count: number;
}
/**
 * Result type indicating a mutation on the Vectorize Index.
 * Actual mutations are processed async where the `mutationId` is the unique identifier for the operation.
 */
interface VectorizeAsyncMutation {
    /** The unique identifier for the async mutation operation containing the changeset. */
    mutationId: string;
}
/**
 * A Vectorize Vector Search Index for querying vectors/embeddings.
 *
 * This type is exclusively for the Vectorize **beta** and will be deprecated once Vectorize RC is released.
 * See {@link Vectorize} for its new implementation.
 */
declare abstract class VectorizeIndex {
    /**
     * Get information about the currently bound index.
     * @returns A promise that resolves with information about the current index.
     */
    public describe(): Promise<VectorizeIndexDetails>;
    /**
     * Use the provided vector to perform a similarity search across the index.
     * @param vector Input vector that will be used to drive the similarity search.
     * @param options Configuration options to massage the returned data.
     * @returns A promise that resolves with matched and scored vectors.
     */
    public query(vector: VectorFloatArray | number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
    /**
     * Insert a list of vectors into the index dataset. If a provided id exists, an error will be thrown.
     * @param vectors List of vectors that will be inserted.
     * @returns A promise that resolves with the ids & count of records that were successfully processed.
     */
    public insert(vectors: VectorizeVector[]): Promise<VectorizeVectorMutation>;
    /**
     * Upsert a list of vectors into the index dataset. If a provided id exists, it will be replaced with the new values.
     * @param vectors List of vectors that will be upserted.
     * @returns A promise that resolves with the ids & count of records that were successfully processed.
     */
    public upsert(vectors: VectorizeVector[]): Promise<VectorizeVectorMutation>;
    /**
     * Delete a list of vectors with a matching id.
     * @param ids List of vector ids that should be deleted.
     * @returns A promise that resolves with the ids & count of records that were successfully processed (and thus deleted).
     */
    public deleteByIds(ids: string[]): Promise<VectorizeVectorMutation>;
    /**
     * Get a list of vectors with a matching id.
     * @param ids List of vector ids that should be returned.
     * @returns A promise that resolves with the raw unscored vectors matching the id set.
     */
    public getByIds(ids: string[]): Promise<VectorizeVector[]>;
}
/**
 * A Vectorize Vector Search Index for querying vectors/embeddings.
 *
 * Mutations in this version are async, returning a mutation id.
 */
declare abstract class Vectorize {
    /**
     * Get information about the currently bound index.
     * @returns A promise that resolves with information about the current index.
     */
    public describe(): Promise<VectorizeIndexInfo>;
    /**
     * Use the provided vector to perform a similarity search across the index.
     * @param vector Input vector that will be used to drive the similarity search.
     * @param options Configuration options to massage the returned data.
     * @returns A promise that resolves with matched and scored vectors.
     */
    public query(vector: VectorFloatArray | number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
    /**
     * Use the provided vector-id to perform a similarity search across the index.
     * @param vectorId Id for a vector in the index against which the index should be queried.
     * @param options Configuration options to massage the returned data.
     * @returns A promise that resolves with matched and scored vectors.
     */
    public queryById(vectorId: string, options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
    /**
     * Insert a list of vectors into the index dataset. If a provided id exists, an error will be thrown.
     * @param vectors List of vectors that will be inserted.
     * @returns A promise that resolves with a unique identifier of a mutation containing the insert changeset.
     */
    public insert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
    /**
     * Upsert a list of vectors into the index dataset. If a provided id exists, it will be replaced with the new values.
     * @param vectors List of vectors that will be upserted.
     * @returns A promise that resolves with a unique identifier of a mutation containing the upsert changeset.
     */
    public upsert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
    /**
     * Delete a list of vectors with a matching id.
     * @param ids List of vector ids that should be deleted.
     * @returns A promise that resolves with a unique identifier of a mutation containing the delete changeset.
     */
    public deleteByIds(ids: string[]): Promise<VectorizeAsyncMutation>;
    /**
     * Get a list of vectors with a matching id.
     * @param ids List of vector ids that should be returned.
     * @returns A promise that resolves with the raw unscored vectors matching the id set.
     */
    public getByIds(ids: string[]): Promise<VectorizeVector[]>;
}
/**
 * The interface for "version_metadata" binding
 * providing metadata about the Worker Version using this binding.
 */
type WorkerVersionMetadata = {
    /** The ID of the Worker Version using this binding */
    id: string;
    /** The tag of the Worker Version using this binding */
    tag: string;
    /** The timestamp of when the Worker Version was uploaded */
    timestamp: string;
};
interface DynamicDispatchLimits {
    /**
     * Limit CPU time in milliseconds.
     */
    cpuMs?: number;
    /**
     * Limit number of subrequests.
     */
    subRequests?: number;
}
interface DynamicDispatchOptions {
    /**
     * Limit resources of invoked Worker script.
     */
    limits?: DynamicDispatchLimits;
    /**
     * Arguments for outbound Worker script, if configured.
     */
    outbound?: {
        [key: string]: any;
    };
}
interface DispatchNamespace {
    /**
    * @param name Name of the Worker script.
    * @param args Arguments to Worker script.
    * @param options Options for Dynamic Dispatch invocation.
    * @returns A Fetcher object that allows you to send requests to the Worker script.
    * @throws If the Worker script does not exist in this dispatch namespace, an error will be thrown.
    */
    get(name: string, args?: {
        [key: string]: any;
    }, options?: DynamicDispatchOptions): Fetcher;
}
declare module "cloudflare:workflows" {
    /**
     * NonRetryableError allows for a user to throw a fatal error
     * that makes a Workflow instance fail immediately without triggering a retry
     */
    export class NonRetryableError extends Error {
        public constructor(message: string, name?: string);
    }
}
declare abstract class Workflow {
    /**
     * Get a handle to an existing instance of the Workflow.
     * @param id Id for the instance of this Workflow
     * @returns A promise that resolves with a handle for the Instance
     */
    public get(id: string): Promise<WorkflowInstance>;
    /**
     * Create a new instance and return a handle to it. If a provided id exists, an error will be thrown.
     * @param options Options when creating an instance including id and params
     * @returns A promise that resolves with a handle for the Instance
     */
    public create(options?: WorkflowInstanceCreateOptions): Promise<WorkflowInstance>;
}
interface WorkflowInstanceCreateOptions {
    /**
     * An id for your Workflow instance. Must be unique within the Workflow.
     */
    id?: string;
    /**
     * The event payload the Workflow instance is triggered with
     */
    params?: unknown;
}
type InstanceStatus = {
    status: "queued" // means that instance is waiting to be started (see concurrency limits)
     | "running" | "paused" | "errored" | "terminated" // user terminated the instance while it was running
     | "complete" | "waiting" // instance is hibernating and waiting for sleep or event to finish
     | "waitingForPause" // instance is finishing the current work to pause
     | "unknown";
    error?: string;
    output?: object;
};
interface WorkflowError {
    code?: number;
    message: string;
}
declare abstract class WorkflowInstance {
    public id: string;
    /**
     * Pause the instance.
     */
    public pause(): Promise<void>;
    /**
     * Resume the instance. If it is already running, an error will be thrown.
     */
    public resume(): Promise<void>;
    /**
     * Terminate the instance. If it is errored, terminated or complete, an error will be thrown.
     */
    public terminate(): Promise<void>;
    /**
     * Restart the instance.
     */
    public restart(): Promise<void>;
    /**
     * Returns the current status of the instance.
     */
    public status(): Promise<InstanceStatus>;
}
