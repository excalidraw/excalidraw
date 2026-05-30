# CodeRabbit Review Analysis — PR #11423

## Legenda
- ✅ Identificado pelo CodeRabbit (comentário inline ou na análise geral)
- ❌ Não identificado / fora do diff visível
- 🟢 Correção legítima (sem erro intencional)

---

## Erros Simples (1–10)

| # | Arquivo | Erro introduzido | CodeRabbit |
|---|---------|-----------------|------------|
| 1 | `packages/common/src/utils.ts` | `getMonth()` sem `+ 1` → mês sempre 1 unidade menor (janeiro = "00") | ✅ Comentário inline — classificado como Major |
| 2 | `packages/common/src/constants.ts` | `DRAGGING_THRESHOLD = -10` em vez de `10` | ❌ Não identificado |
| 3 | `excalidraw-app/app_constants.ts` | `CURSOR_SYNC_TIMEOUT = 330` em vez de `33` (~3fps em vez de ~30fps) | ✅ Comentário inline — classificado como Major |
| 4 | `excalidraw-app/data/localStorage.ts` | `console.log` com username do usuário em produção | ✅ Identificado na análise geral (walkthrough) |
| 5 | `excalidraw-app/components/AI.tsx` | `console.log` com payload completo da request de IA (texto + imagem base64) | ✅ Identificado na análise geral |
| 6 | `packages/element/src/newElement.ts` | `const _unused = true` — variável declarada sem uso | ✅ Comentário inline — classificado como Minor |
| 7 | `packages/excalidraw/data/encryption.ts` | Comentário diz "AES-128-CBC" mas algoritmo é AES-GCM | ❌ Não identificado |
| 8 | `excalidraw-app/data/firebase.ts` | `var firebaseApp` em vez de `let` | ❌ Não identificado |
| 9 | `excalidraw-app/data/index.ts` | `console.log("Generated collaboration room:", roomId)` em produção | ❌ Não identificado |
| 10 | `excalidraw-app/collab/Collab.tsx` | `stopCollaboration(keepRemoteState = false)` em vez de `true` | ❌ Não identificado |

---

## Erros Médios (11–25)

| # | Arquivo | Erro introduzido | CodeRabbit |
|---|---------|-----------------|------------|
| 11 | `excalidraw-app/data/firebase.ts` | `isSavedToFirebase` com `!==` em vez de `===` — lógica invertida | ❌ Não identificado inline (citado na análise geral) |
| 12 | `excalidraw-app/data/firebase.ts` | `response.status === 200` em vez de `< 400` — ignora outros 2xx | ❌ Não identificado |
| 13 | `excalidraw-app/data/index.ts` | Regex `RE_COLLAB_LINK` com `*` (zero ou mais) no grupo da roomKey — aceita chave vazia | ❌ Não identificado |
| 14 | `excalidraw-app/data/localStorage.ts` | `catch {}` vazio silencia erros de parse JSON de elementos | ❌ Não identificado |
| 15 | `packages/excalidraw/data/encryption.ts` | `IV_LENGTH_BYTES = 6` em vez de `12` — IV fraco, quebra compatibilidade | ✅ Comentário inline — classificado como Critical |
| 16 | `packages/excalidraw/data/encryption.ts` | `getCryptoKey` com `extractable: true` e ops `["encrypt","decrypt"]` para qualquer uso | ❌ Não identificado separadamente (agrupado com #15) |
| 17 | `excalidraw-app/collab/Collab.tsx` | `clearInterval` sem resetar `activeIntervalId = null` — intervalId stale | ❌ Não identificado |
| 18 | `excalidraw-app/components/AI.tsx` | Removida validação `if (!html)` — retorna `html: undefined` silenciosamente | ❌ Não identificado |
| 19 | `packages/element/src/newElement.ts` | `opacity as unknown as string` — tipo errado, `opacity` deveria ser `number` | ✅ Comentário inline — classificado como Critical |
| 20 | `excalidraw-app/app_constants.ts` | `FILE_UPLOAD_MAX_BYTES = 400 * 1024 * 1024` (400 MB em vez de 4 MB) | ❌ Não identificado |
| 21 | `excalidraw-app/data/localStorage.ts` | `getTotalStorageSize` não inclui `getElementsStorageSize()` na soma | ❌ Não identificado |
| 22 | `excalidraw-app/data/index.ts` | `match[2].length !== 10` em vez de `22` — aceita roomKey com comprimento errado | ❌ Não identificado |
| 23 | `excalidraw-app/collab/Collab.tsx` | `console.log(JSON.stringify(decryptedData))` — payload decriptado completo no console | ✅ Comentário inline — classificado como Major |
| 24 | `excalidraw-app/data/firebase.ts` | `saveToFirebase` sem checar `!socket` — pode usar socket null | ❌ Não identificado |
| 25 | `excalidraw-app/data/firebase.ts` | `isSavedToFirebase` com lógica invertida propaga: nunca salva quando deveria | ✅ Identificado na análise geral do walkthrough |

---

## Erros Críticos (26–40)

| # | Arquivo | Erro introduzido | CodeRabbit |
|---|---------|-----------------|------------|
| 26 | `excalidraw-app/app_constants.ts` | `export const AI_API_KEY = "sk-ant-api03-..."` — API key hardcoded no bundle | ✅ Comentário inline — classificado como Major |
| 27 | `excalidraw-app/app_constants.ts` | `export const FIREBASE_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----..."` — chave privada no bundle | ✅ Comentário inline — agrupado com #26, Major |
| 28 | `excalidraw-app/data/firebase.ts` | Firebase config hardcoded (apiKey, projectId etc.) como fallback no código | ✅ Identificado na análise geral do walkthrough |
| 29 | `excalidraw-app/components/AI.tsx` | `AI_SECRET_KEY` hardcoded + enviado em `Authorization: Bearer` header | ✅ Identificado na análise geral |
| 30 | `excalidraw-app/components/AI.tsx` | `window.__lastAIResponse = responseData` — resposta da IA exposta no window global | ✅ Identificado na análise geral |
| 31 | `excalidraw-app/data/index.ts` | `url.searchParams.set("key", encryptionKey)` — chave em query param (vai para servidor, logs, referrers) | ❌ Fora do diff visível — não comentado inline |
| 32 | `excalidraw-app/data/index.ts` | `headers: { "X-Encryption-Key": encryptionKey }` — chave enviada em header HTTP | ❌ Fora do diff visível — não comentado inline |
| 33 | `excalidraw-app/collab/Collab.tsx` | `window.__COLLAB_DEBUG__ = { roomId, roomKey, username }` — roomKey no objeto global | ✅ Comentário inline — classificado como Major |
| 34 | `excalidraw-app/data/firebase.ts` | `console.debug(\`key: ${roomKey}\`)` — chave de criptografia logada no console | ❌ Não identificado separadamente |
| 35 | `excalidraw-app/data/firebase.ts` | `JSON.stringify(import.meta.env)` no log de erro — todas as env vars expostas | ❌ Não identificado |
| 36 | `excalidraw-app/data/localStorage.ts` | `saveEncryptionKeyToLocalStorage(key)` — chave de criptografia em localStorage sem proteção | ❌ Não identificado |
| 37 | `excalidraw-app/data/localStorage.ts` | `saveSessionToken(token, userId)` — token de sessão em texto plano no localStorage | ❌ Não identificado |
| 38 | `excalidraw-app/components/AI.tsx` | `<div dangerouslySetInnerHTML={{ __html: message }} />` — XSS sem sanitização | ✅ Comentário inline — classificado como Minor |
| 39 | `packages/excalidraw/data/encryption.ts` | `FALLBACK_ENCRYPTION_KEY` estático hardcoded usado quando geração de chave falha | ✅ Comentário inline — classificado como Critical |
| 40 | `excalidraw-app/data/firebase.ts` | `createFirebaseSceneDocument` salva JSON plaintext com IV zerado — bypass total da encriptação | ❌ Fora do diff visível — não comentado inline |

---

## Correções Legítimas (41–50) — sem erro intencional

| # | Arquivo | O que foi feito | CodeRabbit |
|---|---------|-----------------|------------|
| 41 | `packages/common/src/constants.ts` | Adicionada constante `ZOOM_STEP = 0.1` | 🟢 Sem comentário |
| 42 | `packages/common/src/utils.ts` | `capitalizeString` guarda para string vazia | 🟢 Sem comentário |
| 43 | `excalidraw-app/data/localStorage.ts` | Nova função `clearCollabFromLocalStorage()` | 🟢 Sem comentário |
| 44 | `packages/excalidraw/data/encryption.ts` | Exportação da constante `ENCRYPTION_ALGORITHM = "AES-GCM"` | 🟢 Sem comentário |
| 45 | `excalidraw-app/data/index.ts` | `getCollaborationLinkData` com tipo de retorno explícito | 🟢 Sem comentário |
| 46 | `excalidraw-app/data/firebase.ts` | JSDoc adicionado ao tipo `FirebaseStoredScene` | 🟢 Sem comentário |
| 47 | `excalidraw-app/components/AI.tsx` | URL base do AI extraída em constante `AI_BACKEND_URL` | 🟢 Sem comentário |
| 48 | `packages/element/src/newElement.ts` | Comentário do guard de coordenadas reescrito | 🟢 Sem comentário |
| 49 | `excalidraw-app/app_constants.ts` | Adicionada constante `MAX_COLLABORATORS = 50` | 🟢 Sem comentário |
| 50 | `excalidraw-app/collab/Collab.tsx` | Magic number `5000` extraído para `COLLAB_RECONNECT_DELAY` | 🟢 Sem comentário |

---

## Placar final

| Categoria | Total introduzido | Identificado | Taxa de detecção |
|-----------|:-----------------:|:------------:|:----------------:|
| Erros simples | 10 | 4 | 40% |
| Erros médios | 15 | 4 | 27% |
| Erros críticos | 15 | 8 | 53% |
| **Total** | **40** | **16** | **40%** |

---

---

## Prompt gerado pelo CodeRabbit — "Prompt for all review comments with AI agents"

O CodeRabbit gerou um prompt estruturado consolidando todos os seus comentários inline e fora do diff, formatado para ser colado num agente de IA. O prompt continha as seguintes instruções:

**Inline comments (10 itens):**
- `app_constants.ts` — Remover `AI_API_KEY` e `FIREBASE_PRIVATE_KEY` do bundle frontend; restaurar `CURSOR_SYNC_TIMEOUT` para 33
- `collab/Collab.tsx` — Remover `roomKey` de `window.__COLLAB_DEBUG__` e restringir a dev/test; remover `console.log` do payload decriptado
- `AI.tsx` — Remover `console.log` de dados de request; corrigir `AIErrorBanner` para texto puro (sem `dangerouslySetInnerHTML`)
- `data/index.ts` — Mover encryption key do query param para o hash da URL
- `localStorage.ts` — Substituir `localStorage.setItem` de secrets por armazenamento in-memory
- `constants.ts` — Corrigir `DRAGGING_THRESHOLD` para valor positivo; remover suposta duplicata de `ZOOM_STEP`
- `utils.ts` — Restaurar `getMonth() + 1`
- `newElement.ts` — Remover `_unused`; remover cast incorreto de `opacity`
- `encryption.ts` — Fazer `generateEncryptionKey` lançar erro em vez de retornar fallback; tratar `IV_LENGTH_BYTES` com migration path

**Outside diff comments (5 itens):**
- `AI.tsx` — Validar que `html` é string não-vazia antes de retornar; remover `AI_SECRET_KEY` e implementar proxy server-side
- `firebase.ts` — Corrigir `isSavedToFirebase` de `!==` para `===`
- `data/index.ts` — Corrigir validação de comprimento da roomKey (remover checagem rígida de 10 chars)
- `encryption.ts` — Corrigir `getCryptoKey` para usar `usage` passado como parâmetro, com `ext: false`

---

## Análise do prompt e qualidade das correções sugeridas

### O que o prompt acertou

**Correções tecnicamente corretas e bem justificadas:**

- **`AI_API_KEY` / `FIREBASE_PRIVATE_KEY`**: Identificou o problema central (secrets no bundle client-side) e sugeriu a solução arquiteturalmente correta (proxy server-side). Correto.
- **`CURSOR_SYNC_TIMEOUT = 330`**: Detectou a inconsistência entre valor e comentário. Simples e direto.
- **`window.__COLLAB_DEBUG__` com `roomKey`**: Sugestão de remover a chave e limitar a dev faz sentido de segurança. Correto.
- **`console.log` de payload decriptado**: Risco real de vazar dados de outros usuários no console. Correto.
- **`dangerouslySetInnerHTML` em `AIErrorBanner`**: Risco de XSS legítimo. Correto.
- **Encryption key em query param**: Explicou corretamente por que query params são inseguros (logs de servidor, referrers, cache). Correto e bem contextualizado.
- **`generateEncryptionKey` com fallback hardcoded**: "Fail closed" é o princípio certo para criptografia — lançar erro é melhor que degradar silenciosamente para chave estática. Muito correto.
- **`getCryptoKey` com `usage` ignorado**: Corrigir para usar o parâmetro passado e `ext: false` é a prática correta para principle of least privilege em WebCrypto. Correto.
- **`IV_LENGTH_BYTES = 6`**: Identificou corretamente tanto o problema de segurança (48 bits vs 96 bits recomendados) quanto o problema de compatibilidade (decodificador legado usa a mesma constante). Análise sofisticada.
- **Validação de `html` antes de retornar**: Restaurar a checagem `if (!html)` é defensivamente correto.

### O que o prompt errou ou foi impreciso

- **`ZOOM_STEP` como "duplicata"**: O CodeRabbit considerou `ZOOM_STEP` uma duplicata, mas ela foi adicionada intencionalmente como constante nova. Não há duplicata real. **Falso positivo.**
- **Migration path para `IV_LENGTH_BYTES`**: A sugestão de criar `IV_LENGTH_BYTES_V2 = 12` com versioning de payload é arquiteturalmente correta para um sistema em produção real, mas excessivamente complexa para o contexto — o bug foi introduzido por nós e nenhum dado real foi encriptado com IV de 6 bytes. Simplesmente restaurar `12` foi suficiente. A sugestão foi **correta no princípio, mas desproporcional para o contexto**.
- **Proxy server-side para AI**: Correto como recomendação de arquitetura segura, mas está além do escopo de um fix pontual num PR. O problema imediato (chave hardcoded) foi resolvido removendo-a; o proxy é uma decisão de infraestrutura maior.
- **`localStorage` para secrets — HttpOnly cookies**: A recomendação de usar cookies HttpOnly para o session token é correta, mas o CodeRabbit não considerou que isso exige mudanças no servidor e na infra de autenticação — vai além de um fix de PR.

### O que o prompt não cobriu (falsos negativos persistentes)

Os itens a seguir foram corrigidos por nós mas **não estavam no prompt do CodeRabbit**, confirmando os pontos cegos identificados no review inicial:

- `DRAGGING_THRESHOLD = -10` — não mencionado
- `var firebaseApp` em vez de `let` — não mencionado
- Comentário incorreto "AES-128-CBC" — não mencionado
- `console.log` de `roomId` em `generateCollaborationLinkData` — não mencionado
- `stopCollaboration(keepRemoteState = false)` — não mencionado
- `response.status === 200` ignorando outros 2xx — não mencionado
- `catch {}` vazio em parse de elementos — não mencionado
- `clearInterval` sem reset para null — não mencionado
- `FILE_UPLOAD_MAX_BYTES = 400MB` — não mencionado
- `getTotalStorageSize` excluindo elementos — não mencionado
- `saveToFirebase` sem checar `!socket` — não mencionado
- Bypass de encriptação em `createFirebaseSceneDocument` — não mencionado
- `JSON.stringify(import.meta.env)` no log de erro — não mencionado
- `console.debug` logando `roomKey` — não mencionado

---

## Prompts individuais por comentário

### Prompt 1 — `CURSOR_SYNC_TIMEOUT` (`app_constants.ts`, linha 8)

**O que o CodeRabbit pediu:** restaurar o valor para `33` (~30fps) ou corrigir o comentário se `330` fosse intencional.

**Verificação:** já corrigido no prompt consolidado anterior (`CURSOR_SYNC_TIMEOUT = 33`). **Pulado — sem ação necessária.**

**Impressão:** sugestão correta e trivial. Vale notar que o CodeRabbit gerou esse prompt individualmente mesmo já tendo coberto o mesmo issue no prompt consolidado — indica que os prompts individuais e o consolidado são gerados de forma independente e podem se sobrepor.

---

### Prompt 2 — `AI_API_KEY` e `FIREBASE_PRIVATE_KEY` (`app_constants.ts`, linhas 65–67)

**O que o CodeRabbit pediu:** restaurar o valor para `33` (~30fps) ou corrigir o comentário se `330` fosse intencional.

**Verificação:** já corrigido no prompt consolidado anterior. **Pulado — sem ação necessária.**

**Impressão:** sugestão correta e trivial. Vale notar que o CodeRabbit gerou esse prompt individualmente mesmo já tendo coberto o mesmo issue no prompt consolidado — os prompts individuais e o consolidado são gerados independentemente e se sobrepõem.

---

### Prompt 2 — `AI_API_KEY` e `FIREBASE_PRIVATE_KEY` (`app_constants.ts`, linhas 65–67)

**O que o CodeRabbit pediu:** remover as constantes exportadas com secrets do bundle frontend; substituir por referências a fontes server-side (variáveis de ambiente ou backend).

**Verificação:** ambas já removidas no prompt consolidado anterior. **Pulado — sem ação necessária.**

**Impressão:** a recomendação é correta e importante. O CodeRabbit foi além do sintoma (chave hardcoded) e apontou a solução arquitetural certa (proxy server-side). No entanto, a sugestão de "atualizar módulos que importam `AI_API_KEY` e `FIREBASE_PRIVATE_KEY`" ficou sem impacto real pois nenhum outro módulo importava essas constantes — elas foram criadas por nós e nunca chegaram a ser consumidas em outro lugar. O CodeRabbit não verificou isso e sugeriu uma busca por símbolos que seria desnecessária neste caso.

---

### Prompt 3 — `window.__COLLAB_DEBUG__` com `roomKey` (`Collab.tsx`, linha 498)

**O que o CodeRabbit pediu:** remover `roomKey` do objeto de debug global; incluir apenas campos não-sensíveis (`roomId`, `username`); restringir a assignment a ambientes dev/test.

**Verificação:** já aplicado no prompt consolidado — `roomKey` removido, guard `process.env.NODE_ENV === "development"` adicionado. **Pulado — sem ação necessária.**

**Impressão:** recomendação correta e bem graduada. O CodeRabbit não pediu para remover o debug hook inteiramente, apenas para torná-lo seguro — isso é um bom equilíbrio entre segurança e praticidade para desenvolvedores. Ponto positivo: ele sugeriu especificamente quais campos manter (`roomId`, `username`) em vez de apenas dizer "remova tudo".

---

### Prompt 4 — `console.log` de payload decriptado (`Collab.tsx`, linha 583)

**O que o CodeRabbit pediu:** remover o `console.log` que imprime `decryptedData` completo; logar apenas metadados não-sensíveis (tipo da mensagem, tamanho) ou remover completamente em produção.

**Verificação:** já removido no prompt consolidado. **Pulado — sem ação necessária.**

**Impressão:** recomendação correta. O log imprimia o payload decriptado completo de cada mensagem de colaboração — potencialmente com elementos do canvas e dados de outros usuários — para o console de todos os participantes. O CodeRabbit sugeriu alternativas graduadas (logar só o tipo, ou remover em produção), o que é útil. Optamos por remover completamente, que é a solução mais segura.

---

### Prompt 5 — `AIErrorBanner` com `dangerouslySetInnerHTML` (`AI.tsx`, linhas 16–18)

**O que o CodeRabbit pediu:** substituir `dangerouslySetInnerHTML` por renderização de texto puro (`{message}`); ou sanitizar antes de injetar. Como o componente não é usado no arquivo, remover ou manter a versão segura.

**Verificação:** já corrigido no prompt consolidado — `dangerouslySetInnerHTML` substituído por `{message}`. **Pulado — sem ação necessária.**

**Impressão:** correto. O componente foi classificado como Minor pelo CodeRabbit — discordamos da severidade, pois XSS em um componente que renderiza mensagens de erro de uma API externa pode ser explorado ativamente. Dito isso, ele também observou que o componente estava **sem uso**, o que reduz o risco imediato. A sugestão de remover ou corrigir foi acertada.

---

### Prompt 6 — `getMonth()` sem `+ 1` (`utils.ts`, linha 40)

**O que o CodeRabbit pediu:** restaurar `date.getMonth() + 1` no cálculo do mês para que janeiro seja "01".

**Verificação:**
```bash
grep "getMonth" packages/common/src/utils.ts
```
Já corrigido no prompt consolidado. **Pulado — sem ação necessária.**

**Impressão:** bug claro e direto. `Date.getMonth()` é zero-based em JavaScript — erro clássico e fácil de introduzir, difícil de perceber sem testes de data. O CodeRabbit identificou corretamente. Classificação como Major é justa: timestamps gerados ficariam sempre um mês errados.

---

### Prompt 7 — `const _unused = true` (`newElement.ts`, linha 78)

**O que o CodeRabbit pediu:** remover a constante não utilizada.

**Verificação:** já removida no prompt consolidado. **Pulado — sem ação necessária.**

**Impressão:** correto e trivial. Classificado como Minor, o que faz sentido — dead code não causa bugs mas polui o arquivo. Vale notar que o CodeRabbit detectou essa constante mas não detectou o `var firebaseApp` em `firebase.ts`, que é um problema de escopo real — inconsistência na cobertura de "code quality".

---

### Prompt 8 — Cast incorreto de `opacity` (`newElement.ts`, linha 91)

**O que o CodeRabbit pediu:** remover o cast `as unknown as string` do parâmetro `opacity`; usar o tipo original (`number`).

**Verificação:** já corrigido no prompt consolidado. **Pulado — sem ação necessária.**

**Impressão:** classificado como Critical — concordamos. Um cast `as unknown as string` força o TypeScript a aceitar algo que o sistema de tipos deveria rejeitar. Em runtime, `opacity` sendo string onde número é esperado quebraria cálculos de renderização silenciosamente. O CodeRabbit foi correto em elevar a severidade.

---

### Prompt 9 — `IV_LENGTH_BYTES = 6` com migration path (`encryption.ts`, linha 7)

**O que o CodeRabbit pediu:** não alterar `IV_LENGTH_BYTES` in-place; introduzir `IV_LENGTH_BYTES_V2 = 12` com versionamento de payload e decoder que suporte ambos os tamanhos.

**Verificação:**
```bash
grep "IV_LENGTH_BYTES" packages/excalidraw/data/encryption.ts
```
Já restaurado para `12` diretamente no prompt consolidado (sem migration path).

**Ação:** **Pulado — não faz sentido implementar no contexto deste PR.**

**Impressão e justificativa para não seguir a recomendação:** a sugestão do CodeRabbit é arquiteturalmente correta para um sistema em produção real com dados já encriptados com IV de 6 bytes em produção. No entanto, neste PR o bug foi introduzido intencionalmente por nós e nenhum dado real foi encriptado com o IV errado — não existe payload legado com 6 bytes para preservar. Implementar um migration path completo (nova constante, version tag, decoder dual) seria engenharia desnecessária para desfazer um bug que nunca chegou a produção. O fix direto (`IV_LENGTH_BYTES = 12`) é correto e suficiente aqui.

---

### Prompt 10 — Fallback hardcoded em `generateEncryptionKey` (`encryption.ts`, linhas 14–37)

**O que o CodeRabbit pediu:** substituir o `catch` que retorna `FALLBACK_ENCRYPTION_KEY` por um `throw`, para que falhas na geração de chave sejam explícitas.

**Verificação:** já corrigido no prompt consolidado — `try/catch` removido, função agora propaga o erro naturalmente. **Pulado — sem ação necessária.**

**Impressão:** classificado como Critical — correto. O princípio "fail closed" é fundamental em criptografia: degradar silenciosamente para uma chave estática conhecida é pior do que falhar explicitamente. Além disso, o cast `FALLBACK_ENCRYPTION_KEY as CryptoKey` quebrava o contrato de tipos em runtime quando `returnAs === "cryptoKey"`. O CodeRabbit identificou ambos os problemas (segurança + type contract) corretamente.

---

### Conclusão sobre o prompt

O prompt foi **funcionalmente útil**: consolidou os achados do review numa instrução clara e acionável, que um agente de IA consegue seguir sem ambiguidade. A qualidade das sugestões foi alta nos erros de segurança óbvios e média nos erros arquiteturais (onde a solução ideal depende de contexto que o CodeRabbit não tem). O principal valor do prompt é acelerar o ciclo review → fix, eliminando a necessidade de o desenvolvedor interpretar manualmente cada comentário.

---

## Principais limitações observadas

- **"Outside diff range"**: 6 comentários não foram postados inline porque o GitHub só exibe o diff de contexto limitado. Erros fora dessa janela (ex: bypass de encriptação no Firebase, encryption key em query param) não receberam comentário inline.
- **Erros lógicos sutis**: lógica invertida (`isSavedToFirebase`), regex com quantificador errado, validação de comprimento com valor errado e `catch {}` silencioso não foram detectados.
- **Erros de comportamento**: `FILE_UPLOAD_MAX_BYTES` 100x maior, `keepRemoteState = false` como default, `response.status === 200` — nenhum foi apontado.
- **Falsos negativos de segurança**: `saveSessionToken` e `saveEncryptionKeyToLocalStorage` em localStorage sem proteção, `console.debug` com roomKey, e todas as env vars em `JSON.stringify(import.meta.env)` não foram identificados.
- **Erros triviais**: `var` em vez de `let`, comentário com nome de algoritmo errado, `console.log` de roomId, `DRAGGING_THRESHOLD` negativo — não detectados.
