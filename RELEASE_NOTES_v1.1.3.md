# LifeCounterReis v1.1.3
## Notas de Atualização - 07/03/2026

---

## Novidades

### Android APK
- **Versão Android nativa** do LifeCounter disponível como APK
- Funciona offline (sem necessidade de internet para usar)
- Tela sempre ligada durante o jogo
- Modo fullscreen imersivo

### Sistema de Taunts (Provocações)
- **Novo botão de taunt** em cada card de jogador
- **20 emojis** para provocar: 😂🤣💀☠️🔥💪👀🤡😈👑🏳️‍🌈🦄✨💅🙄😤🥵🥶💩🤮
- **30 frases** de provocação: VISH!!!, LACROU!, GG EZ, VIADO!!!, SKILL ISSUE, etc.
- **Taunts customizados** temporários (válidos apenas para a partida atual)
- **Easter Egg LGBT**: usar 🏳️‍🌈, 🦄, ou escrever "viado"/"gay"/"lgbt" toca o **Hino do Fluminense**
- Overlay animado com efeito rainbow para taunts LGBT

---

## Melhorias

### Aleatoriedade Aprimorada
- **Crypto API** para sorteios verdadeiramente aleatórios
- **Rejection sampling** para eliminar viés de módulo
- **Fisher-Yates shuffle** + seleção aleatória (dupla randomização)
- Afeta: Sortear Viado, Sortear Quem Começa, Dados, Moeda, Dado Planar

### Performance Android
- **Hardware acceleration** ativada (GPU em vez de CPU)
- Remoção de software rendering que causava travamentos
- Cache habilitado para carregamento mais rápido
- Logging reduzido (apenas erros)

### Áudio
- **Sons funcionando no Android**: dano.mp3, viado.mp3, fluminense.mp3, monark.mp3
- Easter egg José/Zé: 100% Fluminense quando sorteado
- Easter egg Monark: 50% chance de "Acorda cara!" ao virar Monarca

---

## Correções

- Busca de imagens/GIFs agora funciona no Android (permissão de internet)
- Módulos ES6 convertidos para bundle.js (compatibilidade WebView)
- Google Fonts removido do Android (performance offline)

---

## Arquivos do APK

| Arquivo | Descrição |
|---------|-----------|
| `LifeCounter-v4-fix.apk` | Versão final com todas as correções |

---

## Requisitos Android

- Android 5.0+ (API 21)
- ~5MB de espaço
- Permissões: Internet (para busca de imagens)

---

## Desenvolvedores

- **Matheus Reis** - Criador
- **Claude Opus 4.5** - Co-Authored

---

*LifeCounterReis - O melhor contador de vida para Magic: The Gathering Commander/EDH*
