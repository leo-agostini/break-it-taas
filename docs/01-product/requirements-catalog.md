# Catálogo de Requisitos (baseline)

## Requisitos Funcionais

### RF01 — Cadastro e autenticação de usuários
A plataforma deve permitir o cadastro, login e logout de usuários, garantindo acesso individual ao sistema.

### RF02 — Criação de testes de carga
O usuário deve poder cadastrar um novo teste de carga informando nome, descrição, URL alvo, número de usuários virtuais, duração, ramp-up e outros parâmetros necessários.

### RF03 — Configuração declarativa dos cenários
A plataforma deve permitir a definição de cenários de teste por meio de formulários ou interface declarativa, sem exigir que o usuário escreva scripts manualmente.

### RF04 — Agendamento de execuções
O sistema deve permitir que o usuário agende a execução de testes para data e horário específicos.

### RF05 — Execução remota dos testes
A plataforma deve enviar os testes configurados para execução em ambiente remoto, como contêineres ou máquinas dedicadas.

### RF06 — Acompanhamento de execução
O usuário deve conseguir visualizar o status do teste, como pendente, em execução, concluído ou com falha.

### RF07 — Coleta de métricas
O sistema deve coletar e armazenar métricas geradas durante a execução, como tempo médio de resposta, p95, p99, throughput e taxa de erro.

### RF08 — Histórico de execuções
A plataforma deve manter um histórico de testes realizados, permitindo consulta posterior dos resultados.

### RF09 — Comparação entre execuções
O sistema deve permitir comparar resultados de diferentes execuções de um mesmo teste, identificando evolução ou regressão de desempenho.

### RF10 — Geração de relatórios
A plataforma deve gerar relatórios com os resultados do teste, contendo métricas, gráficos e resumo da execução.

### RF11 — Gerenciamento de ambientes de teste
O usuário deve poder cadastrar e selecionar diferentes ambientes-alvo, como homologação, staging e produção controlada.

### RF12 — Notificação de término
O sistema deve notificar o usuário quando a execução de um teste for concluída ou interrompida por erro.

### RF13 — Controle de recursos de execução
A plataforma deve gerenciar a alocação de recursos computacionais para impedir que testes simultâneos interfiram entre si.

### RF14 — Cancelamento de testes
O usuário deve poder interromper manualmente uma execução em andamento.

### RF15 — Visualização de logs
A plataforma deve disponibilizar logs da execução para apoiar análise de falhas e auditoria.

## Requisitos Não Funcionais

### RNF01 — Desempenho
A plataforma deve ser capaz de iniciar a execução de um teste em até um tempo aceitável após a solicitação do usuário, por exemplo, em até 30 segundos.

### RNF02 — Escalabilidade
O sistema deve permitir crescimento da capacidade de execução, suportando aumento do número de usuários, cenários e testes simultâneos.

### RNF03 — Isolamento de execução
Cada teste deve ser executado de forma isolada, preferencialmente em contêiner próprio, evitando interferência nos resultados de outros testes.

### RNF04 — Disponibilidade
A plataforma deve manter alta disponibilidade para criação, acompanhamento e consulta de testes, reduzindo indisponibilidades operacionais.

### RNF05 — Segurança de acesso
O sistema deve exigir autenticação para acesso às funcionalidades e restringir operações conforme o perfil do usuário.

### RNF06 — Confidencialidade dos dados
As informações de usuários, ambientes e resultados devem ser armazenadas e transmitidas de forma segura.

### RNF07 — Usabilidade
A interface deve ser simples e intuitiva, permitindo que usuários com pouco conhecimento em scripts de teste consigam configurar execuções.

### RNF08 — Confiabilidade
A plataforma deve garantir que os resultados armazenados correspondam fielmente à execução realizada, preservando consistência dos dados.

### RNF09 — Manutenibilidade
O sistema deve ser desenvolvido de forma modular, facilitando correções, evolução da plataforma e inclusão de novas funcionalidades.

### RNF10 — Portabilidade
A solução deve poder ser implantada em diferentes ambientes computacionais, como VPS, servidores locais ou provedores em nuvem.

### RNF11 — Auditabilidade
A plataforma deve registrar ações relevantes, como criação, edição, execução e cancelamento de testes, para rastreabilidade.

### RNF12 — Tempo de resposta da interface
As telas principais, como listagem de testes e visualização de relatórios, devem responder em tempo adequado ao usuário.

### RNF13 — Compatibilidade
A interface web deve funcionar corretamente nos principais navegadores modernos.

### RNF14 — Persistência e integridade
Os resultados das execuções devem ser persistidos sem perda de dados, mesmo em caso de falhas parciais do sistema.

### RNF15 — Extensibilidade
A arquitetura deve permitir futura integração com novas ferramentas de teste, novos tipos de métricas e múltiplos nós de execução.
