"""
Pontuação configurável e Elo.

Modos (AppSetting 'scoring' -> {'mode': ...}):
  placement   N − lugar + 1 (padrão)
  winner_only 1 ponto só pra quem venceu
  podium      3 / 1 / 0
  elo         ranking pela nota Elo (os pontos mostrados são a nota)

Elo multiplayer: a cada partida, cada par de jogadores é tratado como um
duelo (quem ficou melhor colocado venceu), com K dividido por (N−1) pra
uma mesa grande não valer N vezes mais que um duelo. Ganhar de mesa forte
(notas altas) rende mais. Nota inicial 1000.
"""
from .models import AppSetting, Match, MatchPlacement

MODES = ('placement', 'winner_only', 'podium', 'elo')
ELO_START = 1000
ELO_K = 40


def get_mode():
    cfg = AppSetting.get('scoring', {}) or {}
    mode = cfg.get('mode', 'placement')
    return mode if mode in MODES else 'placement'


def set_mode(mode):
    if mode not in MODES:
        raise ValueError('mode precisa ser placement, winner_only, podium ou elo')
    AppSetting.set('scoring', {'mode': mode})
    return mode


def points_for(place, player_count, mode):
    if mode == 'winner_only':
        return 1 if place == 1 else 0
    if mode == 'podium':
        return {1: 3, 2: 1}.get(place, 0)
    return max(0, player_count - place + 1)


def compute_elo(until=None):
    """
    Replay cronológico de todas as partidas. Retorna
    (ratings: {profile_id: rating}, history: {profile_id: [(match_id, ended_at, rating_after)]}).
    """
    qs = Match.objects.order_by('ended_at', 'id').prefetch_related('placements')
    if until:
        qs = qs.filter(ended_at__lte=until)
    ratings = {}
    history = {}
    for m in qs:
        pls = [p for p in m.placements.all() if p.profile_id]
        if len(pls) < 2:
            continue
        n = len(pls)
        k = ELO_K / (n - 1)
        cur = {p.profile_id: ratings.get(p.profile_id, ELO_START) for p in pls}
        delta = {pid: 0.0 for pid in cur}
        for i in range(n):
            for j in range(i + 1, n):
                a, b = pls[i], pls[j]
                ra, rb = cur[a.profile_id], cur[b.profile_id]
                ea = 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))
                sa = 1.0 if a.place < b.place else 0.0 if a.place > b.place else 0.5
                d = k * (sa - ea)
                delta[a.profile_id] += d
                delta[b.profile_id] -= d
        for pid in cur:
            ratings[pid] = cur[pid] + delta[pid]
            history.setdefault(pid, []).append((m.id, m.ended_at, round(ratings[pid])))
    return {pid: round(r) for pid, r in ratings.items()}, history
