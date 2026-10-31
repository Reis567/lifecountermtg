# LifeCounter 2.5.1 / 2.5.2
## Notas da atualização · 31/10/2026 · APK code 27

Versão de acabamento. Os próprios prints das notas da 2.5.0 mostravam defeitos visuais: o pódio deixava a mesa vazar por trás e, deitado, empilhava tudo; a linha do tempo cortava o rótulo do fim; o microfone engolia o nome de quem estava no canto; as barras de comandante entravam embaixo do número da vida. Tudo corrigido, com antes e depois.

Versão em PDF com os prints: `docs/release-2.5.1/LifeCounter-2.5.1-notas.pdf` (gerada localmente, fora do git). Página HTML: `docs/release-2.5.1/notes.html`.

---

## 1. Pódio refeito (em pé e deitado)

A tela de vitória tinha fundo translúcido demais: o número do card, a barra "Passar a vez" e as tiras dos eliminados apareciam por trás do troféu e do nome do campeão. Deitado era pior: troféu cortado, faixa "É CAMPEÃO" em cima do título, linha do tempo por cima das colocações, bolinhas fora da tela.

- Fundo opaco com desfoque da mesa, inclusive no modo escandaloso.
- Troféu em ícone sólido (sem emoji). "Vitória!" com acento.
- Deitado, duas colunas: troféu, título e nome à esquerda; linha do tempo e botões à direita.
- Faixa do modo escandaloso no topo e menor em paisagem.
- Botões em bloco próprio, sempre dentro da tela.

| Antes | Depois | Depois (escandaloso) |
|---|---|---|
| ![](docs/release-2.5.1/antes-e01-podio-linha-do-tempo.png) | ![](docs/release-2.5.1/i16-podio-normal-em-pe.png) | ![](docs/release-2.5.1/i06-podio-em-pe.png) |

![](docs/release-2.5.1/antes-e02-podio-paisagem.png)
![](docs/release-2.5.1/i17-podio-normal-paisagem.png)
![](docs/release-2.5.1/i07-podio-paisagem.png)

## 2. Linha do tempo sem cortes

O rótulo da duração ficava embaixo da bolinha do vencedor e as bolinhas de baixo encostavam na borda. A régua ganhou folga em cima e embaixo, e o rótulo do fim escolhe sozinho onde cabe (embaixo, em cima ou no topo) conforme as quedas perto do fim. Vale pro pódio e pro detalhe da partida no Histórico.

| Antes | Depois |
|---|---|
| ![](docs/release-2.5.1/antes-e03-historico-linha-do-tempo.png) | ![](docs/release-2.5.1/i10-historico-linha-do-tempo.png) |

## 3. Microfone não engole mais nomes

Nos cards estreitos (três colunas no celular em pé) o recuo que afastava o conteúdo do recorte do microfone deixava zero pixel pro nome. Agora o recuo é menor, a foto some só no lado do recorte e o nome fica; no rodapé some o botão do meio. O microfone ficou menor em mesas de 5+ (48 px) e o buraco nos cards acompanha o tamanho real.

| Antes | Depois | Com eliminado |
|---|---|---|
| ![](docs/release-2.5.1/antes-h13-mesa-5-microfone-em-pe.png) | ![](docs/release-2.5.1/i01-mesa-5-em-pe.png) | ![](docs/release-2.5.1/i04-eliminado-em-pe.png) |

![](docs/release-2.5.1/i02-mesa-5-paisagem.png)

## 4. Dano de comandante no card, sem sobreposição

- Selo "em risco" saiu: a pílula já mostra o maior dano com anel em 15 e vermelha em 21.
- Barras ficam em cima da pílula, não ao lado.
- Deitado, as barras somem; com 5+, a pílula fica compacta (ícone e número).

![](docs/release-2.5.1/antes-h04-pilula-cmd-com-dano.png)
![](docs/release-2.5.1/i03-paisagem-cmd-sem-barras.png)

## 5. Tira do eliminado em paisagem

Deitado, a tira escondia "por Zé · Combo". Agora aparece na mesma linha do nome.

![](docs/release-2.5.1/antes-b03-eliminado-paisagem.png)
![](docs/release-2.5.1/i05-eliminado-paisagem.png)

## 6. Pequenos acertos

- "Quem começa?" e "Começa:" com cedilha no sorteio.
- Animação do sorteio: "Destaque em sequência" aparecia cortada no seletor; virou "Sequência".
- Botão de tema "Contraste" estava preto sobre preto; ganhou contorno amarelo.
- Modo só vida: o "fantasma" atrás do número no print da 2.5.0 era a animação de troca de tamanho capturada no meio; o print novo está limpo.

| Antes | Depois | Depois |
|---|---|---|
| ![](docs/release-2.5.1/antes-d01-sorteio-justo-config.png) | ![](docs/release-2.5.1/i11-config-animacao.png) | ![](docs/release-2.5.1/i12-config-tema.png) |
| ![](docs/release-2.5.1/antes-d02-sorteio-justo.png) | ![](docs/release-2.5.1/i13-sorteio.png) | ![](docs/release-2.5.1/i14-so-vida-em-pe.png) |

## 7. 2.5.2: Encerrar partida volta pra home

"Encerrar partida" (nas Configurações ou no pódio de vitória) encerrava a mesa mas deixava a tela congelada no jogo. Agora, depois de salvar no ranking ou de "Encerrar sem contar pro ranking", o app volta pra home com os mesmos jogadores já escolhidos. O X do pódio continua mantendo a mesa.

![](docs/release-2.5.1/j01-home-depois-de-encerrar.png)

## 8. Nos bastidores

| Onde | O que mudou |
|---|---|
| Pódio | Overlay reorganizado em `.winner-hero` + linha do tempo + `.winner-actions`; grade de duas colunas em paisagem; fundo 0,985 com desfoque; troféu `#ic-trophy`. |
| Linha do tempo | `matchTimelineHtml`: altura 112, eixo em 60, rótulo da duração com três posições candidatas. |
| Microfone | `syncFabCutRadius` lê o tamanho real do botão; regras de `data-notch` dentro de `@container (max-width: 150px)`. |
| Card | `.cmd-risk` oculto; `.cmd-bars` acima da pílula; em paisagem as barras somem e, com 5+, a pílula fica compacta. |
| Encerrar partida | `finishMatch(onDone, onCancel)`: os botões passam `goHomeAfterMatch` (newGame mantendo o roster + fecha modais); o X chama só `onCancel`. |
| Testes | QA novo (qa12) com 27 verificações, em pé e deitado; suítes anteriores sem regressão; zero erros de JS. |

**Como atualizar.** No Android, o app avisa ao abrir e instala com um toque (ou Configurações › Atualização). No navegador basta recarregar.
