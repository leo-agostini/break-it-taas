# ADR-003: Fronteira de erros entre domínio e HTTP

## Status
Accepted

## Contexto

Erros de domínio estavam carregando `httpStatus`, acoplando semântica de negócio ao protocolo de transporte.

## Decisão

- Remover `httpStatus` de `BaseError` no domínio.
- Manter no domínio apenas `code`, `message`, `description`, `help`.
- Introduzir `application/errors/http-error-mapper.ts` para mapear códigos de domínio para status HTTP.

## Tradeoffs

### Prós
- Melhor separação de camadas.
- Reuso do domínio fora de HTTP.

### Contras
- Exige manutenção de tabela de mapeamento no application layer.
