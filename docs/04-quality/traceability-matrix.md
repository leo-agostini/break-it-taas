# Matriz de Rastreabilidade (draft)

| Requisito | Implementação atual | Evidência disponível |
|---|---|---|
| RF02 Criação de testes | `CreateNewTestCaseUseCase` | Código + PRD |
| RF05 Execução remota (intenção) | Outbox + dispatcher worker | ADR-001 + código |
| RF06 Acompanhamento status | `TestRunStatus` e transições | Código domínio |
| RNF14 Persistência/integridade | Transactional outbox | ADR-001 |
| RNF09 Manutenibilidade | Camadas domain/application/db | Estrutura de pastas |
| RNF15 Extensibilidade | Modelo agnóstico à engine | ADR-002 + PRD |

> Observação: testes automatizados ainda serão adicionados após conclusão do trabalho de domínio.
