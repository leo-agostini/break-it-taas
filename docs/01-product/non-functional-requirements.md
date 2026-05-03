# Requisitos Não Funcionais (RNF)

## RNF catalog

- RNF01 — Desempenho
- RNF02 — Escalabilidade
- RNF03 — Isolamento de execução
- RNF04 — Disponibilidade
- RNF05 — Segurança de acesso
- RNF06 — Confidencialidade dos dados
- RNF07 — Usabilidade
- RNF08 — Confiabilidade
- RNF09 — Manutenibilidade
- RNF10 — Portabilidade
- RNF11 — Auditabilidade
- RNF12 — Tempo de resposta da interface
- RNF13 — Compatibilidade
- RNF14 — Persistência e integridade
- RNF15 — Extensibilidade

## Metas iniciais mensuráveis (draft)

- RNF01: iniciar execução em até 30s após solicitação (meta alvo).
- RNF14: garantir persistência do intento de despacho via outbox transacional.
- RNF09: manter separação `domain` / `application` / `infra` e contratos por portas.
- RNF15: manter modelo de domínio desacoplado de engine específica (k6 como adaptador).
