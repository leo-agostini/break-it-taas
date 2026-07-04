Create a clean, high-level software architecture diagram (flat-modern style,
light background, rounded rectangles, bold labeled arrows, minimal text,
high resolution) titled "Break It TaaS — High-Level Architecture".

Show ONLY the main components, connected in a simple flow. No namespaces,
no replica counts, no internal layers — just the big building blocks.

Components and arrows, in order:

1. "User"
        | uses (HTTP)
        v
2. "Frontend (React)"
        | calls REST API (/api)
        v
3. "Backend API (Bun + Elysia)"
        | persists data + outbox event
        v
4. "PostgreSQL"
        | worker reads pending events
        v
5. "Outbox Worker"
        | creates load test job
        v
6. "Kubernetes (k3s)"
        | runs
        v
7. "k6 Runner Job"
        | sends load traffic
        v
8. "Target API"

Add ONE dashed feedback arrow from "k6 Runner Job" back to "Backend API"
labeled "signed callback with results".

Use a single accent color for arrows, soft distinct fills per box, generous
spacing, and clean sans-serif typography. Crisp, uncluttered overview.
