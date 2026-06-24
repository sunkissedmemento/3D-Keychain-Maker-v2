declare module 'opentype.js';

declare module 'clipper-lib';

declare module 'three/examples/jsm/loaders/SVGLoader.js';

declare module 'three/examples/jsm/exporters/STLExporter.js';

declare module 'three/examples/jsm/utils/BufferGeometryUtils.js';

declare global {
  interface Window {
    storage: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<void>;
    };
  }
}

export {};
