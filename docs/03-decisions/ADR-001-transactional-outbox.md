# ADR-001: Transactional Outbox para despacho de TestRun

## Status
Accepted

## Contexto

Ao criar um `TestRun`, havia risco de inconsistência entre persistência no banco e publicação em fila.

## Decisão

Usar padrão Transactional Outbox: persistir `TestRun` e `OutboxEvent` na mesma transação; worker assíncrono publica e marca status.

## Tradeoffs

### Prós
- Aumenta confiabilidade contra falhas parciais.
- Permite retry controlado e auditabilidade (`PENDING`, `PUBLISHED`, `FAILED`).

### Contras
- Mais componentes operacionais (worker + tabela outbox + políticas de retry).
- Entrega eventual, não imediata.

## Referências

- Martin Fowler — Transactional Outbox
- microservices.io — Transactional Outbox
