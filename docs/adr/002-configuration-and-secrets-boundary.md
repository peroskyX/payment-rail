# ADR 002: Configuration validation and secrets boundary

- Status: accepted
- Date: 2026-10-08

## Context

An application that boots with missing or malformed provider/database configuration fails later in less understandable and potentially unsafe ways. Secrets also must not be scattered through source code or logs.

## Decision

Use `@nestjs/config` with synchronous startup validation. The application fails bootstrap if required settings are absent or invalid. Environment variables are acceptable for local sandbox development; a secrets manager becomes the deployment source later.

`ConfigurationModule` is global because configuration is truly application-wide. Feature modules should still consume typed configuration groups rather than arbitrary environment access. Controllers and domain objects never read `process.env`.

## Consequences

- Misconfiguration is detected before the service accepts traffic.
- Test environments explicitly define their inputs.
- Secret values stay out of Git and logs.
- Adding provider configuration requires validation and redaction review.

## Alternatives

- Read environment variables at point of use: rejected because errors become late and dependencies stay hidden.
- Commit development secrets: rejected.
- Make every module re-import configuration: possible, but unnecessary for this cross-cutting infrastructure.

## Review triggers

- First provider credential is introduced.
- A deployment secrets manager is selected.
- Configuration must reload dynamically.
