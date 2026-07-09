# Contribuições

Este documento sumariza as contribuições realizadas no projeto de código aberto **Excalidraw**, detalhando a implementação de novas features (Caminho A), as refatorações arquiteturais (Caminho B), os Pull Requests gerados e o papel desempenhado por cada integrante da dupla .

---

## Caminho A: Manutenção Evolutiva/Corretiva

- **Link da Issue Escolhida:** [Feature Request: Persistent Laser / Annotation Tool #9884](https://github.com/excalidraw/excalidraw/issues/9884)
- **Descrição da Solução:**
  - O problema reportado pela comunidade consistia na necessidade de uma ferramenta de "Laser Persistente" (Annotation), onde o usuário pudesse fazer marcações temporárias na tela sem que o traço afinasse com a velocidade do mouse, diferentemente do laser padrão.
  - A solução envolveu a inclusão do `TOOL_TYPE.annotation` na matriz principal de formas do sistema e a atualização de tipagens estritas no núcleo (`packages/common`).
  - Na camada de Interface de Usuário (React), foi desenvolvido o `<AnnotationButton/>`, acoplado à `LayerUI` (Desktop) e estruturado no menu dropdown da `MobileToolBar`, garantindo responsividade global.
  - A física da ferramenta foi reescrita no arquivo `laserTrails.ts`, isolando o comportamento de decaimento do traço para garantir espessura fixa (valor `1`) exclusivamente para a anotação.
  - O ciclo de vida de eventos no `App.tsx` e `Cursors.ts` foi manipulado para permitir que o cursor identifique _hovers_ e _clicks_ sobre `Iframes` (vídeos) e `Hyperlinks` sem que a ferramenta perdesse o foco ou bloqueasse os eventos nativos do navegador.

---

## Caminho B: Engenharia de Qualidade e Refatoração

- **Descrição da Refatoração:**
  - Como parte da melhoria contínua da qualidade do código base do Excalidraw, foi implementada uma refatoração pontual de estrutura com foco na redução de acoplamento e melhoria na legibilidade (aplicação de princípios SOLID).
  - O detalhamento do que foi alterado e como os Code Smells foram mitigados encontra-se documentado no relatório de padrões e na submissão de código correspondente.
  - **Commit da Refatoração:** [479a889c38e304cb8079541923ace929ed70eda3](https://github.com/CaiqueGalinari/excalidraw/commit/479a889c38e304cb8079541923ace929ed70eda3)

---

## Lista de Pull Requests (PRs) Criados

1. **PR6 - feature/code_smells:** Relatório de code smells identificados, justificativas de design patterns e aplicação prática das refatorações no código (Caminho B).
2. **PR9 - feature/arquitetura:** Documentação e representação em diagramas da arquitetura estrutural do sistema.
3. **PR7 - feature/devops-ci-cd:** Análise e sugestões de adequação e melhorias na esteira de integração e entrega contínuas (CI/CD via GitHub Actions).
4. **PR10 - feature/ferramenta-anotacao:** Desenvolvimento, integração e estabilização da nova Feature de Anotação/Laser Persistente e resolução da Issue (Caminho A).
5. **PR11 - test/ferramenta-anotacao:** Implementação da suíte de testes de aceitação automatizados (cenários e automação via Vitest) cobrindo o comportamento da nova ferramenta.
6. **PR12 - documentation/contribuicoes:** Elaboração deste documento final de sumarização das contribuições, divisão de tarefas e mapeamento dos PRs.

_(Observação: Os Pull Requests e seus respectivos links estão disponíveis no fork principal: [CaiqueGalinari/excalidraw/commits/master](https://github.com/CaiqueGalinari/excalidraw/commits/master/))_

---

## Papel de Cada Integrante

Para o cumprimento dos requisitos da disciplina, a carga de trabalho prático e de engenharia foi dividida de maneira estratégica entre a dupla:

- **Caíque Galinari:** Focou integralmente no **Caminho A (Manutenção Evolutiva/Corretiva)** e na validação do sistema. Foi responsável pelo desenvolvimento _end-to-end_ da Issue #9884 (Ferramenta Annotation). Seu papel envolveu a criação dos componentes React, integração no monorepo (Core e Web), adaptação da lógica física de renderização do laser, modificação profunda do sistema de interações do usuário (hovers/clicks) e correção de vazamentos de memória (cache/states). Também foi responsável pela elaboração e configuração da automação dos testes de aceitação (Gherkin/Vitest).
- **Adonis:** Focou no **Caminho B (Engenharia de Qualidade e Refatoração)** e na documentação estrutural do projeto. Seu papel abrangeu a análise e confecção do diagrama da arquitetura, a identificação dos _Code Smells_ no código nativo do Excalidraw, o levantamento de Padrões de Projeto teóricos, e a codificação das refatorações para sanar dívidas técnicas. Além disso, encabeçou as análises e propostas de adequação da esteira de automação (_DevOps / CI/CD_).
