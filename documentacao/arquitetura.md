# Arquitetura e Modelagem do Sistema: Excalidraw

Este documento apresenta a análise arquitetural do projeto **Excalidraw**, detalhando suas escolhas de design, mapeamento de componentes, além de documentar a refatoração realizada para eliminação de *code smells* e a aplicação de padrões de projeto (*Design Patterns*).

---

## 1. Descrição da Arquitetura

O Excalidraw é primariamente uma **Single Page Application (SPA)** focada no processamento do lado do cliente (*Client-Side Rendering*). Ao contrário de sistemas web tradicionais com backend denso, o Excalidraw adota uma estratégia onde a inteligência da aplicação reside no navegador do usuário.

A arquitetura do cliente não segue o modelo MVC (Model-View-Controller) clássico de servidores, mas sim uma **Arquitetura Baseada em Componentes** (via React) combinada com um fluxo de **Gerenciamento de Estado Centralizado** e **Renderização em Canvas**. Há também uma infraestrutura de suporte seguindo o modelo **Cliente-Servidor** para recursos de sincronização e colaboração.

As principais camadas lógicas do sistema são:

* **Camada de Interface (UI):** Componentes React estruturados que gerenciam menus, barras de ferramentas, modais e painéis de configuração. Responsável por capturar eventos de entrada do usuário.
* **Camada de Gerenciamento de Estado:** Mantém a árvore de estados centralizada da aplicação (`appState` e a lista de `elements`). Controla o histórico de ações (Undo/Redo) e as propriedades globais da cena.
* **Camada de Renderização (Core):** Utiliza a API HTML5 `<canvas>` em conjunto com a biblioteca *Rough.js*. Essa camada é isolada da UI do React por questões de desempenho, redesenhando os elementos gráficos de forma otimizada para simular o aspecto de "esboço à mão".
* **Camada de Persistência e Rede:** Gerencia o armazenamento local (*LocalStorage* / *IndexedDB*) e o módulo de sincronização em tempo real (via *WebSockets*) para salas colaborativas, implementando criptografia de ponta a ponta (E2EE).

O backend do ecossistema é minimalista. Ele atua como um intermediário (*stateless relay server*), focado em retransmitir mensagens via WebSocket e armazenar temporariamente payloads criptografados, sem ter conhecimento do conteúdo dos diagramas.

---

## 2. Justificativa da Arquitetura

As escolhas arquiteturais do Excalidraw são fundamentadas por requisitos não funcionais críticos do projeto:

* **Alta Performance de Renderização:** O uso de `<canvas>` em detrimento do SVG ou manipulação direta de nós do DOM via React garante que a aplicação mantenha uma taxa de quadros estável (60 FPS), mesmo em telas com milhares de formas geométricas simultâneas. O React gerencia apenas os menus estáticos periféricos.
* **Estratégia Offline-First:** Como toda a lógica de manipulação geométrica, cálculo de colisões e estado reside no cliente, o aplicativo mantém total usabilidade sem conectividade com a internet. O rascunho é preservado localmente no navegador.
* **Privacidade e Segurança por Design (E2EE):** Ao delegar a criptografia e descriptografia das salas colaborativas exclusivamente ao cliente, o servidor backend atua "às cegas". Isso elimina o risco de vazamento de dados confidenciais nos servidores e reduz drasticamente os custos e a complexidade de processamento no backend.
* **Manutenibilidade e Extensibilidade:** A clara separação entre a interface reativa (React) e o motor gráfico (Canvas) permite que a comunidade open-source contribua extensivamente com novos componentes visuais sem comprometer o núcleo matemático de renderização da ferramenta.

---

## 3. Diagrama de Componentes e Pacotes

O diagrama abaixo ilustra a separação de responsabilidades dentro da aplicação cliente, a separação de pacotes internos e como ocorre a interação com os serviços de apoio no backend.

```mermaid
graph TD
    subgraph Frontend [Cliente - Aplicação Excalidraw]
        UI[Camada de Interface / React Components]
        State[Gerenciamento de Estado / AppState & Elements]
        Renderer[Motor de Renderização / Canvas API + Rough.js]
        StorageLocal[Persistência Local / Browser Storage]
        Sync[Módulo de Sincronização e Criptografia E2EE]
    end

    subgraph Backend [Servidor - Serviços de Apoio]
        WS[Servidor WebSocket / Colaboração em Tempo Real]
        StorageRemote[Armazenamento de Links e Arquivos]
    end

    %% Fluxos Internos do Cliente
    UI -->|Dispara ações| State
    State -->|Fornece dados da cena| Renderer
    State -->|Salva rascunhos| StorageLocal
    
    %% Fluxos de Rede
    State -->|Inicia compartilhamento| Sync
    Sync <-->|Transmite pacotes criptografados| WS
    Sync -->|Salva payload cifrado| StorageRemote

    classDef react fill:#61dafb,stroke:#333,stroke-width:1px,color:black;
    classDef core fill:#f9f6e5,stroke:#333,stroke-width:2px,color:black;
    classDef server fill:#4caf50,stroke:#333,stroke-width:1px,color:white;

    class UI react;
    class Renderer,State,StorageLocal,Sync core;
    class WS,StorageRemote server;