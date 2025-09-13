// Augment Express Request to include a request ID
// This fixes TS errors like: Property 'id' does not exist on type 'Request'

import 'express-serve-static-core';
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Optional request identifier attached by middleware */
    id?: string;
  }
}

declare module 'express' {
  interface Request {
    /** Optional request identifier attached by middleware */
    id?: string;
  }
}
