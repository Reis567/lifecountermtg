from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Match, Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'test-dev'}


def ms(dt):
    return int(dt.timestamp() * 1000)


@override_settings(MEDIA_ROOT=__import__('tempfile').mkdtemp(prefix='lc-lote6-'))
class Lote6Tests(TestCase):
    """v2.5.0: motivo da morte, quem começou, estatísticas no perfil."""

    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze')
        self.reis = Profile.objects.create(name='Reis', slug='reis')
        self.laura = Profile.objects.create(name='Laura', slug='laura')

    def _match(self, cid, order, causes, starter, eliminated_by):
        now = timezone.now()
        n = len(order)
        placements = [{
            'profile_id': p.id, 'name': p.name, 'place': i + 1, 'points': n - i,
            'eliminated_by': eliminated_by.get(p.id, ''), 'death_cause': causes.get(p.id, ''),
        } for i, p in enumerate(order)]
        body = {'client_id': cid, 'started_at_ms': ms(now - timedelta(minutes=90)), 'ended_at_ms': ms(now),
                'duration_ms': 90 * 60000, 'mode': 'standard', 'manual': False, 'source': 'web', 'events': [],
                'placements': placements, 'starter_profile_id': starter.id if starter else None}
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_death_cause_and_starter_roundtrip(self):
        d = self._match('l6-1', [self.ze, self.reis, self.laura], {self.reis.id: 'combo', self.laura.id: 'commander'},
                        self.laura, {self.reis.id: 'Zé', self.laura.id: 'Zé'})
        self.assertEqual(d['starter_profile_id'], self.laura.id)
        pls = {p['name']: p for p in d['placements']}
        self.assertEqual(pls['Reis']['death_cause'], 'combo')
        self.assertEqual(pls['Laura']['death_cause'], 'commander')
        self.assertEqual(Match.objects.get(client_id='l6-1').starter_profile_id, self.laura.id)

    def test_profile_stats_causes_and_starts(self):
        self._match('l6-a', [self.ze, self.reis, self.laura], {self.reis.id: 'combo', self.laura.id: 'commander'},
                    self.laura, {self.reis.id: 'Zé', self.laura.id: 'Zé'})
        self._match('l6-b', [self.reis, self.ze, self.laura], {self.ze.id: 'poison', self.laura.id: 'combo'},
                    self.ze, {self.ze.id: 'Reis', self.laura.id: 'Reis'})
        self._match('l6-c', [self.ze, self.laura, self.reis], {self.laura.id: 'combat', self.reis.id: 'combat'},
                    self.ze, {self.laura.id: 'Zé', self.reis.id: 'Laura'})
        s = self.c.get(f'/api/profiles/{self.ze.id}/stats/').data
        self.assertEqual(s['starts'], 2)
        self.assertEqual(s['starts_rate'], 66.7)
        self.assertEqual(s['death_causes'], [{'cause': 'poison', 'label': 'Veneno', 'count': 1}])
        kills = {k['cause']: k['count'] for k in s['kill_causes']}
        self.assertEqual(kills, {'combo': 1, 'commander': 1, 'combat': 1})
        # sem death_cause informado não entra na distribuição
        s2 = self.c.get(f'/api/profiles/{self.laura.id}/stats/').data
        self.assertEqual(s2['starts'], 1)
        self.assertEqual({k['cause'] for k in s2['death_causes']}, {'commander', 'combo', 'combat'})
