# Engenharia de Qualidade e Refatoração (Caminho B)

Este documento detalha os problemas de qualidade (_Code Smells_) identificados no código fonte do projeto Excalidraw, especificamente no arquivo `ExcalidrawPlusIframeExport.tsx`, bem como as soluções aplicadas baseadas em Princípios SOLID e Padrões de Projeto.

## Code Smells Identificados

### 1. Long Method (Componente Inchado)

- **Trecho do código original:** Componente React `ExcalidrawPlusIframeExport` e o Hook `useLayoutEffect`.
- **Problema identificado:** O _Hook_ dentro do componente tinha mais de 60 linhas e concentrava diversas responsabilidades. Ele não apenas lidava com o ciclo de vida do componente e eventos de mensagem, mas também tentava orquestrar validação, extração de dados e comunicação.
- **Solução proposta/aplicada:** Extração de Método e Delegação. A lógica densa de orquestração foi removida do componente e delegada para uma classe especializada, reduzindo drasticamente o acoplamento do _Hook_ de UI.

### 2. Violação do SRP (Princípio da Responsabilidade Única)

- **Trecho do código original:** Função `verifyJWT` localizada no mesmo arquivo de UI.
- **Problema identificado:** O arquivo responsável por montar um `Iframe` oculto do React também era o responsável por realizar operações criptográficas densas (importação de chave `crypto.subtle`, decode de Base64 e verificação de assinatura JWT). Misturar lógicas de infraestrutura/segurança com lógicas de View viola o SRP do SOLID.
- **Solução proposta/aplicada:** Foi criada a classe estática `JwtValidatorService`. Toda a responsabilidade de interpretar e validar o Token JWT foi isolada nesse serviço, blindando o componente React dessa complexidade.

### 3. Violação do DIP (Princípio da Inversão de Dependência)

- **Trecho do código original:** Chamadas `localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE)` hardcoded dentro da função `parseSceneData`.
- **Problema identificado:** A função que processava a cena estava altamente acoplada a um detalhe de infraestrutura de baixo nível (`localStorage` do navegador). Módulos de alto nível não devem depender de módulos de baixo nível (DIP). Se o Excalidraw decidisse migrar para `IndexedDB`, toda a lógica de exportação teria que ser reescrita.
- **Solução proposta/aplicada:** Acesso a dados foi abstraído através de uma Interface. O componente passou a depender da abstração, e não da implementação concreta do navegador.

## Padrões de Projeto Aplicados

### 1. Adapter (Adaptador)

- **Nome:** Adapter.
- **Onde foi aplicado:** Na interface `ISceneDataStorage` e na classe `LocalStorageSceneAdapter` dentro de `ExcalidrawPlusIframeExport.tsx`.
- **Justificativa:** Aplicado para isolar e encapsular a forma como os dados brutos da cena são obtidos. Ao invés do sistema chamar `localStorage` diretamente, ele solicita dados para um "Storage" genérico. O _Adapter_ traduz esse pedido genérico para a API específica do navegador (`localStorage`). Isso facilita a escrita de testes unitários (podemos mockar o adapter) e protege o sistema contra mudanças futuras na forma de persistência.

### 2. Facade (Fachada)

- **Nome:** Facade.
- **Onde foi aplicado:** Na criação da classe `SceneExportFacade` dentro de `ExcalidrawPlusIframeExport.tsx`.
- **Justificativa:** O componente React original lidava diretamente com o _JWT Validator_, com o _LocalStorage_, com o _JSON Parser_ e com requisições ao _LocalData.fileStorage_. O padrão _Facade_ foi aplicado para prover uma interface única e simplificada (`exportSceneData`). O componente React interage apenas com a Fachada, e a Fachada orquestra todos os subsistemas complexos necessários para gerar a carga útil de exportação da cena.
