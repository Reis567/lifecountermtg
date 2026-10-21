// ===== Mecânicas de mesa: Dia/Noite, Planechase e Archenemy =====
// Tudo fica em GameState.mechanics (persistido e desfeito junto com a partida)
// e cada mudança vira evento no log (day_night / plane / scheme).
import { gameState } from './state.js';
import { secureRandomInt } from './state.js';
import { escapeHtml } from './profiles.js';
export const PLANES = [
    { id: 'academy', name: 'Academy at Tolaria West', type: 'plane', world: 'Dominaria', text: 'No fim do turno, se você não tem cards na mão, compra 7.', chaos: 'Descarte a mão.' },
    { id: 'agyrem', name: 'Agyrem', type: 'plane', world: 'Ravnica', text: 'Criaturas brancas que morrem voltam ao campo no próximo fim de turno.', chaos: 'Criaturas não podem atacar você até o seu próximo turno.' },
    { id: 'akoum', name: 'Akoum', type: 'plane', world: 'Zendikar', text: 'Você pode conjurar encantamentos como se tivessem lampejo.', chaos: 'Destrua a criatura alvo que não está encantada.' },
    { id: 'aretopolis', name: 'Aretopolis', type: 'plane', world: 'Kephalai', text: 'Ao planeswalkar aqui ou no começo da sua manutenção, ponha um contador de scroll e ganhe 1 de vida. Com 10 contadores, planeswalk.', chaos: 'Ponha um contador de scroll e compra cards igual ao número de contadores.' },
    { id: 'astral', name: 'Astral Arena', type: 'plane', world: 'Kolbahan', text: 'Não mais que uma criatura pode atacar e uma bloquear por combate.', chaos: 'Causa 2 de dano a cada criatura.' },
    { id: 'bant', name: 'Bant', type: 'plane', world: 'Alara', text: 'Criaturas com contadores +1/+1 têm exaltar.', chaos: 'Ponha um contador de divindade na criatura alvo (indestrutível).' },
    { id: 'bloodhill', name: 'Bloodhill Bastion', type: 'plane', world: 'Equilor', text: 'Criaturas que entram ganham golpe duplo e ímpeto até o fim do turno.', chaos: 'Exile a criatura alvo que você controla e a devolva ao campo.' },
    { id: 'edge', name: 'Edge of Malacol', type: 'plane', world: 'Belenon', text: 'Se uma criatura que você controla desvirar na sua manutenção, ponha dois contadores +1/+1 nela.', chaos: 'Desvire cada criatura que você controla.' },
    { id: 'feeding', name: 'Feeding Grounds', type: 'plane', world: 'Muraganda', text: 'Mágicas vermelhas e verdes custam {1} a menos.', chaos: 'Ponha X contadores +1/+1 na criatura alvo.' },
    { id: 'fields', name: 'Fields of Summer', type: 'plane', world: 'Moag', text: 'Sempre que um jogador conjura uma mágica, ele ganha 2 de vida.', chaos: 'Você ganha 10 de vida.' },
    { id: 'furnace', name: 'Furnace Layer', type: 'plane', world: 'New Phyrexia', text: 'Quando planeswalkar aqui ou na manutenção, escolha um jogador aleatório: ele perde 3 de vida.', chaos: 'O jogador alvo descarta a mão.' },
    { id: 'glimmervoid', name: 'Glimmervoid Basin', type: 'plane', world: 'Mirrodin', text: 'Sempre que um jogador conjura instantâneo ou feitiço, ele copia para cada outro jogador e pode escolher novos alvos.', chaos: 'Ponha uma ficha que é cópia da criatura alvo (até o fim do turno).' },
    { id: 'grand', name: 'Grand Ossuary', type: 'plane', world: 'Ravnica', text: 'Criaturas não podem ser destruídas; em vez disso, ganham -1/-1 permanente... (resumo)', chaos: 'Cada jogador sacrifica criaturas e distribui contadores +1/+1.' },
    { id: 'grixis', name: 'Grixis', type: 'plane', world: 'Alara', text: 'Cards de criatura preta no cemitério têm desenterrar {2}{B}.', chaos: 'Devolva a criatura alvo do cemitério para o campo.' },
    { id: 'hedron', name: 'Hedron Fields of Agadeem', type: 'plane', world: 'Zendikar', text: 'Criaturas com poder 7+ não podem atacar nem bloquear.', chaos: 'Crie uma ficha Eldrazi 7/7 incolor.' },
    { id: 'isle', name: 'Isle of Vesuva', type: 'plane', world: 'Dominaria', text: 'Sempre que uma criatura entra, seu controlador cria uma cópia dela.', chaos: 'Destrua cada criatura com o mesmo nome de outra.' },
    { id: 'jund', name: 'Jund', type: 'plane', world: 'Alara', text: 'Sempre que um jogador conjura uma mágica preta, vermelha ou verde, ele pode devorar... (cria um Dragão 5/5?) — resumo: Mágicas BRG dão fichas.', chaos: 'Crie uma ficha Dragão 5/5 vermelha com voar.' },
    { id: 'kessig', name: 'Kessig', type: 'plane', world: 'Innistrad', text: 'Criaturas têm ímpeto e atacam a cada combate se puderem.', chaos: 'Destrua todos os não-Lobos.' },
    { id: 'krosa', name: 'Krosa', type: 'plane', world: 'Dominaria', text: 'Criaturas recebem +2/+2.', chaos: 'Você pode colocar um terreno da mão no campo.' },
    { id: 'lair', name: 'Lair of the Ashen Idol', type: 'plane', world: 'Azgol', text: 'No começo da sua manutenção, sacrifique uma criatura; se não puder, planeswalk.', chaos: 'Qualquer número de jogadores alvo criam fichas Pesadelo 2/2.' },
    { id: 'llanowar', name: 'Llanowar', type: 'plane', world: 'Dominaria', text: 'Terrenos virados produzem mana adicional (T: adicione 2).', chaos: 'Desvire todos os terrenos que você controla.' },
    { id: 'minamo', name: 'Minamo', type: 'plane', world: 'Kamigawa', text: 'Sempre que um jogador compra, ele pode trocar por um card da mão (resumo).', chaos: 'Compre um card para cada... (resumo: compre 2).' },
    { id: 'mountroof', name: 'Mount Keralia', type: 'plane', world: 'Regatha', text: 'No fim de cada turno, ponha um contador de pressão; quando planeswalkar, causa dano igual aos contadores a cada criatura.', chaos: 'Impeça todo o dano que seria causado a você neste turno.' },
    { id: 'naya', name: 'Naya', type: 'plane', world: 'Alara', text: 'Você pode jogar terrenos adicionais a cada turno.', chaos: 'A criatura alvo recebe +X/+X (X = terrenos).' },
    { id: 'orzhova', name: 'Orzhova', type: 'plane', world: 'Ravnica', text: 'Sempre que uma criatura morre, seu controlador ganha 1 de vida.', chaos: 'Você ganha 7 de vida.' },
    { id: 'panopticon', name: 'Panopticon', type: 'plane', world: 'Mirrodin', text: 'Ao planeswalkar aqui ou na manutenção, compre um card.', chaos: 'Compre um card.' },
    { id: 'raven', name: 'Raven\'s Run', type: 'plane', world: 'Shadowmoor', text: 'Criaturas recebem -1/-1 (resumo: atrofiar).', chaos: 'Ponha um contador -1/-1 em cada criatura.' },
    { id: 'sea', name: 'Sea of Sand', type: 'plane', world: 'Rabiah', text: 'Jogadores revelam cada card que compram; não-terrenos comprados são postos no topo (resumo).', chaos: 'A criatura alvo... (resumo: perde todas as habilidades).' },
    { id: 'shiv', name: 'Shiv', type: 'plane', world: 'Dominaria', text: 'Criaturas vermelhas recebem +1/+1 e ímpeto (resumo).', chaos: 'Causa 3 de dano ao alvo (criatura ou jogador).' },
    { id: 'stronghold', name: 'Stronghold Furnace', type: 'plane', world: 'Rath', text: 'Dano a criaturas e jogadores é dobrado.', chaos: 'Causa 2 de dano ao alvo.' },
    { id: 'tazeem', name: 'Tazeem', type: 'plane', world: 'Zendikar', text: 'Criaturas não podem bloquear.', chaos: 'Compre um card para cada terreno que você controla.' },
    { id: 'undercity', name: 'Undercity Reaches', type: 'plane', world: 'Ravnica', text: 'Sempre que uma criatura causa dano de combate a um jogador, seu controlador pode comprar um card.', chaos: 'Você tem o monarca... (resumo: compre 2).' },
    { id: 'velis', name: 'Velis Vel', type: 'plane', world: 'Lorwyn', text: 'Cada criatura recebe +1/+1 para cada outra criatura com o mesmo tipo.', chaos: 'A criatura alvo ganha todos os tipos de criatura até o fim do turno.' },
    { id: 'windriddle', name: 'Windriddle Palaces', type: 'plane', world: 'Belenon', text: 'Jogadores jogam com o topo do grimório revelado e podem jogar terrenos do topo de qualquer grimório (resumo).', chaos: 'Cada jogador põe o topo do grimório no cemitério.' },
    // Fenômenos
    { id: 'chaotic', name: 'Chaotic Æther', type: 'phenomenon', world: '—', text: 'Fenômeno: até o próximo planeswalk, todo resultado em branco no dado planar conta como caos. Planeswalk.' },
    { id: 'interplanar', name: 'Interplanar Tunnel', type: 'phenomenon', world: '—', text: 'Fenômeno: revele cards do topo do deck planar até revelar 5 planos; escolha um pra ir e embaralhe o resto.' },
    { id: 'morphic', name: 'Morphic Tide', type: 'phenomenon', world: '—', text: 'Fenômeno: cada jogador embaralha todas as permanentes que controla no grimório e revela do topo até achar o mesmo número de permanentes... (resumo). Planeswalk.' },
    { id: 'mutual', name: 'Mutual Epiphany', type: 'phenomenon', world: '—', text: 'Fenômeno: cada jogador compra quatro cards. Planeswalk.' },
    { id: 'planewide', name: 'Planewide Disaster', type: 'phenomenon', world: '—', text: 'Fenômeno: destrua todas as criaturas. Planeswalk.' },
    { id: 'reality', name: 'Reality Shaping', type: 'phenomenon', world: '—', text: 'Fenômeno: cada jogador põe uma permanente da mão no campo (resumo). Planeswalk.' },
    { id: 'spatial', name: 'Spatial Merging', type: 'phenomenon', world: '—', text: 'Fenômeno: revele planos até revelar dois; ambos ficam ativos ao mesmo tempo.' },
    { id: 'timeshift', name: 'Time Distortion', type: 'phenomenon', world: '—', text: 'Fenômeno: inverta a ordem dos turnos. Planeswalk.' },
];
export const SCHEMES = [
    { id: 'all_in_good_time', name: 'All in Good Time', ongoing: false, text: 'Dê um turno extra depois deste. Nenhum oponente pode conjurar mágicas nesse turno extra.' },
    { id: 'behold_power', name: 'Behold the Power of Destruction', ongoing: false, text: 'Destrua todas as permanentes não-terreno que o oponente alvo controla.' },
    { id: 'choose_demise', name: 'Choose Your Demise', ongoing: false, text: 'O oponente alvo separa o grimório em duas pilhas; você escolhe uma e ele exila a outra.' },
    { id: 'dead_men', name: 'Dead Men Tell No Tales', ongoing: false, text: 'Exile o cemitério e a mão do oponente alvo (resumo).' },
    { id: 'every_hope', name: 'Every Hope Shall Vanish', ongoing: false, text: 'Cada oponente revela a mão; você escolhe um não-terreno de cada e eles descartam.' },
    { id: 'evil_comes', name: 'Evil Comes to Fruition', ongoing: true, text: 'Crie 5 fichas de Planta 0/1. Quando você controlar 10 ou mais criaturas, abandone este esquema e ganhe um turno extra (resumo).' },
    { id: 'feed_machine', name: 'Feed the Machine', ongoing: false, text: 'Cada oponente sacrifica uma criatura ou descarta dois cards.' },
    { id: 'ignite', name: 'Ignite the Cloneforge!', ongoing: false, text: 'Crie uma ficha que é cópia da permanente alvo.' },
    { id: 'introductions', name: 'Introductions Are in Order', ongoing: false, text: 'Escolha: procure uma criatura no grimório e ponha na mão; ou ponha uma criatura da mão no campo.' },
    { id: 'know_naught', name: 'Know Naught but Fire', ongoing: false, text: 'Causa dano a cada oponente igual ao número de cards na mão dele.' },
    { id: 'look_skyward', name: 'Look Skyward and Despair', ongoing: false, text: 'Crie uma ficha de Dragão 5/5 vermelha com voar.' },
    { id: 'may_civ', name: 'May Civilization Collapse', ongoing: false, text: 'Cada oponente sacrifica dois terrenos.' },
    { id: 'mortal_flesh', name: 'Mortal Flesh Is Weak', ongoing: false, text: 'Cada oponente perde vida igual ao número de criaturas que controla; você ganha esse total.' },
    { id: 'my_crushing', name: 'My Crushing Masterstroke', ongoing: false, text: 'Ganhe o controle de todas as não-terreno dos oponentes até o fim do turno; desvire e ataque com elas.' },
    { id: 'my_genius', name: 'My Genius Knows No Bounds', ongoing: false, text: 'Você ganha X de vida, compra X cards e põe X contadores +1/+1 (X = número de esquemas na pilha).' },
    { id: 'my_undead', name: 'My Undead Horde Awakens', ongoing: true, text: 'No fim de cada turno dos oponentes, ponha uma criatura de um cemitério de oponente no campo sob seu controle (resumo).' },
    { id: 'my_wish', name: 'My Wish Is Your Command', ongoing: false, text: 'Cada oponente revela a mão; você escolhe uma instantânea/feitiço de cada e conjura sem pagar (resumo).' },
    { id: 'nature_demands', name: 'Nature Demands an Offering', ongoing: false, text: 'O oponente alvo escolhe uma criatura que ele controla; outro oponente escolhe outra; sacrifique o resto (resumo).' },
    { id: 'nothing_can_stop', name: 'Nothing Can Stop Me Now', ongoing: true, text: 'Impeça todo o dano que seria causado a você. Quando quatro ou mais criaturas causarem dano simultâneo, abandone.' },
    { id: 'only_blood', name: 'Only Blood Ends Your Nightmares', ongoing: false, text: 'Cada oponente sacrifica uma criatura; depois, os que não sacrificaram perdem 7 de vida (resumo).' },
    { id: 'pay_tribute', name: 'Pay Tribute to Me', ongoing: false, text: 'Cada oponente sacrifica duas criaturas.' },
    { id: 'perhaps_you', name: 'Perhaps You\'ve Met My Cohort', ongoing: false, text: 'Procure um planeswalker no grimório e ponha no campo.' },
    { id: 'realms_befitting', name: 'Realms Befitting My Majesty', ongoing: false, text: 'Procure dois terrenos básicos e ponha no campo virados.' },
    { id: 'roots_of_all', name: 'Roots of All Evil', ongoing: false, text: 'Crie cinco fichas de Saproling 1/1 verdes.' },
    { id: 'rotted_ones', name: 'Rotted Ones, Lay Siege', ongoing: false, text: 'Para cada oponente, crie uma ficha de Zumbi 2/2 que ataca esse oponente a cada combate.' },
    { id: 'surrender_thoughts', name: 'Surrender Your Thoughts', ongoing: false, text: 'Cada oponente descarta quatro cards (resumo).' },
    { id: 'dictate', name: 'The Dead Shall Serve', ongoing: false, text: 'Ponha uma criatura do cemitério no campo sob seu controle (resumo).' },
    { id: 'the_pieces', name: 'The Pieces Are Coming Together', ongoing: false, text: 'Compre dois cards; artefatos custam {2} a menos neste turno.' },
    { id: 'the_very_soil', name: 'The Very Soil Shall Shake', ongoing: true, text: 'Criaturas que você controla recebem +2/+2 e atropelar (resumo).' },
    { id: 'tooth_claw', name: 'Tooth, Claw, and Tail', ongoing: false, text: 'Destrua até três permanentes não-terreno alvo.' },
    { id: 'which_of_you', name: 'Which of You Burns Brightest?', ongoing: false, text: 'Cada oponente perde X de vida e sacrifica X permanentes (resumo).' },
    { id: 'your_fate', name: 'Your Fate Is Thrice Sealed', ongoing: false, text: 'Revele três cards; ponha terrenos no campo e o resto na mão.' },
    { id: 'your_puny', name: 'Your Puny Minds Cannot Fathom', ongoing: false, text: 'Compre quatro cards; sem limite de mão até seu próximo turno.' },
    { id: 'your_will', name: 'Your Will Is Not Your Own', ongoing: false, text: 'Ganhe o controle da criatura alvo (resumo).' },
];
function shuffleIds(list) {
    const ids = list.map(c => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
}
const planeById = (id) => PLANES.find(p => p.id === id);
const schemeById = (id) => SCHEMES.find(s => s.id === id);
// ----- Day/Night -----
export function setDayNight(v) {
    const msg = v === 'none' ? 'Dia/Noite desligado' : v === 'day' ? '☀️ Virou DIA' : '🌙 Virou NOITE';
    gameState.updateMechanics({ dayNight: v }, { type: 'day_night', details: { message: msg } });
}
export function toggleDayNight() {
    const cur = gameState.getState().mechanics.dayNight;
    setDayNight(cur === 'day' ? 'night' : 'day');
}
// ----- Planechase -----
export function planechaseStart(includePhenomena = true) {
    const deck = shuffleIds(PLANES.filter(p => includePhenomena || p.type === 'plane'));
    // O topo começa num PLANO (fenômeno no primeiro card é ruim).
    const firstPlaneIdx = deck.findIndex(id => planeById(id)?.type === 'plane');
    const first = deck.splice(firstPlaneIdx, 1)[0];
    gameState.updateMechanics({ planeDeck: deck, planeDiscard: [], currentPlane: first, phenomenonActive: null }, { type: 'plane', details: { message: `deck embaralhado, começando em ${planeById(first)?.name}` } });
}
export function planeswalk() {
    const m = gameState.getState().mechanics;
    let deck = m.planeDeck.slice();
    const discard = m.planeDiscard.slice();
    if (m.currentPlane)
        discard.push(m.currentPlane);
    if (m.phenomenonActive)
        discard.push(m.phenomenonActive);
    if (deck.length === 0) {
        if (discard.length === 0) {
            planechaseStart();
            return;
        }
        deck = shuffleIds(discard.map(id => ({ id })));
        discard.length = 0;
    }
    const next = deck.pop();
    const card = planeById(next);
    if (card?.type === 'phenomenon') {
        gameState.updateMechanics({ planeDeck: deck, planeDiscard: discard, phenomenonActive: next, currentPlane: null }, { type: 'plane', details: { message: `fenômeno: ${card.name}` } });
        return;
    }
    gameState.updateMechanics({ planeDeck: deck, planeDiscard: discard, currentPlane: next, phenomenonActive: null }, { type: 'plane', details: { message: `planeswalk para ${card?.name}` } });
}
export function planechaseStop() {
    gameState.updateMechanics({ planeDeck: [], planeDiscard: [], currentPlane: null, phenomenonActive: null }, { type: 'plane', details: { message: 'Planechase encerrado' } });
}
// Dado planar: 1 planeswalk, 1 caos, 4 em branco.
export function rollPlanarDie() {
    const r = secureRandomInt(6);
    return r === 0 ? 'planeswalk' : r === 1 ? 'chaos' : 'blank';
}
// ----- Archenemy -----
export function archenemyStart(archenemyPlayerId) {
    gameState.updateMechanics({ schemeDeck: shuffleIds(SCHEMES), schemeDiscard: [], currentScheme: null, ongoingSchemes: [], archenemyPlayerId }, { type: 'scheme', playerId: archenemyPlayerId, details: { message: 'deck de esquemas embaralhado' } });
}
export function drawScheme() {
    const m = gameState.getState().mechanics;
    let deck = m.schemeDeck.slice();
    const discard = m.schemeDiscard.slice();
    if (m.currentScheme && !schemeById(m.currentScheme)?.ongoing)
        discard.push(m.currentScheme);
    if (deck.length === 0) {
        if (discard.length === 0)
            return;
        deck = shuffleIds(discard.map(id => ({ id })));
        discard.length = 0;
    }
    const next = deck.pop();
    const card = schemeById(next);
    const ongoing = m.ongoingSchemes.slice();
    if (card?.ongoing && !ongoing.includes(next))
        ongoing.push(next);
    gameState.updateMechanics({ schemeDeck: deck, schemeDiscard: discard, currentScheme: next, ongoingSchemes: ongoing }, { type: 'scheme', playerId: m.archenemyPlayerId || undefined, details: { message: `esquema: ${card?.name}` } });
}
export function abandonScheme(id) {
    const m = gameState.getState().mechanics;
    gameState.updateMechanics({ ongoingSchemes: m.ongoingSchemes.filter(s => s !== id), schemeDiscard: [...m.schemeDiscard, id], currentScheme: m.currentScheme === id ? null : m.currentScheme }, { type: 'scheme', playerId: m.archenemyPlayerId || undefined, details: { message: `esquema abandonado: ${schemeById(id)?.name}` } });
}
export function archenemyStop() {
    gameState.updateMechanics({ schemeDeck: [], schemeDiscard: [], currentScheme: null, ongoingSchemes: [], archenemyPlayerId: null }, { type: 'scheme', details: { message: 'Archenemy encerrado' } });
}
// ----- Indicador na mesa (dia/noite + plano atual + esquema) -----
export function renderMechanicsBadge() {
    const m = gameState.getState().mechanics;
    let el = document.getElementById('mechanics-badge');
    const parts = [];
    if (m.dayNight !== 'none')
        parts.push(m.dayNight === 'day' ? '☀️ Dia' : '🌙 Noite');
    if (m.phenomenonActive)
        parts.push(`✨ ${planeById(m.phenomenonActive)?.name || ''}`);
    else if (m.currentPlane)
        parts.push(`🪐 ${planeById(m.currentPlane)?.name || ''}`);
    if (m.currentScheme)
        parts.push(`😈 ${schemeById(m.currentScheme)?.name || ''}`);
    if (parts.length === 0) {
        el?.remove();
        return;
    }
    if (!el) {
        el = document.createElement('button');
        el.id = 'mechanics-badge';
        el.className = 'mechanics-badge';
        el.setAttribute('type', 'button');
        el.addEventListener('click', () => openMechanicsModal());
        document.getElementById('game-screen')?.appendChild(el);
    }
    el.innerHTML = parts.map(p => `<span>${escapeHtml(p)}</span>`).join('');
}
// ----- Modal -----
export function openMechanicsModal() {
    document.getElementById('mechanics-modal-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'mechanics-modal-dyn';
    document.body.appendChild(modal);
    const close = () => modal.remove();
    const render = () => {
        const state = gameState.getState();
        const m = state.mechanics;
        const plane = m.currentPlane ? planeById(m.currentPlane) : null;
        const phen = m.phenomenonActive ? planeById(m.phenomenonActive) : null;
        const scheme = m.currentScheme ? schemeById(m.currentScheme) : null;
        const arch = state.players.find(p => p.id === m.archenemyPlayerId);
        modal.innerHTML = `
            <div class="modal-content mech-modal-content">
                <div class="modal-header">
                    <h2><svg class="ic ic-title"><use href="#ic-planet"/></svg>Mecânicas de mesa</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="mech-body">
                    <div class="mech-section">
                        <div class="podium-section-label">Dia / Noite</div>
                        <div class="mech-row">
                            <button type="button" class="mech-btn ${m.dayNight === 'day' ? 'active' : ''}" data-act="day">☀️ Dia</button>
                            <button type="button" class="mech-btn ${m.dayNight === 'night' ? 'active' : ''}" data-act="night">🌙 Noite</button>
                            <button type="button" class="mech-btn ${m.dayNight === 'none' ? 'active' : ''}" data-act="dn-off">Desligado</button>
                        </div>
                        <p class="mech-help">Vira noite se o jogador ativo não conjurou mágica no turno; vira dia se alguém conjurou 2+ no turno. Toque pra virar manualmente.</p>
                    </div>

                    <div class="mech-section">
                        <div class="podium-section-label">Planechase</div>
                        ${plane || phen ? `
                            <div class="mech-card ${phen ? 'mech-phen' : ''}">
                                <div class="mech-card-name">${escapeHtml((phen || plane).name)} <span class="mech-card-world">${escapeHtml((phen || plane).world)}</span></div>
                                <div class="mech-card-text">${escapeHtml((phen || plane).text)}</div>
                                ${plane?.chaos ? `<div class="mech-card-chaos">🌀 Caos: ${escapeHtml(plane.chaos)}</div>` : ''}
                            </div>
                            <div class="mech-row">
                                <button type="button" class="mech-btn primary" data-act="planeswalk">🚶 Planeswalk</button>
                                <button type="button" class="mech-btn" data-act="planar-die">🎲 Dado planar</button>
                                <button type="button" class="mech-btn" data-act="plane-stop">Encerrar</button>
                            </div>
                            <div class="mech-muted">${m.planeDeck.length} no deck · ${m.planeDiscard.length} no descarte</div>
                            <div class="mech-die" id="planar-die-result"></div>
                        ` : `
                            <div class="mech-row">
                                <button type="button" class="mech-btn primary" data-act="plane-start">Embaralhar deck de planos</button>
                                <button type="button" class="mech-btn" data-act="plane-start-nophen">Sem fenômenos</button>
                            </div>
                            <p class="mech-help">${PLANES.filter(p => p.type === 'plane').length} planos e ${PLANES.filter(p => p.type === 'phenomenon').length} fenômenos. O dado planar tem 1 face planeswalk, 1 caos e 4 em branco.</p>
                        `}
                    </div>

                    <div class="mech-section">
                        <div class="podium-section-label">Archenemy</div>
                        ${m.archenemyPlayerId ? `
                            <div class="mech-muted">Arqui-inimigo: <strong>${escapeHtml(arch?.name || '?')}</strong> · ${m.schemeDeck.length} esquemas no deck</div>
                            ${scheme ? `
                                <div class="mech-card mech-scheme">
                                    <div class="mech-card-name">${escapeHtml(scheme.name)} ${scheme.ongoing ? '<span class="mech-card-world">em andamento</span>' : ''}</div>
                                    <div class="mech-card-text">${escapeHtml(scheme.text)}</div>
                                </div>` : ''}
                            ${m.ongoingSchemes.length ? `
                                <div class="mech-ongoing">
                                    ${m.ongoingSchemes.map(id => `<div class="mech-ongoing-item"><span>${escapeHtml(schemeById(id)?.name || id)}</span><button type="button" class="mech-link" data-act="abandon" data-id="${id}">abandonar</button></div>`).join('')}
                                </div>` : ''}
                            <div class="mech-row">
                                <button type="button" class="mech-btn primary" data-act="scheme">😈 Puxar esquema</button>
                                <button type="button" class="mech-btn" data-act="arch-stop">Encerrar</button>
                            </div>
                        ` : `
                            <div class="mech-row mech-wrap">
                                ${state.players.map(p => `<button type="button" class="mech-btn" data-act="arch-start" data-id="${p.id}">${escapeHtml(p.name)} é o arqui-inimigo</button>`).join('')}
                            </div>
                            <p class="mech-help">O arqui-inimigo começa com 40 de vida e puxa um esquema no início de cada turno dele; os outros jogam em time com 20.</p>
                        `}
                    </div>
                </div>
            </div>
        `;
        modal.querySelector('.modal-close')?.addEventListener('click', close);
    };
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            close();
            return;
        }
        const btn = e.target.closest('[data-act]');
        if (!btn)
            return;
        const act = btn.dataset.act;
        switch (act) {
            case 'day':
                setDayNight('day');
                break;
            case 'night':
                setDayNight('night');
                break;
            case 'dn-off':
                setDayNight('none');
                break;
            case 'plane-start':
                planechaseStart(true);
                break;
            case 'plane-start-nophen':
                planechaseStart(false);
                break;
            case 'planeswalk':
                planeswalk();
                break;
            case 'plane-stop':
                planechaseStop();
                break;
            case 'planar-die': {
                const r = rollPlanarDie();
                if (r === 'planeswalk')
                    planeswalk();
                render();
                const el = modal.querySelector('#planar-die-result');
                if (el)
                    el.textContent = r === 'planeswalk' ? '🚶 Planeswalk!' : r === 'chaos' ? '🌀 CAOS! Aplique o efeito de caos do plano.' : '⬜ Em branco (nada acontece)';
                return;
            }
            case 'arch-start':
                archenemyStart(btn.dataset.id || '');
                break;
            case 'scheme':
                drawScheme();
                break;
            case 'abandon':
                abandonScheme(btn.dataset.id || '');
                break;
            case 'arch-stop':
                archenemyStop();
                break;
        }
        render();
        renderMechanicsBadge();
    });
    render();
}
//# sourceMappingURL=mechanics.js.map