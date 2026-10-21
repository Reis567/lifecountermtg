"""
Conquistas calculadas no servidor a partir do resultado e do log de eventos da
partida (Match.events, no formato de GameState.history do app, em ordem
cronológica: cada item tem type, playerId, playerName, turn, details).

Cada regra devolve os NOMES dos jogadores (placement.name) que ganharam a
conquista nesta partida; o chamador converte pra perfil.
"""
from datetime import timedelta

from .models import Achievement, Match, MatchPlacement

CATALOG = {
    'first_win': {'title': 'Primeira vitória', 'icon': '🏆', 'description': 'Venceu a primeira partida.'},
    'win_at_1_life': {'title': 'Por um fio', 'icon': '🫀', 'description': 'Venceu com 1 de vida.'},
    'comeback': {'title': 'Ressurreição', 'icon': '🧟', 'description': 'Chegou a 3 de vida ou menos e ainda venceu.'},
    'commander_kill': {'title': 'Golpe do comandante', 'icon': '⚔️', 'description': 'Eliminou alguém com dano de comandante.'},
    'serial_killer': {'title': 'Serial killer', 'icon': '🔪', 'description': 'Eliminou 3 ou mais jogadores na mesma partida.'},
    'three_wins_streak': {'title': 'Hat-trick', 'icon': '🔥', 'description': 'Três vitórias seguidas.'},
    'five_wins_streak': {'title': 'Imparável', 'icon': '🌋', 'description': 'Cinco vitórias seguidas.'},
    'early_death': {'title': 'Nem esquentou a cadeira', 'icon': '🪑', 'description': 'Eliminado até o turno 3.'},
    'lanterninha': {'title': 'Lanterninha', 'icon': '🔦', 'description': 'Último lugar três vezes seguidas.'},
    'speedrun': {'title': 'Vitória relâmpago', 'icon': '⚡', 'description': 'Venceu uma partida de até 15 minutos.'},
    'marathon': {'title': 'Maratonista', 'icon': '🏃', 'description': 'Jogou uma partida de 2 horas ou mais.'},
    'poison_kill': {'title': 'Envenenador', 'icon': '☠️', 'description': 'Eliminou alguém com veneno.'},
    'monarch_win': {'title': 'Rei da mesa', 'icon': '👑', 'description': 'Venceu sendo o Monarca.'},
    'ten_matches': {'title': 'Frequentador', 'icon': '🎟️', 'description': 'Jogou 10 partidas.'},
    'fifty_matches': {'title': 'Veterano', 'icon': '🎖️', 'description': 'Jogou 50 partidas.'},
    'ten_wins': {'title': 'Dez na conta', 'icon': '🔟', 'description': 'Dez vitórias no total.'},
    'big_table_win': {'title': 'Rei do caos', 'icon': '🎪', 'description': 'Venceu uma mesa de 5+ jogadores.'},
    'one_hit': {'title': 'Golpe de 20', 'icon': '💥', 'description': 'Tirou 20 ou mais de vida de alguém de uma vez.'},
}


def _events(match):
    return [e for e in (match.events or []) if isinstance(e, dict)]


def _details(e):
    d = e.get('details')
    return d if isinstance(d, dict) else {}


def compute_for_match(match: Match):
    """Retorna lista de (placement, key) novos para esta partida (sem gravar)."""
    placements = list(match.placements.select_related('profile').all())
    if not placements:
        return []
    by_name = {p.name: p for p in placements}
    winner = next((p for p in placements if p.place == 1), None)
    events = _events(match)
    found = []  # (placement, key)

    def grant(p, key):
        if p and p.profile_id:
            found.append((p, key))

    # --- regras por partida ---
    if winner:
        grant(winner, 'first_win')
        if winner.final_life is not None and 0 < winner.final_life <= 1:
            grant(winner, 'win_at_1_life')
        if match.duration_ms and match.duration_ms <= 15 * 60 * 1000:
            grant(winner, 'speedrun')
        if match.player_count >= 5:
            grant(winner, 'big_table_win')
        # comeback: chegou a <=3 de vida em algum momento
        for e in events:
            if e.get('type') == 'life_change' and e.get('playerName') == winner.name:
                nv = _details(e).get('newValue')
                if isinstance(nv, (int, float)) and 0 < nv <= 3:
                    grant(winner, 'comeback')
                    break
        # monarca ao vencer: último evento de monarca aponta pro vencedor
        last_monarch = None
        for e in events:
            if e.get('type') == 'monarch_change':
                last_monarch = e.get('playerName')
            elif e.get('type') == 'monarch_removed':
                last_monarch = None
        if last_monarch == winner.name:
            grant(winner, 'monarch_win')

    if match.duration_ms and match.duration_ms >= 2 * 60 * 60 * 1000:
        for p in placements:
            grant(p, 'marathon')

    kills = {}
    for e in events:
        if e.get('type') != 'player_eliminated':
            continue
        d = _details(e)
        killer = d.get('fromPlayerName')
        how = d.get('message')
        victim = e.get('playerName')
        if killer and killer in by_name:
            kills[killer] = kills.get(killer, 0) + 1
            if how == 'commander':
                grant(by_name[killer], 'commander_kill')
        if how == 'poison' and killer and killer in by_name:
            grant(by_name[killer], 'poison_kill')
        turn = e.get('turn')
        if victim in by_name and isinstance(turn, int) and turn <= 3:
            grant(by_name[victim], 'early_death')
    for name, n in kills.items():
        if n >= 3:
            grant(by_name[name], 'serial_killer')

    for e in events:
        if e.get('type') in ('life_change', 'commander_damage'):
            d = _details(e)
            amt = d.get('amount')
            if isinstance(amt, (int, float)) and amt <= -20 and e.get('type') == 'life_change':
                src = d.get('fromPlayerName')
                if src in by_name:
                    grant(by_name[src], 'one_hit')
            if e.get('type') == 'commander_damage' and isinstance(amt, (int, float)) and amt >= 20:
                src = d.get('fromPlayerName')
                if src in by_name:
                    grant(by_name[src], 'one_hit')

    # --- regras por histórico do perfil (contadores e sequências) ---
    for p in placements:
        if not p.profile_id:
            continue
        hist = list(
            MatchPlacement.objects.filter(profile_id=p.profile_id, match__ended_at__lte=match.ended_at)
            .select_related('match').order_by('-match__ended_at', '-match__id')
        )
        total = len(hist)
        wins = sum(1 for h in hist if h.place == 1)
        if total >= 10:
            grant(p, 'ten_matches')
        if total >= 50:
            grant(p, 'fifty_matches')
        if wins >= 10:
            grant(p, 'ten_wins')
        streak = 0
        for h in hist:
            if h.place == 1:
                streak += 1
            else:
                break
        if streak >= 3:
            grant(p, 'three_wins_streak')
        if streak >= 5:
            grant(p, 'five_wins_streak')
        last_streak = 0
        for h in hist:
            if h.match.player_count > 1 and h.place == h.match.player_count:
                last_streak += 1
            else:
                break
        if last_streak >= 3:
            grant(p, 'lanterninha')

    # dedup + só o que o perfil ainda não tem
    out = []
    seen = set()
    for p, key in found:
        if (p.profile_id, key) in seen:
            continue
        seen.add((p.profile_id, key))
        if Achievement.objects.filter(profile_id=p.profile_id, key=key).exists():
            continue
        out.append((p, key))
    return out


def award_for_match(match: Match):
    """Grava as conquistas novas e devolve lista de dicts pro app anunciar."""
    created = []
    for p, key in compute_for_match(match):
        a = Achievement.objects.create(profile_id=p.profile_id, key=key, match=match)
        created.append(serialize(a, p.name))
    return created


def serialize(a: Achievement, profile_name=None):
    meta = CATALOG.get(a.key, {'title': a.key, 'icon': '🏅', 'description': ''})
    return {
        'key': a.key,
        'title': meta['title'],
        'description': meta['description'],
        'icon': meta['icon'],
        'earned_at': a.earned_at,
        'match_id': a.match_id,
        'profile_id': a.profile_id,
        'profile_name': profile_name or (a.profile.name if a.profile_id else None),
    }
