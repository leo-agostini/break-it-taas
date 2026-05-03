# ADR-002: Modelo de domínio independente de k6

## Status
Accepted

## Contexto

O produto precisa permitir evolução para outras engines sem reescrever o núcleo da aplicação.

## Decisão

Modelar conceitos de negócio (tipo de teste, perfil de carga, steps, thresholds) de forma agnóstica e delegar mapeamento para engine ao adaptador de infraestrutura.

## Tradeoffs

### Prós
- Portabilidade (RNF10) e extensibilidade (RNF15).
- Linguagem de produto mais estável para usuários.

### Contras
- Necessidade de camada de tradução para cada engine.
- Possível perda de acesso imediato a features específicas da engine no MVP.
