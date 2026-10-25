from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'test-dev'}


def ms(dt):
    return int(dt.timestamp() * 1000)


@override_settings(MEDIA_ROOT=__import__('tempfile').mkdtemp(prefix='lc-lote3-'))
class Lote3Tests(TestCase):
    """v2.3.0: análises extras do perfil + vitórias no /api/elo/."""

    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze')
        self.reis = Profile.objects.create(name='Reis', slug='reis')
        self.laura = Profile.objects.create(name='Laura', slug='laura')

    def _match(self, cid, ended, order, eliminated_by=None, final_life=None, duration_min=30):
        n = len(order)
        placements = []
        for i, p in enumerate(order):
            pl = {'profile_id': p.id, 'name': p.name, 'place': i + 1, 'points': n - i,
                  'eliminated_by': (eliminated_by or {}).get(p.id, ''),
                  'final_life': (final_life or {}).get(p.id)}
            placements.append(pl)
        body = {'client_id': cid, 'started_at_ms': ms(ended - timedelta(minutes=duration_min)), 'ended_at_ms': ms(ended),
                'duration_ms': duration_min * 60000, 'mode': 'standard', 'manual': False, 'source': 'web', 'events': [],
                'placements': placements}
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertIn(r.status_code, (200, 201), r.data)
        return r.data

    def test_profile_analytics(self):
        now = timezone.now()
        # Zé vence 2 (eliminando Reis nas duas), perde 1 pro Reis (que elimina o Zé).
        self._match('a1', now - timedelta(days=3), [self.ze, self.reis, self.laura],
                    eliminated_by={self.reis.id: 'Zé', self.laura.id: 'Zé'}, final_life={self.ze.id: 31}, duration_min=40)
        self._match('a2', now - timedelta(days=2), [self.ze, self.laura, self.reis],
                    eliminated_by={self.reis.id: 'Zé', self.laura.id: 'Laura'}, final_life={self.ze.id: 11}, duration_min=20)
        self._match('a3', now - timedelta(days=1), [self.reis, self.ze, self.laura],
                    eliminated_by={self.ze.id: 'Reis'}, duration_min=60)
        r = self.c.get(f'/api/profiles/{self.ze.id}/stats/')
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual(d['kills'], 3)
        self.assertEqual(d['avg_final_life_wins'], 21.0)
        self.assertEqual(d['longest_ms'], 60 * 60000)
        self.assertEqual(d['shortest_ms'], 20 * 60000)
        self.assertEqual(d['total_time_ms'], 120 * 60000)
        self.assertEqual([f['place'] for f in d['form']], [2, 1, 1])
        self.assertEqual(d['place_dist'], [{'place': 1, 'count': 2}, {'place': 2, 'count': 1}])
        self.assertEqual(d['by_player_count'], [{'players': 3, 'matches': 3, 'wins': 2, 'win_rate': 66.7}])
        h2h = {h['name']: h for h in d['head_to_head']}
        self.assertEqual(h2h['Reis']['matches'], 3)
        self.assertEqual(h2h['Reis']['my_wins'], 2)
        self.assertEqual(h2h['Reis']['their_wins'], 1)
        self.assertEqual(h2h['Reis']['i_beat_them'], 2)
        self.assertEqual(h2h['Reis']['they_beat_me'], 1)
        self.assertEqual(h2h['Laura']['i_beat_them'], 1)
        self.assertEqual(sum(w['matches'] for w in d['weekday']), 3)
        self.assertTrue(d['by_month'])
        self.assertEqual(d['best_month']['wins'], 2)
        self.assertEqual(d['points_per_match'], round((3 + 3 + 2) / 3, 2))

    def test_elo_rows_have_wins(self):
        now = timezone.now()
        self._match('e1', now - timedelta(hours=2), [self.ze, self.reis, self.laura])
        self._match('e2', now - timedelta(hours=1), [self.ze, self.laura, self.reis])
        r = self.c.get('/api/elo/')
        wins = {x['name']: x['wins'] for x in r.data['rows']}
        self.assertEqual(wins['Zé'], 2)
        self.assertEqual(wins['Reis'], 0)
