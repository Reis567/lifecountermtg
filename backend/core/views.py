import io
from datetime import datetime, time

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from PIL import Image, ImageOps
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

import secrets

from . import achievements as ach
from . import scoring
from . import seasons
from .models import Achievement, AppVersion, Deck, LiveAction, LiveTable, Match, MatchPlacement, Profile, ProfileSound
from .serializers import AppVersionSerializer, DeckSerializer, MatchSerializer, ProfileSerializer


# ----- helpers --------------------------------------------------------------

def _check_key(request):
    """Escritas exigem a chave compartilhada (X-LC-Key). Retorna Response de erro ou None."""
    key = request.headers.get('X-LC-Key')
    if key != settings.LC_API_KEY:
        return Response({'detail': 'Chave inválida.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _process_photo(upload, max_side=None):
    """Redimensiona/normaliza a foto (EXIF, RGB, JPEG) pra não inflar o servidor."""
    max_side = max_side or settings.PROFILE_PHOTO_MAX_SIDE
    img = Image.open(upload)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=86, optimize=True)
    buf.seek(0)
    return ContentFile(buf.read())


def _period_range(period: str):
    """(start, end) datetimes (end exclusivo) ou (None, None) para 'all'."""
    now = timezone.localtime()
    tz = now.tzinfo
    if period == 'today':
        return datetime.combine(now.date(), time.min, tzinfo=tz), None
    if period == 'month':
        return datetime.combine(now.date().replace(day=1), time.min, tzinfo=tz), None
    if period == 'year':
        return datetime.combine(now.date().replace(month=1, day=1), time.min, tzinfo=tz), None
    if period == 'season':
        start, end, _ = seasons.season_datetimes()
        return start, end
    if period == 'prev_season':
        start, end, _ = seasons.previous_season_datetimes()
        return start, end
    return None, None


def _period_cutoff(period: str):
    return _period_range(period)[0]


def _parse_aliases(raw):
    if raw is None:
        return None
    if isinstance(raw, list):
        items = raw
    else:
        s = str(raw).strip()
        if s.startswith('['):
            import json
            try:
                items = json.loads(s)
            except ValueError:
                items = []
        else:
            items = s.split(',')
    out = []
    for a in items:
        a = str(a).strip()
        if a and a not in out and len(a) <= 30:
            out.append(a)
    return out[:20]


def _abs(request, url):
    return request.build_absolute_uri(url) if request else url


# ----- health ---------------------------------------------------------------

@api_view(['GET'])
def health(request):
    return Response({
        'ok': True,
        'now': timezone.now(),
        'profiles': Profile.objects.filter(active=True).count(),
        'matches': Match.objects.count(),
    })


# ----- profiles -------------------------------------------------------------

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def profiles(request):
    if request.method == 'GET':
        qs = Profile.objects.all()
        if request.query_params.get('all') != '1':
            qs = qs.filter(active=True)
        return Response(ProfileSerializer(qs, many=True, context={'request': request}).data)

    err = _check_key(request)
    if err:
        return err
    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'name': 'Nome obrigatório.'}, status=400)
    if len(name) > 40:
        return Response({'name': 'Nome longo demais (máx. 40).'}, status=400)
    photo = request.FILES.get('photo')
    if photo and photo.size > settings.MAX_PHOTO_SIZE_MB * 1024 * 1024:
        return Response({'photo': f'Foto maior que {settings.MAX_PHOTO_SIZE_MB} MB.'}, status=400)

    profile = Profile(name=name, color=(request.data.get('color') or '')[:7])
    profile.slug = Profile.unique_slug(name)
    aliases = _parse_aliases(request.data.get('aliases'))
    if aliases is not None:
        profile.aliases = aliases
    if photo:
        try:
            profile.photo.save(f'{profile.slug}.jpg', _process_photo(photo), save=False)
        except Exception as e:  # imagem inválida
            return Response({'photo': f'Imagem inválida: {e}'}, status=400)
    profile.save()
    return Response(ProfileSerializer(profile, context={'request': request}).data, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def profile_detail(request, pk):
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        raise Http404

    if request.method == 'GET':
        return Response(ProfileSerializer(profile, context={'request': request}).data)

    err = _check_key(request)
    if err:
        return err

    if request.method == 'DELETE':
        # Soft delete: o histórico continua apontando pro perfil.
        profile.active = False
        profile.save(update_fields=['active', 'updated_at'])
        return Response(status=204)

    name = request.data.get('name')
    if name is not None:
        name = name.strip()
        if not name:
            return Response({'name': 'Nome obrigatório.'}, status=400)
        profile.name = name[:40]
    color = request.data.get('color')
    if color is not None:
        profile.color = color[:7]
    if 'active' in request.data:
        val = request.data.get('active')
        profile.active = str(val).lower() in ('1', 'true', 'yes')
    aliases = _parse_aliases(request.data.get('aliases'))
    if aliases is not None:
        profile.aliases = aliases
    photo = request.FILES.get('photo')
    if photo:
        if photo.size > settings.MAX_PHOTO_SIZE_MB * 1024 * 1024:
            return Response({'photo': f'Foto maior que {settings.MAX_PHOTO_SIZE_MB} MB.'}, status=400)
        try:
            profile.photo.save(f'{profile.slug}.jpg', _process_photo(photo), save=False)
        except Exception as e:
            return Response({'photo': f'Imagem inválida: {e}'}, status=400)
    profile.save()
    return Response(ProfileSerializer(profile, context={'request': request}).data)


# ----- matches --------------------------------------------------------------

@api_view(['GET', 'POST'])
def matches(request):
    if request.method == 'GET':
        qs = Match.objects.prefetch_related('placements__profile').all()
        profile_id = request.query_params.get('profile')
        if profile_id:
            qs = qs.filter(placements__profile_id=profile_id).distinct()
        period = request.query_params.get('period')
        if period:
            start, end = _period_range(period)
            if start:
                qs = qs.filter(ended_at__gte=start)
            if end:
                qs = qs.filter(ended_at__lt=end)
        try:
            limit = min(int(request.query_params.get('limit', 50)), 500)
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except ValueError:
            limit, offset = 50, 0
        total = qs.count()
        items = qs[offset:offset + limit]
        data = MatchSerializer(items, many=True, context={'request': request}).data
        if request.query_params.get('events') != '1':
            for m in data:
                m.pop('events', None)
        return Response({'count': total, 'offset': offset, 'limit': limit, 'results': data})

    err = _check_key(request)
    if err:
        return err
    client_id = request.data.get('client_id')
    if client_id:
        existing = Match.objects.filter(client_id=client_id).first()
        if existing:
            # Idempotente: reenvio (fila offline) devolve o que já existe.
            data = MatchSerializer(existing, context={'request': request}).data
            data['new_achievements'] = []
            return Response(data, status=200)
    ser = MatchSerializer(data=request.data, context={'request': request})
    ser.is_valid(raise_exception=True)
    with transaction.atomic():
        match = ser.save()
        try:
            new_ach = ach.award_for_match(match)
        except Exception as e:  # conquista nunca pode derrubar o salvamento
            new_ach = []
            print('achievements error:', e)
    data = MatchSerializer(match, context={'request': request}).data
    data['new_achievements'] = new_ach
    return Response(data, status=201)


@api_view(['GET', 'DELETE'])
def match_detail(request, pk):
    try:
        match = Match.objects.prefetch_related('placements__profile').get(pk=pk)
    except Match.DoesNotExist:
        raise Http404
    if request.method == 'GET':
        return Response(MatchSerializer(match, context={'request': request}).data)
    err = _check_key(request)
    if err:
        return err
    match.delete()
    return Response(status=204)


# ----- ranking --------------------------------------------------------------

def _aggregate(request, start=None, end=None, tiebreak='points', mode=None):
    """
    Agregado por perfil. `mode` (scoring) recalcula os pontos de TODO o
    histórico pelo critério escolhido; 'elo' usa a nota Elo como pontos.
    """
    mode = mode or scoring.get_mode()
    qs = MatchPlacement.objects.select_related('profile', 'match')
    if start:
        qs = qs.filter(match__ended_at__gte=start)
    if end:
        qs = qs.filter(match__ended_at__lt=end)

    elo_ratings = scoring.compute_elo(until=end)[0] if mode == 'elo' else {}

    rows = {}
    for p in qs:
        if p.profile_id:
            key = f'p{p.profile_id}'
        else:
            key = 'n:' + (p.name or '').strip().lower()
        if not key or key == 'n:':
            continue
        row = rows.get(key)
        if row is None:
            row = rows[key] = {
                'profile_id': p.profile_id,
                'name': p.profile.name if p.profile else p.name,
                'photo_url': _abs(request, p.profile.photo.url) if p.profile and p.profile.photo else None,
                'points': 0, 'matches': 0, 'wins': 0, 'podiums': 0, 'last_places': 0,
                'last_played': None, 'elo': None,
            }
        if mode == 'elo':
            row['elo'] = elo_ratings.get(p.profile_id, scoring.ELO_START) if p.profile_id else scoring.ELO_START
            row['points'] = row['elo']
        else:
            row['points'] += scoring.points_for(p.place, p.match.player_count, mode)
        row['matches'] += 1
        if p.place == 1:
            row['wins'] += 1
        if p.place <= 3:
            row['podiums'] += 1
        if p.place == p.match.player_count and p.match.player_count > 1:
            row['last_places'] += 1
        ended = p.match.ended_at
        if row['last_played'] is None or ended > row['last_played']:
            row['last_played'] = ended

    if tiebreak == 'wins':
        keyf = lambda r: (-r['wins'], -r['points'], -r['matches'], r['name'].lower())
    else:
        keyf = lambda r: (-r['points'], -r['wins'], -r['matches'], r['name'].lower())
    result = sorted(rows.values(), key=keyf)
    for i, r in enumerate(result):
        r['rank'] = i + 1
        r['win_rate'] = round(100.0 * r['wins'] / r['matches'], 1) if r['matches'] else 0.0
    return result


@api_view(['GET'])
def ranking(request):
    """
    Agregado por perfil (fallback: nome normalizado) no período pedido:
    today | month | year | season | prev_season | all.
    Pontos: 1º = N, 2º = N-1, ..., último = 1. Desempate configurável.
    """
    period = request.query_params.get('period', 'all')
    cfg = seasons.get_settings()
    tiebreak = request.query_params.get('tiebreak') or cfg['tiebreak']
    mode = request.query_params.get('mode') or scoring.get_mode()
    if mode not in scoring.MODES:
        mode = scoring.get_mode()
    start, end = _period_range(period)
    result = _aggregate(request, start, end, tiebreak, mode)
    mq = Match.objects.all()
    if start:
        mq = mq.filter(ended_at__gte=start)
    if end:
        mq = mq.filter(ended_at__lt=end)
    label = None
    if period in ('season', 'prev_season'):
        label = (seasons.season_datetimes() if period == 'season' else seasons.previous_season_datetimes())[2]
    return Response({
        'period': period,
        'since': start,
        'until': end,
        'label': label,
        'tiebreak': tiebreak,
        'mode': mode,
        'total_matches': mq.count(),
        'rows': result,
    })


@api_view(['GET'])
def elo(request):
    """Notas Elo atuais + histórico de evolução por perfil."""
    ratings, history = scoring.compute_elo()
    profiles = {p.id: p for p in Profile.objects.all()}
    wins = {}
    for pl in MatchPlacement.objects.filter(place=1, profile__isnull=False).values_list('profile_id', flat=True):
        wins[pl] = wins.get(pl, 0) + 1
    rows = []
    for pid, r in ratings.items():
        p = profiles.get(pid)
        if not p:
            continue
        rows.append({
            'profile_id': pid, 'name': p.name, 'photo_url': _abs(request, p.photo.url) if p.photo else None,
            'elo': r, 'matches': len(history.get(pid, [])), 'wins': wins.get(pid, 0),
            'history': [{'match_id': mid, 'at': at, 'elo': e} for mid, at, e in history.get(pid, [])],
        })
    rows.sort(key=lambda x: -x['elo'])
    for i, r in enumerate(rows):
        r['rank'] = i + 1
    return Response({'rows': rows})


@api_view(['GET'])
def seasons_list(request):
    """Hall da fama: temporadas passadas (e a atual) com campeão e top 3."""
    cfg = seasons.get_settings()
    mode = scoring.get_mode()
    first = Match.objects.order_by('ended_at').first()
    if not first:
        return Response({'seasons': []})
    out = []
    cur_start, cur_end, cur_label = seasons.season_datetimes(cfg=cfg)
    ref = seasons.season_bounds(ref=timezone.localtime(first.ended_at).date(), cfg=cfg)[0]
    tz = timezone.get_current_timezone()
    elo_history = scoring.compute_elo()[1]
    guard = 0
    while guard < 400:
        guard += 1
        s_start, s_end, label = seasons.season_datetimes(ref=ref, cfg=cfg)
        if s_start > cur_start:
            break
        rows = _aggregate(request, s_start, s_end, cfg['tiebreak'], mode)
        n = Match.objects.filter(ended_at__gte=s_start, ended_at__lt=s_end).count()
        if n:
            out.append({
                'label': label, 'start': s_start.date().isoformat(), 'end': s_end.date().isoformat(),
                'current': s_start == cur_start, 'matches': n,
                'champion': rows[0] if rows else None,
                'top': rows[:3],
                'awards': _season_awards(request, s_start, s_end, elo_history),
            })
        ref = s_end.date()
    out.reverse()
    return Response({'seasons': out})


AWARD_LABELS = {
    'most_kills': 'Mais eliminações',
    'most_podiums': 'Mais pódios',
    'most_matches': 'Mais partidas',
    'zebra': 'Zebra',
    'longest_streak': 'Maior sequência',
}


def _elo_before(history):
    """{(profile_id, match_id): rating ANTES da partida} a partir do histórico do Elo."""
    before = {}
    for pid, items in history.items():
        prev = scoring.ELO_START
        for mid, _at, after in items:
            before[(pid, mid)] = prev
            prev = after
    return before


def _season_awards(request, s_start, s_end, elo_history=None):
    """
    Prêmios automáticos de uma temporada (além do campeão): mais eliminações,
    mais pódios, mais partidas, zebra (vitória com o menor Elo da mesa, maior
    diferença) e maior sequência de vitórias. Calculado na hora, sem gravar.
    """
    matches = list(Match.objects.filter(ended_at__gte=s_start, ended_at__lt=s_end)
                   .order_by('ended_at', 'id').prefetch_related('placements__profile'))
    if not matches:
        return []
    profiles = {}

    def meta(p):
        if p.profile_id and p.profile_id not in profiles:
            profiles[p.profile_id] = {
                'profile_id': p.profile_id, 'name': p.profile.name,
                'photo_url': _abs(request, p.profile.photo.url) if p.profile.photo else None,
            }

    kills, podiums, played, streak_best, streak_cur = {}, {}, {}, {}, {}
    zebra = None  # (gap, profile_id, match_id)
    if elo_history is None:
        elo_history = scoring.compute_elo()[1]
    before = _elo_before(elo_history)
    for m in matches:
        pls = [p for p in m.placements.all() if p.profile_id]
        names = {(p.profile.name or '').strip().lower(): p.profile_id for p in pls}
        for p in pls:
            meta(p)
            played[p.profile_id] = played.get(p.profile_id, 0) + 1
            if p.place <= 3:
                podiums[p.profile_id] = podiums.get(p.profile_id, 0) + 1
            if p.place == 1:
                streak_cur[p.profile_id] = streak_cur.get(p.profile_id, 0) + 1
                streak_best[p.profile_id] = max(streak_best.get(p.profile_id, 0), streak_cur[p.profile_id])
            else:
                streak_cur[p.profile_id] = 0
            killer = names.get((p.eliminated_by or '').strip().lower())
            if killer and killer != p.profile_id:
                kills[killer] = kills.get(killer, 0) + 1
        winner = next((p for p in pls if p.place == 1), None)
        if winner and len(pls) >= 3:
            ratings = {p.profile_id: before.get((p.profile_id, m.id), scoring.ELO_START) for p in pls}
            gap = max(ratings.values()) - ratings[winner.profile_id]
            if ratings[winner.profile_id] == min(ratings.values()) and gap > 0 and (zebra is None or gap > zebra[0]):
                zebra = (gap, winner.profile_id, m.id)

    def best(d):
        if not d:
            return None
        pid = max(d, key=lambda k: (d[k], -k))
        return pid, d[pid]

    out = []
    for key, d in (('most_kills', kills), ('most_podiums', podiums), ('most_matches', played), ('longest_streak', streak_best)):
        b = best(d)
        if b and b[1] > 0 and (key != 'longest_streak' or b[1] >= 2):
            out.append({'key': key, 'label': AWARD_LABELS[key], 'value': b[1], **profiles[b[0]]})
    if zebra:
        out.append({'key': 'zebra', 'label': AWARD_LABELS['zebra'], 'value': int(zebra[0]), 'match_id': zebra[2], **profiles[zebra[1]]})
    return out


def _trophies_for(request, profile_id):
    """Temporadas FECHADAS em que o perfil terminou em 1º + prêmios automáticos."""
    cfg = seasons.get_settings()
    mode = scoring.get_mode()
    first = Match.objects.order_by('ended_at').first()
    if not first:
        return []
    cur_start, _, _ = seasons.season_datetimes(cfg=cfg)
    ref = seasons.season_bounds(ref=timezone.localtime(first.ended_at).date(), cfg=cfg)[0]
    trophies = []
    elo_history = scoring.compute_elo()[1]
    guard = 0
    while guard < 400:
        guard += 1
        s_start, s_end, label = seasons.season_datetimes(ref=ref, cfg=cfg)
        if s_start >= cur_start:
            break
        rows = _aggregate(request, s_start, s_end, cfg['tiebreak'], mode)
        if rows and rows[0]['profile_id'] == profile_id:
            trophies.append({'label': label, 'start': s_start.date().isoformat(), 'points': rows[0]['points'], 'kind': 'champion'})
        for a in _season_awards(request, s_start, s_end, elo_history):
            if a['profile_id'] == profile_id:
                trophies.append({'label': f"{a['label']} · {label}", 'start': s_start.date().isoformat(), 'points': a['value'], 'kind': a['key']})
        ref = s_end.date()
    return trophies


@api_view(['GET'])
def season_summary(request):
    """
    Resumo visual da temporada atual: dias restantes, líder, maior sequência,
    partida mais longa, comandante da temporada, prêmios parciais e a corrida de
    pontos (acumulado por jogador partida a partida).
    """
    cfg = seasons.get_settings()
    mode = scoring.get_mode()
    s_start, s_end, label = seasons.season_datetimes(cfg=cfg)
    now = timezone.now()
    rows = _aggregate(request, s_start, s_end, cfg['tiebreak'], mode)
    matches = list(Match.objects.filter(ended_at__gte=s_start, ended_at__lt=s_end)
                   .order_by('ended_at', 'id').prefetch_related('placements__profile', 'placements__deck'))
    longest = max(matches, key=lambda m: m.duration_ms, default=None)
    longest_d = None
    if longest:
        w = next((p for p in longest.placements.all() if p.place == 1), None)
        longest_d = {'match_id': longest.id, 'duration_ms': longest.duration_ms, 'ended_at': longest.ended_at,
                     'winner': (w.profile.name if w and w.profile else (w.name if w else None)), 'players': longest.player_count}
    # comandante da temporada: mais vitórias (desempate: mais partidas)
    cmd = {}
    for m in matches:
        for p in m.placements.all():
            if not p.deck_name:
                continue
            c = cmd.setdefault(p.deck_name, {'name': p.deck_name, 'wins': 0, 'matches': 0, 'colors': p.deck_colors,
                                              'image': (p.deck.image_url if p.deck and p.deck.image_url else None), 'pilot': None})
            c['matches'] += 1
            if p.place == 1:
                c['wins'] += 1
                c['pilot'] = p.profile.name if p.profile else p.name
    commander = max(cmd.values(), key=lambda c: (c['wins'], c['matches']), default=None)
    awards = _season_awards(request, s_start, s_end)
    streak = next((a for a in awards if a['key'] == 'longest_streak'), None)
    # corrida de pontos
    series = {}
    order = []
    for m in matches:
        for p in m.placements.all():
            if p.profile_id and p.profile_id not in series:
                series[p.profile_id] = {'profile_id': p.profile_id, 'name': p.profile.name,
                                        'photo_url': _abs(request, p.profile.photo.url) if p.profile.photo else None,
                                        'color': p.profile.color, 'values': []}
                order.append(p.profile_id)
    totals = {pid: 0 for pid in series}
    race_matches = []
    for m in matches:
        for p in m.placements.all():
            if p.profile_id:
                totals[p.profile_id] += scoring.points_for(p.place, m.player_count, mode)
        for pid in order:
            series[pid]['values'].append(totals[pid])
        race_matches.append({'id': m.id, 'ended_at': m.ended_at})
    days_total = max(1, (s_end.date() - s_start.date()).days)
    days_left = max(0, (s_end.date() - timezone.localdate()).days)
    return Response({
        'label': label, 'start': s_start.date().isoformat(), 'end': s_end.date().isoformat(),
        'days_left': days_left, 'days_total': days_total, 'progress': round(100.0 * (days_total - days_left) / days_total, 1),
        'matches': len(matches), 'leader': rows[0] if rows else None, 'runner_up': rows[1] if len(rows) > 1 else None,
        'gap': (rows[0]['points'] - rows[1]['points']) if len(rows) > 1 else None,
        'longest_streak': streak, 'longest_match': longest_d, 'commander': commander,
        'awards': awards, 'race': {'matches': race_matches, 'series': [series[pid] for pid in order]},
        'now': now,
    })


@api_view(['GET'])
def profile_stats(request, pk):
    """Estatísticas detalhadas de um perfil (tela de perfil)."""
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        raise Http404
    placements = list(
        MatchPlacement.objects.filter(profile=profile).select_related('match').order_by('-match__ended_at', '-match__id')
    )
    matches_n = len(placements)
    points = sum(p.points for p in placements)
    wins = sum(1 for p in placements if p.place == 1)
    podiums = sum(1 for p in placements if p.place <= 3)
    last_places = sum(1 for p in placements if p.match.player_count > 1 and p.place == p.match.player_count)
    avg_place = round(sum(p.place for p in placements) / matches_n, 2) if matches_n else None
    avg_duration = int(sum(p.match.duration_ms for p in placements) / matches_n) if matches_n else 0

    current_streak = 0
    for p in placements:
        if p.place == 1:
            current_streak += 1
        else:
            break
    best_streak = run = 0
    for p in reversed(placements):
        run = run + 1 if p.place == 1 else 0
        best_streak = max(best_streak, run)

    # nêmesis: quem venceu as partidas que este perfil perdeu; vítimas: quem este perfil eliminou
    match_ids = [p.match_id for p in placements]
    winners = {
        w.match_id: w for w in MatchPlacement.objects.filter(match_id__in=match_ids, place=1).select_related('profile')
    }
    rivals = {}
    for p in placements:
        if p.place == 1:
            continue
        w = winners.get(p.match_id)
        if w:
            key = w.profile_id or w.name
            r = rivals.setdefault(key, {'name': w.profile.name if w.profile else w.name, 'profile_id': w.profile_id, 'times': 0})
            r['times'] += 1
    nemesis = sorted(rivals.values(), key=lambda r: -r['times'])[:3]

    victims = {}
    for v in MatchPlacement.objects.filter(match_id__in=match_ids).exclude(eliminated_by='').select_related('profile'):
        if v.eliminated_by.strip().lower() == profile.name.strip().lower():
            key = v.profile_id or v.name
            r = victims.setdefault(key, {'name': v.profile.name if v.profile else v.name, 'profile_id': v.profile_id, 'times': 0})
            r['times'] += 1
    victims_l = sorted(victims.values(), key=lambda r: -r['times'])[:3]

    recent = [
        {'match_id': p.match_id, 'ended_at': p.match.ended_at, 'place': p.place,
         'points': p.points, 'players': p.match.player_count}
        for p in placements[:10]
    ]
    achievements = [ach.serialize(a, profile.name) for a in Achievement.objects.filter(profile=profile)]

    def rank_in(rows):
        for r in rows:
            if r['profile_id'] == profile.id:
                return r['rank']
        return None
    cfg = seasons.get_settings()
    s_start, s_end, _ = seasons.season_datetimes(cfg=cfg)

    # Elo + histórico
    elo_ratings, elo_hist = scoring.compute_elo()
    elo_now = elo_ratings.get(profile.id, scoring.ELO_START)
    elo_history = [{'match_id': mid, 'at': at, 'elo': e} for mid, at, e in elo_hist.get(profile.id, [])]

    # Decks: winrate por deck e por cor
    decks = {}
    colors = {}
    for p in placements:
        key = p.deck_id or (p.deck_name or None)
        if key:
            d = decks.setdefault(key, {'deck_id': p.deck_id, 'name': p.deck_name or (p.deck.name if p.deck else ''), 'colors': p.deck_colors, 'matches': 0, 'wins': 0})
            d['matches'] += 1
            if p.place == 1:
                d['wins'] += 1
        for c in (p.deck_colors or ''):
            cc = colors.setdefault(c, {'color': c, 'matches': 0, 'wins': 0})
            cc['matches'] += 1
            if p.place == 1:
                cc['wins'] += 1
    for d in list(decks.values()) + list(colors.values()):
        d['win_rate'] = round(100.0 * d['wins'] / d['matches'], 1) if d['matches'] else 0.0
    deck_stats = sorted(decks.values(), key=lambda d: (-d['matches'], -d['wins']))
    color_stats = sorted(colors.values(), key=lambda d: (-d['matches'], -d['wins']))

    # ----- v2.3.0: análises extras -----
    # Confrontos diretos: por adversário, partidas juntos, quem venceu, quem eliminou quem.
    all_pl = list(MatchPlacement.objects.filter(match_id__in=match_ids).select_related('profile'))
    by_match = {}
    for pl in all_pl:
        by_match.setdefault(pl.match_id, []).append(pl)
    mine = {p.match_id: p for p in placements}
    me_name = profile.name.strip().lower()
    h2h = {}
    for mid, pls in by_match.items():
        my = mine.get(mid)
        if not my:
            continue
        for o in pls:
            if o.id == my.id:
                continue
            key = o.profile_id or ('n:' + o.name.strip().lower())
            r = h2h.setdefault(key, {
                'profile_id': o.profile_id, 'name': o.profile.name if o.profile else o.name,
                'photo_url': _abs(request, o.profile.photo.url) if o.profile and o.profile.photo else None,
                'matches': 0, 'my_wins': 0, 'their_wins': 0, 'i_beat_them': 0, 'they_beat_me': 0, '_places': [],
            })
            r['matches'] += 1
            r['_places'].append(my.place)
            if my.place == 1:
                r['my_wins'] += 1
            if o.place == 1:
                r['their_wins'] += 1
            if (o.eliminated_by or '').strip().lower() == me_name:
                r['i_beat_them'] += 1
            o_name = (o.profile.name if o.profile else o.name).strip().lower()
            if (my.eliminated_by or '').strip().lower() == o_name:
                r['they_beat_me'] += 1
    head_to_head = []
    for r in h2h.values():
        pl_ = r.pop('_places')
        r['my_avg_place'] = round(sum(pl_) / len(pl_), 2) if pl_ else None
        head_to_head.append(r)
    head_to_head.sort(key=lambda r: (-r['matches'], r['name'].lower()))

    form = [{'place': p.place, 'players': p.match.player_count, 'match_id': p.match_id} for p in placements[:10]]

    months = {}
    for p in placements:
        d = timezone.localtime(p.match.ended_at)
        key = d.strftime('%Y-%m')
        m = months.setdefault(key, {'month': key, 'label': d.strftime('%m/%y'), 'matches': 0, 'wins': 0, 'points': 0})
        m['matches'] += 1
        m['points'] += p.points
        if p.place == 1:
            m['wins'] += 1
    by_month = sorted(months.values(), key=lambda m: m['month'])[-12:]
    best_month = max(months.values(), key=lambda m: (m['wins'], m['matches']), default=None)
    if best_month:
        best_month = {'label': best_month['label'], 'wins': best_month['wins'], 'matches': best_month['matches']}

    by_pc = {}
    for p in placements:
        n = p.match.player_count
        r = by_pc.setdefault(n, {'players': n, 'matches': 0, 'wins': 0})
        r['matches'] += 1
        if p.place == 1:
            r['wins'] += 1
    for r in by_pc.values():
        r['win_rate'] = round(100.0 * r['wins'] / r['matches'], 1) if r['matches'] else 0.0
    by_player_count = sorted(by_pc.values(), key=lambda r: r['players'])

    max_place = max((p.place for p in placements), default=0)
    place_dist = [{'place': i, 'count': sum(1 for p in placements if p.place == i)} for i in range(1, max_place + 1)]

    wd_labels = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
    wd = {i: {'day': i, 'label': wd_labels[i], 'matches': 0, 'wins': 0} for i in range(7)}
    for p in placements:
        d = timezone.localtime(p.match.ended_at).weekday()
        wd[d]['matches'] += 1
        if p.place == 1:
            wd[d]['wins'] += 1
    weekday = [wd[i] for i in range(7)]

    kills = sum(1 for o in all_pl if (o.eliminated_by or '').strip().lower() == me_name and o.profile_id != profile.id)
    commander_deaths_total = sum(p.commander_deaths or 0 for p in placements)
    win_lives = [p.final_life for p in placements if p.place == 1 and p.final_life is not None]
    avg_final_life_wins = round(sum(win_lives) / len(win_lives), 1) if win_lives else None
    durations = [p.match.duration_ms for p in placements if p.match.duration_ms]
    top_deck = None
    if deck_stats:
        td = max(deck_stats, key=lambda d: (d['matches'], d['wins']))
        top_deck = {'name': td['name'], 'colors': td['colors'], 'matches': td['matches'], 'win_rate': td['win_rate']}

    return Response({
        'head_to_head': head_to_head,
        'form': form,
        'by_month': by_month,
        'by_player_count': by_player_count,
        'place_dist': place_dist,
        'weekday': weekday,
        'kills': kills,
        'commander_deaths_total': commander_deaths_total,
        'avg_final_life_wins': avg_final_life_wins,
        'longest_ms': max(durations) if durations else 0,
        'shortest_ms': min(durations) if durations else 0,
        'total_time_ms': sum(durations) if durations else 0,
        'first_match_at': placements[-1].match.ended_at if placements else None,
        'last_match_at': placements[0].match.ended_at if placements else None,
        'points_per_match': round(points / matches_n, 2) if matches_n else 0,
        'best_month': best_month,
        'top_deck': top_deck,
        'elo': elo_now,
        'elo_history': elo_history,
        'trophies': _trophies_for(request, profile.id),
        'deck_stats': deck_stats,
        'color_stats': color_stats,
        'profile': ProfileSerializer(profile, context={'request': request}).data,
        'points': points,
        'matches': matches_n,
        'wins': wins,
        'podiums': podiums,
        'last_places': last_places,
        'win_rate': round(100.0 * wins / matches_n, 1) if matches_n else 0.0,
        'avg_place': avg_place,
        'current_streak': current_streak,
        'best_streak': best_streak,
        'avg_duration_ms': avg_duration,
        'nemesis': nemesis,
        'victims': victims_l,
        'recent': recent,
        'achievements': achievements,
        'rank_all': rank_in(_aggregate(request, tiebreak=cfg['tiebreak'])),
        'rank_season': rank_in(_aggregate(request, s_start, s_end, cfg['tiebreak'])),
    })


@api_view(['GET'])
def achievements_catalog(request):
    return Response([{'key': k, **v} for k, v in ach.CATALOG.items()])


# ----- settings (temporada / desempate) ------------------------------------

@api_view(['GET', 'POST'])
def season_settings(request):
    if request.method == 'POST':
        err = _check_key(request)
        if err:
            return err
        try:
            seasons.save_settings(request.data)
            if 'scoring_mode' in request.data:
                scoring.set_mode(request.data['scoring_mode'])
        except (ValueError, TypeError) as e:
            return Response({'detail': str(e)}, status=400)
    cfg = seasons.get_settings()
    start, end, label = seasons.season_bounds(cfg=cfg)
    return Response({
        **cfg,
        'scoring_mode': scoring.get_mode(),
        'current_season': {'start': start.isoformat(), 'end': end.isoformat(), 'label': label},
    })


# ----- decks ----------------------------------------------------------------

@api_view(['GET', 'POST'])
def profile_decks(request, pk):
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        raise Http404
    if request.method == 'GET':
        return Response(DeckSerializer(profile.decks.filter(active=True), many=True).data)
    err = _check_key(request)
    if err:
        return err
    data = {**request.data, 'profile': profile.id}
    ser = DeckSerializer(data=data)
    ser.is_valid(raise_exception=True)
    deck = ser.save(profile=profile)
    return Response(DeckSerializer(deck).data, status=201)


@api_view(['PATCH', 'DELETE'])
def deck_detail(request, pk):
    err = _check_key(request)
    if err:
        return err
    try:
        deck = Deck.objects.get(pk=pk)
    except Deck.DoesNotExist:
        raise Http404
    if request.method == 'DELETE':
        deck.active = False
        deck.save(update_fields=['active'])
        return Response(status=204)
    ser = DeckSerializer(deck, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)


# ----- sons por perfil (servidor) ------------------------------------------

@api_view(['PUT', 'POST', 'DELETE'])
@parser_classes([MultiPartParser, FormParser])
def profile_sound(request, pk, kind):
    err = _check_key(request)
    if err:
        return err
    if kind not in ('death', 'win', 'damage'):
        return Response({'detail': 'kind inválido'}, status=400)
    try:
        profile = Profile.objects.get(pk=pk)
    except Profile.DoesNotExist:
        raise Http404
    if request.method == 'DELETE':
        ProfileSound.objects.filter(profile=profile, kind=kind).delete()
        return Response(status=204)
    f = request.FILES.get('file')
    if not f:
        return Response({'file': 'Arquivo obrigatório.'}, status=400)
    if f.size > 3 * 1024 * 1024:
        return Response({'file': 'Som maior que 3 MB.'}, status=400)
    snd, _ = ProfileSound.objects.get_or_create(profile=profile, kind=kind)
    ext = (f.name.rsplit('.', 1)[-1] if '.' in f.name else 'mp3')[:5]
    snd.file.save(f'{profile.slug}-{kind}.{ext}', f, save=True)
    return Response(ProfileSerializer(profile, context={'request': request}).data)


# ----- mesa ao vivo ---------------------------------------------------------

def _table_public(table):
    return {
        'code': table.code, 'allow_edits': table.allow_edits, 'state': table.state,
        'version': table.version, 'active': table.active, 'updated_at': table.updated_at,
    }


@api_view(['POST'])
def live_create(request):
    err = _check_key(request)
    if err:
        return err
    device = (request.headers.get('X-LC-Device') or '')[:80]
    allow = str(request.data.get('allow_edits', '')).lower() in ('1', 'true', 'yes')
    # Reaproveita mesa ativa do mesmo host (reabrir o app não cria outra).
    LiveTable.objects.filter(host_device=device, active=True).update(active=False)
    for _ in range(10):
        code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(5))
        if not LiveTable.objects.filter(code=code).exists():
            break
    table = LiveTable.objects.create(
        code=code, host_device=device, host_token=secrets.token_urlsafe(24),
        allow_edits=allow, state=request.data.get('state') or {}, version=1,
    )
    return Response({**_table_public(table), 'host_token': table.host_token}, status=201)


@api_view(['GET'])
def live_get(request, code):
    try:
        table = LiveTable.objects.get(code=code.upper())
    except LiveTable.DoesNotExist:
        raise Http404
    try:
        since_v = int(request.query_params.get('version', '-1'))
    except ValueError:
        since_v = -1
    if since_v == table.version:
        return Response({'code': table.code, 'version': table.version, 'unchanged': True, 'active': table.active, 'allow_edits': table.allow_edits})
    return Response(_table_public(table))


@api_view(['PUT', 'POST'])
def live_push(request, code):
    """Host publica o estado inteiro (exige host_token)."""
    try:
        table = LiveTable.objects.get(code=code.upper())
    except LiveTable.DoesNotExist:
        raise Http404
    if request.headers.get('X-LC-Host') != table.host_token:
        return Response({'detail': 'host_token inválido'}, status=403)
    state = request.data.get('state')
    if isinstance(state, dict):
        table.state = state
    if 'allow_edits' in request.data:
        table.allow_edits = str(request.data.get('allow_edits')).lower() in ('1', 'true', 'yes')
    if 'active' in request.data:
        table.active = str(request.data.get('active')).lower() in ('1', 'true', 'yes')
    table.version += 1
    table.save()
    # Devolve as ações pendentes dos convidados pro host aplicar.
    pending = list(table.actions.filter(applied=False).order_by('id')[:50])
    actions = [{'id': a.id, 'device': a.device, **a.payload} for a in pending]
    if pending:
        LiveAction.objects.filter(id__in=[a.id for a in pending]).update(applied=True)
    return Response({'version': table.version, 'actions': actions})


@api_view(['POST'])
def live_action(request, code):
    """Convidado pede uma mudança (só se a mesa permitir edições)."""
    try:
        table = LiveTable.objects.get(code=code.upper())
    except LiveTable.DoesNotExist:
        raise Http404
    if not table.active:
        return Response({'detail': 'mesa encerrada'}, status=410)
    if not table.allow_edits:
        return Response({'detail': 'o criador da mesa não liberou edições'}, status=403)
    payload = request.data if isinstance(request.data, dict) else {}
    kind = payload.get('type')
    if kind not in ('life', 'commander', 'counter'):
        return Response({'detail': 'type inválido'}, status=400)
    LiveAction.objects.create(table=table, device=(request.headers.get('X-LC-Device') or '')[:80], payload=dict(payload))
    return Response({'ok': True, 'queued': table.actions.filter(applied=False).count()}, status=202)


# ----- notifications (o APK consulta em segundo plano) ----------------------

@api_view(['GET'])
def notifications(request):
    """
    Lista o que aconteceu desde `since` para o perfil `profile` (opcional):
    nova versão do APK, temporada fechada, alguém ultrapassou no ranking da
    temporada, conquistas novas.
    """
    now = timezone.now()
    # '+' do offset vira espaço na query string; aceita os dois.
    since_raw = (request.query_params.get('since') or '').strip().replace(' ', '+')
    since = parse_datetime(since_raw) if since_raw else None
    if since is None:
        since = now - timezone.timedelta(days=1)
    if timezone.is_naive(since):
        since = timezone.make_aware(since)
    try:
        version_code = int(request.query_params.get('version_code', '0'))
    except ValueError:
        version_code = 0
    profile_id = request.query_params.get('profile')
    try:
        profile_id = int(profile_id) if profile_id else None
    except ValueError:
        profile_id = None

    out = []
    latest = AppVersion.objects.first()
    if latest and latest.version_code > version_code and version_code > 0:
        out.append({
            'id': f'update-{latest.version_code}', 'kind': 'update',
            'title': f'LifeCounter v{latest.version_name} disponível',
            'body': (latest.changelog or 'Abra o app e toque em Atualização.')[:200],
            'at': latest.created_at,
        })

    cfg = seasons.get_settings()
    s_start, s_end, label = seasons.season_datetimes(cfg=cfg)
    p_start, p_end, p_label = seasons.previous_season_datetimes(cfg=cfg)
    # A temporada anterior fechou entre since e now?
    if since < s_start <= now:
        rows = _aggregate(request, p_start, p_end, cfg['tiebreak'])
        champ = rows[0]['name'] if rows else None
        out.append({
            'id': f'season-{p_start.date().isoformat()}', 'kind': 'season_closed',
            'title': f'{p_label} encerrada',
            'body': f'Campeão: {champ}. Nova temporada ({label}) começou!' if champ else f'Nova temporada ({label}) começou!',
            'at': s_start,
        })

    if profile_id:
        now_rows = _aggregate(request, s_start, s_end, cfg['tiebreak'])
        then_rows = _aggregate(request, s_start, min(since, s_end), cfg['tiebreak'])
        my_now = next((r for r in now_rows if r['profile_id'] == profile_id), None)
        my_then = next((r for r in then_rows if r['profile_id'] == profile_id), None)
        if my_now and my_then and my_now['rank'] > my_then['rank']:
            def was_below(r):
                t = next((t for t in then_rows if t['profile_id'] == r['profile_id']), None)
                return t is None or t['rank'] > my_then['rank']
            passers = [r['name'] for r in now_rows
                       if r['rank'] < my_now['rank'] and r['profile_id'] != profile_id and was_below(r)]
            if passers:
                out.append({
                    'id': f'overtaken-{profile_id}-{int(now.timestamp())}', 'kind': 'overtaken',
                    'title': f'{", ".join(passers[:3])} te ultrapassou no ranking',
                    'body': f'Você caiu de {my_then["rank"]}º para {my_now["rank"]}º em {label}.',
                    'at': now,
                })
        for a in Achievement.objects.filter(profile_id=profile_id, earned_at__gt=since):
            meta = ach.CATALOG.get(a.key, {'title': a.key, 'icon': '🏅', 'description': ''})
            out.append({
                'id': f'ach-{a.id}', 'kind': 'achievement',
                'title': f'{meta["icon"]} Conquista: {meta["title"]}',
                'body': meta['description'],
                'at': a.earned_at,
            })

    return Response({'now': now, 'notifications': out})


# ----- app update -----------------------------------------------------------

@api_view(['GET'])
def check_update(request):
    try:
        current = int(request.query_params.get('version_code', request.query_params.get('current_version_code', '0')))
    except ValueError:
        current = 0
    latest = AppVersion.objects.first()
    if not latest:
        return Response({'update_available': False, 'current_version_code': current})
    data = AppVersionSerializer(latest, context={'request': request}).data
    data['update_available'] = latest.version_code > current
    data['current_version_code'] = current
    return Response(data)


@api_view(['GET', 'HEAD'])
def download_apk(request):
    latest = AppVersion.objects.first()
    if not latest or not latest.apk_file:
        raise Http404
    resp = FileResponse(latest.apk_file.open('rb'), content_type='application/vnd.android.package-archive')
    resp['Content-Disposition'] = f'attachment; filename="LifeCounter-v{latest.version_name}.apk"'
    return resp
