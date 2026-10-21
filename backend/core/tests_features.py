from datetime import timedelta

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import seasons
from .models import Achievement, AppVersion, Match, Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY}


def ms(dt):
    return int(dt.timestamp() * 1000)


class FeatureTests(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze', is_preset=True)
        self.reis = Profile.objects.create(name='Reis', slug='reis', is_preset=True)
        self.laura = Profile.objects.create(name='Laura', slug='laura', is_preset=True)

    def _match(self, client_id, ended, winner, others, duration_min=40, events=None, winner_life=20):
        placements = [{'profile_id': winner.id, 'name': winner.name, 'place': 1, 'points': len(others) + 1, 'final_life': winner_life}]
        for i, o in enumerate(others):
            placements.append({'profile_id': o.id, 'name': o.name, 'place': i + 2, 'points': len(others) - i, 'final_life': 0})
        body = {
            'client_id': client_id, 'started_at_ms': ms(ended - timedelta(minutes=duration_min)), 'ended_at_ms': ms(ended),
            'duration_ms': duration_min * 60000, 'mode': 'standard', 'manual': False, 'source': 'web',
            'events': events or [], 'placements': placements,
        }
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertIn(r.status_code, (200, 201), r.data)
        return r.data

    def test_aliases_roundtrip(self):
        r = self.c.patch(f'/api/profiles/{self.ze.id}/', {'aliases': 'Zezinho, Zeca ,Zezinho'}, format='multipart', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['aliases'], ['Zezinho', 'Zeca'])
        r = self.c.get('/api/profiles/')
        self.assertEqual(next(p for p in r.data if p['id'] == self.ze.id)['aliases'], ['Zezinho', 'Zeca'])

    def test_achievements_first_win_and_streak(self):
        now = timezone.now()
        d = self._match('a1', now - timedelta(days=3), self.ze, [self.reis])
        keys = {a['key'] for a in d['new_achievements']}
        self.assertIn('first_win', keys)
        self._match('a2', now - timedelta(days=2), self.ze, [self.reis])
        d = self._match('a3', now - timedelta(days=1), self.ze, [self.reis, self.laura], winner_life=1)
        keys = {a['key'] for a in d['new_achievements']}
        self.assertIn('three_wins_streak', keys)
        self.assertIn('win_at_1_life', keys)
        # Laura: último lugar... só uma vez, sem lanterninha
        self.assertFalse(Achievement.objects.filter(profile=self.laura, key='lanterninha').exists())
        # reenvio idempotente não duplica nem repete conquistas
        d = self._match('a3', now - timedelta(days=1), self.ze, [self.reis, self.laura])
        self.assertEqual(d['new_achievements'], [])
        self.assertEqual(Achievement.objects.filter(profile=self.ze, key='first_win').count(), 1)

    def test_achievements_from_events(self):
        now = timezone.now()
        events = [
            {'type': 'life_change', 'playerName': 'Zé', 'turn': 2, 'details': {'amount': -37, 'newValue': 3}},
            {'type': 'player_eliminated', 'playerName': 'Reis', 'turn': 2, 'details': {'message': 'commander', 'fromPlayerName': 'Zé'}},
            {'type': 'player_eliminated', 'playerName': 'Laura', 'turn': 5, 'details': {'message': 'poison', 'fromPlayerName': 'Zé'}},
        ]
        d = self._match('e1', now, self.ze, [self.laura, self.reis], events=events, duration_min=10)
        keys = {a['key'] for a in d['new_achievements']}
        self.assertTrue({'first_win', 'comeback', 'commander_kill', 'poison_kill', 'speedrun'} <= keys, keys)
        reis_keys = set(Achievement.objects.filter(profile=self.reis).values_list('key', flat=True))
        self.assertIn('early_death', reis_keys)

        stats = self.c.get(f'/api/profiles/{self.ze.id}/stats/').data
        self.assertEqual(stats['wins'], 1)
        self.assertEqual(stats['current_streak'], 1)
        self.assertEqual(stats['best_streak'], 1)
        self.assertEqual(stats['avg_place'], 1.0)
        self.assertTrue(any(a['key'] == 'comeback' for a in stats['achievements']))
        self.assertEqual(stats['rank_all'], 1)

    def test_season_settings_and_ranking(self):
        r = self.c.get('/api/settings/season/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['season_months'], 1)
        self.assertEqual(self.c.post('/api/settings/season/', {'season_months': 5}, format='json', **KEY).status_code, 400)
        r = self.c.post('/api/settings/season/', {'season_months': 3, 'season_start': '2026-01-01', 'tiebreak': 'wins'}, format='json', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['season_months'], 3)
        self.assertEqual(r.data['tiebreak'], 'wins')
        start, end, label = seasons.season_bounds(ref=timezone.datetime(2026, 10, 21).date())
        self.assertEqual((start.isoformat(), end.isoformat(), label), ('2026-10-01', '2027-01-01', 'T4/2026'))

        now = timezone.now()
        # Zé: 1 vitória de mesa 2 (2 pts); Reis: 2 segundos lugares de mesa 3 (2+2=4 pts) -> por pontos Reis lidera, por vitórias Zé
        self._match('s1', now - timedelta(hours=3), self.ze, [self.reis])
        self._match('s2', now - timedelta(hours=2), self.laura, [self.reis, self.ze])
        self._match('s3', now - timedelta(hours=1), self.laura, [self.reis, self.ze])
        r = self.c.get('/api/ranking/?period=season')
        self.assertEqual(r.data['tiebreak'], 'wins')
        names = [x['name'] for x in r.data['rows']]
        self.assertEqual(names[0], 'Laura')
        self.assertEqual(names[1], 'Zé')  # 1 vitória > 0 vitórias do Reis
        r = self.c.get('/api/ranking/?period=season&tiebreak=points')
        names = [x['name'] for x in r.data['rows']]
        self.assertEqual(names[1], 'Reis')  # 1+2+2 = 5 pts > Zé 2+1+1 = 4
        r = self.c.get('/api/ranking/?period=year')
        self.assertEqual(r.data['total_matches'], 3)

    def test_notifications(self):
        now = timezone.now()
        AppVersion.objects.create(version_code=11, version_name='2.1.0', apk_file='apk/x.apk')
        self._match('n1', now - timedelta(hours=5), self.ze, [self.reis])
        since = (now - timedelta(hours=1)).isoformat()
        # Reis era 2º; Laura (que nem tinha jogado) ganha duas do Zé e passa o Reis
        self._match('n2', now - timedelta(minutes=30), self.laura, [self.ze])
        self._match('n3', now - timedelta(minutes=10), self.laura, [self.ze])
        r = self.c.get(f'/api/notifications/?profile={self.reis.id}&since={since}&version_code=10')
        self.assertEqual(r.status_code, 200)
        kinds = [n['kind'] for n in r.data['notifications']]
        self.assertIn('update', kinds)
        self.assertIn('overtaken', kinds)
        ov = next(n for n in r.data['notifications'] if n['kind'] == 'overtaken')
        self.assertIn('Laura', ov['title'])
        # Zé também caiu (era 1º, Laura passou) e já está na versão nova -> sem 'update'
        r = self.c.get(f'/api/notifications/?profile={self.ze.id}&since={since}&version_code=11')
        kinds = [n['kind'] for n in r.data['notifications']]
        self.assertNotIn('update', kinds)
        self.assertIn('overtaken', kinds)
        # Laura só subiu: nada de 'overtaken'
        r = self.c.get(f'/api/notifications/?profile={self.laura.id}&since={since}&version_code=11')
        self.assertNotIn('overtaken', [n['kind'] for n in r.data['notifications']])
