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

from . import achievements as ach
from . import seasons
from .models import Achievement, AppVersion, Match, MatchPlacement, Profile
from .serializers import AppVersionSerializer, MatchSerializer, ProfileSerializer


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

def _aggregate(request, start=None, end=None, tiebreak='points'):
    qs = MatchPlacement.objects.select_related('profile', 'match')
    if start:
        qs = qs.filter(match__ended_at__gte=start)
    if end:
        qs = qs.filter(match__ended_at__lt=end)

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
                'last_played': None,
            }
        row['points'] += p.points
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
    start, end = _period_range(period)
    result = _aggregate(request, start, end, tiebreak)
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
        'total_matches': mq.count(),
        'rows': result,
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

    return Response({
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
        except (ValueError, TypeError) as e:
            return Response({'detail': str(e)}, status=400)
    cfg = seasons.get_settings()
    start, end, label = seasons.season_bounds(cfg=cfg)
    return Response({
        **cfg,
        'current_season': {'start': start.isoformat(), 'end': end.isoformat(), 'label': label},
    })


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
