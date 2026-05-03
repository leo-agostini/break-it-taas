# Domain Boundaries

## Decisão de fronteira

O domínio deve expressar semântica de negócio (ex.: `NOT_FOUND`, `VALIDATION_ERROR`) sem depender de protocolo HTTP.

## Aplicação da regra no projeto

- `domain/errors/*`: contém código, mensagem e metadados descritivos.
- `application/errors/http-error-mapper.ts`: converte erro de domínio para status HTTP.
- `index.ts`: usa mapper para serializar resposta de erro padronizada.

## Benefícios

- Mantém o domínio reutilizável fora de HTTP.
- Centraliza política de transporte em um único ponto.
- Facilita evolução futura (ex.: gRPC, filas, CLI).
