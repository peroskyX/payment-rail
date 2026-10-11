# Provider evidence retention note

## Current Stage 3 policy

`payment_state_history` stores only canonical, allowlisted evidence metadata needed to explain a transition:

- attempt/provider relationship;
- provider reference and event ID;
- raw provider status string;
- system evidence code or canonical error category/code;
- occurrence, receipt, processing, and recording timestamps.

It does not store raw request/response bodies, authorization headers, secrets, bank credentials, card data, or arbitrary provider metadata. This reduces breach impact and prevents an unreviewed provider payload from becoming permanent financial history.

History rows are append-only. PostgreSQL rejects update and delete operations through a trigger, and foreign keys use `ON DELETE RESTRICT`. Providers and reference data are disabled rather than deleted once financial records reference them.

## Future webhook/provider payload storage

Stage 9 will need a separate inbox for authenticated raw webhook messages and deduplication. That store must be separate from canonical state/history and must have:

- provider-specific allowlisting/redaction before logs or long-term evidence;
- encrypted transport and storage;
- bounded payload size;
- access control and audit records;
- configurable retention by legal entity/environment;
- deletion/archival jobs that do not remove canonical transition facts;
- an integrity hash or provider event identifier retained when the body expires.

No universal production retention duration is chosen here. Legal, compliance, dispute, privacy, and provider-contract requirements differ by jurisdiction and entity. The owner must approve a documented duration before real production data is admitted. Test/simulator payloads should use short retention.

## Investigation principle

Retain the minimum evidence necessary to answer who observed what, from which provider attempt, when it occurred, when RailBridge received it, and which transition it justified. More payload is not automatically better evidence.
