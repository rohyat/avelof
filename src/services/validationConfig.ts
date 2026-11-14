import { config } from 'zod'

// Configure before loading schemas: runtime validation avoids CSP-blocked JIT probes.
config({ jitless: true })
