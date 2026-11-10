# Domain Boundaries

## Decisão de fronteira

O domínio deve expressar semântica de negócio (ex.: `NOT_FOUND`, `VALIDATION_ERROR`) sem depender de protocolo HTTP.

## Aplicação da regra no projeto

- `backend/app/modules/shared/domain/errors.ts`: contém código, mensagem e metadados descritivos.
- `backend/app/modules/shared/http/error_mapper.ts`: converte erro de domínio (e erros de framework, como falha de validação ou ausência de sessão) para status HTTP.
- `backend/app/exceptions/handler.ts`: usa o mapper para serializar a resposta de erro padronizada.

## Benefícios

- Mantém o domínio reutilizável fora de HTTP.
- Centraliza política de transporte em um único ponto.
- Facilita evolução futura (ex.: gRPC, filas, CLI).
