"""
Temporadas configuráveis (1, 3, 6 ou 12 meses) ancoradas numa data de início,
e critério de desempate do ranking. Tudo guardado em AppSetting('season').
"""
from datetime import date, datetime, time

from django.utils import timezone

from .models import AppSetting

DEFAULTS = {'season_months': 1, 'season_start': '2026-01-01', 'tiebreak': 'points'}
VALID_MONTHS = (1, 2, 3, 4, 6, 12)


def get_settings():
    cfg = dict(DEFAULTS)
    cfg.update(AppSetting.get('season', {}) or {})
    try:
        cfg['season_months'] = int(cfg['season_months'])
    except (TypeError, ValueError):
        cfg['season_months'] = 1
    if cfg['season_months'] not in VALID_MONTHS:
        cfg['season_months'] = 1
    if cfg.get('tiebreak') not in ('points', 'wins'):
        cfg['tiebreak'] = 'points'
    return cfg


def save_settings(data):
    cfg = get_settings()
    if 'season_months' in data:
        m = int(data['season_months'])
        if m not in VALID_MONTHS:
            raise ValueError('season_months precisa ser 1, 2, 3, 4, 6 ou 12')
        cfg['season_months'] = m
    if 'season_start' in data:
        date.fromisoformat(str(data['season_start']))  # valida
        cfg['season_start'] = str(data['season_start'])
    if 'tiebreak' in data:
        if data['tiebreak'] not in ('points', 'wins'):
            raise ValueError('tiebreak precisa ser points ou wins')
        cfg['tiebreak'] = data['tiebreak']
    AppSetting.set('season', cfg)
    return cfg


def _add_months(d: date, months: int) -> date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    return date(y, m, 1)


def season_bounds(ref=None, cfg=None):
    """(start_date, end_date_exclusive, label) da temporada que contém `ref`."""
    cfg = cfg or get_settings()
    ref = ref or timezone.localdate()
    anchor = date.fromisoformat(cfg['season_start']).replace(day=1)
    months = cfg['season_months']
    # Avança/retrocede em blocos de `months` a partir da âncora.
    diff = (ref.year - anchor.year) * 12 + (ref.month - anchor.month)
    k = diff // months
    start = _add_months(anchor, k * months)
    end = _add_months(start, months)
    if months == 12:
        label = f'Temporada {start.year}'
    elif months == 1:
        label = start.strftime('%m/%Y')
    else:
        n = (start.month - 1) // months + 1
        label = f'T{n}/{start.year}'
    return start, end, label


def season_datetimes(ref=None, cfg=None):
    start, end, label = season_bounds(ref, cfg)
    tz = timezone.get_current_timezone()
    return (
        datetime.combine(start, time.min, tzinfo=tz),
        datetime.combine(end, time.min, tzinfo=tz),
        label,
    )


def previous_season_datetimes(ref=None, cfg=None):
    cfg = cfg or get_settings()
    start, _end, _label = season_bounds(ref, cfg)
    prev_ref = _add_months(start, -1)
    return season_datetimes(prev_ref, cfg)
