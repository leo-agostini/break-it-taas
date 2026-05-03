# Problem Statement

O projeto **Break-It TaaS** resolve uma dor comum de times de engenharia: executar testes de carga com consistência sem exigir escrita manual de scripts k6 por todos os usuários.

## Problema

- Ferramentas de carga exigem conhecimento técnico específico.
- Execuções manuais têm baixa rastreabilidade.
- Não há fluxo padronizado para versionar cenários, executar remotamente e comparar resultados.

## Objetivo do sistema

Fornecer uma plataforma web para modelar cenários de carga de forma declarativa, executar remotamente, acompanhar status e analisar resultados com histórico.

## Escopo atual

- Backend orientado a domínio com casos de uso de criação de teste e criação de execução.
- Pipeline de despacho confiável com Transactional Outbox.
- Frontend em estágio inicial.
