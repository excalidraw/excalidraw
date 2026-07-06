## DevOps e CI/CD

### Análise da Pipeline Existente

O projeto utiliza **GitHub Actions** como ferramenta principal de CI/CD. A arquitetura da esteira é distribuída em múltiplos _workflows_ (arquivos `.yml`), isolando responsabilidades como:

- Execução de testes automatizados e cobertura (`test.yml`, `test-coverage-pr.yml`).
- Análise estática de código e formatação (`lint.yml`).
- Construção e publicação de imagens de contêiner (`build-docker.yml`, `publish-docker.yml`).
- Rotinas de _release_ e controle de semântica de commits (`autorelease-excalidraw.yml`, `semantic-pr-title.yml`).

Apesar de ser uma pipeline robusta, a análise técnica identificou um gargalo de performance nos _workflows_ de validação contínua (acionados em cada _Pull Request_ e _Push_). As rotinas de instalação de dependências (`yarn install`) estão sendo executadas de forma "fria" (sem reaproveitamento de dados prévios).

### Proposta de Melhoria: Implementação de Cache de Dependências

A melhoria proposta consiste em implementar o **Cache de Dependências do Gerenciador de Pacotes (Yarn)** nas _Actions_ de setup.

Ao ativar o cache, a pipeline armazena a pasta global de cache do Yarn após a primeira execução bem-sucedida. Nas execuções subsequentes, em vez de baixar todos os pacotes da internet (milhares de arquivos em `node_modules`), o GitHub Actions restaura o cache a partir do arquivo de trava (`yarn.lock`).

**Justificativa/Benefícios:**

- **Redução no Tempo de Build:** Workflows de validação rodarão significativamente mais rápido, agilizando o _feedback loop_ para os desenvolvedores.
- **Economia de Recursos:** Reduz o consumo de banda e minutos de computação no GitHub Actions.
- **Resiliência:** Em caso de instabilidade pontual no registro do npm/Yarn, a pipeline ainda pode ser concluída com sucesso usando os pacotes em cache.

### Implementação da Melhoria

Abaixo, os arquivos `.github/workflows/test.yml`, `.github/workflows/lint.yml` e `.github/workflows/test-coverage-pr.yml` foram refatorados para incluir a diretiva `cache: 'yarn'` nativa do `actions/setup-node`.

**Arquivo modificado:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: master

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20.x
          # MELHORIA DE CI/CD: Ativação do cache global para o Yarn
          # Evita o download repetitivo das dependências a cada push
          cache: "yarn"

      - name: Install and test
        run: |
          yarn install --frozen-lockfile
          yarn test:app
```

**Arquivo modificado:** `.github/workflows/lint.yml`

```yaml
name: Lint

on: pull_request

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20.x
          # MELHORIA DE CI/CD: Ativação do cache global para o Yarn
          # Evita o download repetitivo das dependências a cada push
          cache: "yarn"

      - name: Install and lint
        run: |
          yarn install
          yarn test:other
          yarn test:code
          yarn test:typecheck
```

**Arquivo modificado:** `.github/workflows/test-coverage-pr.yml`

```yaml
name: Test Coverage PR
on:
  pull_request:

jobs:
  coverage:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: "Install Node"
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: "20.x"
          # MELHORIA DE CI/CD: Ativação do cache global para o Yarn
          # Evita o download repetitivo das dependências a cada push
          cache: "yarn"
      - name: "Install Deps"
        run: yarn install
      - name: "Test Coverage"
        run: yarn test:coverage
      - name: "Report Coverage"
        if: always() # Also generate the report if tests are failing
        uses: davelosert/vitest-coverage-report-action@2500dafcee7dd64f85ab689c0b83798a8359770e # v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```
