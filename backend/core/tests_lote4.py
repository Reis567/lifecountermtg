from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AppSetting, Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'test-dev'}


def ms(dt):
    return int(dt.timestamp() * 1000)


@override_settings(MEDIA_ROOT=__import__('tempfile').mkdtemp(prefix='lc-lote4-'))
class Lote4Tests(TestCase):
    """v2.4.0: resumo da temporada, corrida de pontos e prêmios automáticos."""

    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze')
        self.reis = Profile.objects.create(name='Reis', slug='reis')
        self.laura = Profile.objects.create(name='Laura', slug='laura')
        # temporada de 1 mês ancorada no início do ano: tudo que rolar "agora" cai na atual
        AppSetting.set('season', {'season_months': 1, 'season_start': '2026-01-01', 'tiebreak': 'points'})

    def _match(self, cid, ended, order, eliminated_by=None, deck=None, duration_min=30):
        n = len(order)
        placements = []
        for i, p in enumerate(order):
            pl = {'profile_id': p.id, 'name': p.name, 'place': i + 1, 'points': n - i,
                  'eliminated_by': (eliminated_by or {}).get(p.id, ''), 'deck_name': (deck or {}).get(p.id, '')}
            placements.append(pl)
        body = {'client_id': cid, 'started_at_ms': ms(ended - timedelta(minutes=duration_min)), 'ended_at_ms': ms(ended),
                'duration_ms': duration_min * 60000, 'mode': 'standard', 'manual': False, 'source': 'web', 'events': [],
                'placements': placements}
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertIn(r.status_code, (200, 201), r.data)
        return r.data

    def test_season_summary_and_race(self):
        now = timezone.now()
        self._match('s1', now - timedelta(hours=3), [self.ze, self.reis, self.laura],
                    eliminated_by={self.reis.id: 'Zé', self.laura.id: 'Zé'}, deck={self.ze.id: 'Atraxa'}, duration_min=90)
        self._match('s2', now - timedelta(hours=2), [self.ze, self.reis, self.laura],
                    eliminated_by={self.laura.id: 'Zé'}, deck={self.ze.id: 'Atraxa'}, duration_min=20)
        self._match('s3', now - timedelta(hours=1), [self.laura, self.ze, self.reis], deck={self.laura.id: 'Ur-Dragon'}, duration_min=40)
        r = self.c.get('/api/seasons/summary/')
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual(d['matches'], 3)
        self.assertEqual(d['leader']['name'], 'Zé')
        self.assertEqual(d['longest_match']['duration_ms'], 90 * 60000)
        self.assertEqual(d['longest_match']['winner'], 'Zé')
        self.assertEqual(d['commander']['name'], 'Atraxa')
        self.assertEqual(d['commander']['wins'], 2)
        self.assertEqual(d['longest_streak']['name'], 'Zé')
        self.assertEqual(d['longest_streak']['value'], 2)
        self.assertGreaterEqual(d['days_left'], 0)
        race = d['race']
        self.assertEqual(len(race['matches']), 3)
        ze = next(s for s in race['series'] if s['name'] == 'Zé')
        self.assertEqual(ze['values'], [3, 6, 8])
        awards = {a['key']: a for a in d['awards']}
        self.assertEqual(awards['most_kills']['name'], 'Zé')
        self.assertEqual(awards['most_kills']['value'], 3)
        self.assertEqual(awards['most_matches']['value'], 3)
        self.assertEqual(awards['most_podiums']['value'], 3)
        # zebra: Laura venceu a 3ª com o menor Elo da mesa
        self.assertEqual(awards['zebra']['name'], 'Laura')

    def _old_match(self, cid, ended, order, eliminated_by=None):
        # Partida antiga entra direto pelo ORM (a API recusa partidas com mais de 7 dias).
        from .models import Match, MatchPlacement
        n = len(order)
        m = Match.objects.create(client_id=cid, started_at=ended - timedelta(minutes=30), ended_at=ended,
                                 duration_ms=1800000, player_count=n, source='web')
        for i, p in enumerate(order):
            MatchPlacement.objects.create(match=m, profile=p, name=p.name, place=i + 1, points=n - i,
                                          eliminated_by=(eliminated_by or {}).get(p.id, ''))
        return m

    def test_current_game_resume_and_conflict(self):
        A = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'dev-A'}
        B = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'dev-B'}
        state = {'players': [{'id': 'p1', 'life': 40}], 'settings': {}, 'gameStarted': True, 'currentTurn': 3}
        self.assertIsNone(self.c.get('/api/game/current/').data['state'])
        r = self.c.put('/api/game/current/', {'state': state, 'rev': 0, 'client_match_id': 'm1'}, format='json', **A)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['rev'], 1)
        r = self.c.put('/api/game/current/', {'state': state, 'rev': 1}, format='json', **A)
        self.assertEqual(r.data['rev'], 2)
        # B retoma com o rev que viu (2) e segue salvando
        g = self.c.get('/api/game/current/').data
        self.assertEqual(g['rev'], 2)
        self.assertEqual(g['state']['currentTurn'], 3)
        r = self.c.put('/api/game/current/', {'state': {**state, 'currentTurn': 4}, 'rev': 2}, format='json', **B)
        self.assertEqual(r.data['rev'], 3)
        # A, com rev velho, leva 409 com o estado novo
        r = self.c.put('/api/game/current/', {'state': state, 'rev': 2}, format='json', **A)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data['state']['currentTurn'], 4)
        self.assertEqual(r.data['client_match_id'], 'm1')
        # A força: passa a ser dela
        r = self.c.put('/api/game/current/', {'state': state, 'rev': 2, 'force': True}, format='json', **A)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.c.delete('/api/game/current/', **A).status_code, 204)
        self.assertIsNone(self.c.get('/api/game/current/').data['state'])
        self.assertEqual(self.c.put('/api/game/current/', {'state': {'x': 1}}, format='json', **A).status_code, 400)

    def test_awards_in_hall_and_profile(self):
        now = timezone.now()
        # partidas no mês passado (temporada fechada)
        last = (now.replace(day=15) - timedelta(days=31))
        self._old_match('h1', last, [self.ze, self.reis, self.laura], eliminated_by={self.reis.id: 'Zé'})
        self._old_match('h2', last + timedelta(hours=1), [self.ze, self.laura, self.reis], eliminated_by={self.laura.id: 'Zé'})
        r = self.c.get('/api/seasons/')
        closed = [s for s in r.data['seasons'] if not s['current']]
        self.assertTrue(closed)
        keys = {a['key'] for a in closed[0]['awards']}
        self.assertIn('most_kills', keys)
        self.assertIn('longest_streak', keys)
        r = self.c.get(f'/api/profiles/{self.ze.id}/stats/')
        kinds = {t['kind'] for t in r.data['trophies']}
        self.assertIn('champion', kinds)
        self.assertIn('most_kills', kinds)
