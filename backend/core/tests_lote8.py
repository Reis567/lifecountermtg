"""
Lote 8 (v2.7.0): tabela do ranking estilo campeonato (forma, eliminações,
subiu/desceu), desempate por sexo (mulher na frente) e por vezes sorteado
como viado, marca de viado gravada na colocação, sexo no perfil.
"""
import uuid
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Match, MatchPlacement, Profile

KEY = {'HTTP_X_LC_KEY': 'lc-mesa-2026'}


def _match(players, minutes_ago=10, viado=None, eliminated_by=None):
    """players: lista de (profile, place). viado: perfil sorteado. eliminated_by: {perfil: nome}."""
    ended = timezone.now() - timedelta(minutes=minutes_ago)
    m = Match.objects.create(
        started_at=ended - timedelta(minutes=30), ended_at=ended, duration_ms=1800000,
        mode='standard', player_count=len(players), starting_life=40, source='web', device='t',
        events=[], client_id=str(uuid.uuid4()),
    )
    for prof, place in players:
        MatchPlacement.objects.create(
            match=m, profile=prof, name=prof.name, place=place, points=len(players) - place + 1,
            viado=(viado is not None and viado.pk == prof.pk),
            eliminated_by=(eliminated_by or {}).get(prof, ''),
        )
    return m


class Lote8Tests(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze', gender='m')
        self.reis = Profile.objects.create(name='Reis', slug='reis', gender='m')
        self.laura = Profile.objects.create(name='Laura', slug='laura', gender='f')
        self.leo = Profile.objects.create(name='Leo', slug='leo')

    def _rows(self, period='all'):
        r = self.c.get(f'/api/ranking/?period={period}')
        self.assertEqual(r.status_code, 200)
        return r.data, [x['name'] for x in r.data['rows']]

    def test_tiebreak_gender_then_viado(self):
        # Todo mundo com 3 pontos: Zé 1º (3), Laura 1º (3), Reis 1º (3) em mesas de 3 cada.
        # Leo sempre 3º. Reis foi o viado uma vez.
        _match([(self.ze, 1), (self.laura, 2), (self.leo, 3)], minutes_ago=30)          # Zé 3, Laura 2, Leo 1
        _match([(self.laura, 1), (self.reis, 2), (self.leo, 3)], minutes_ago=20, viado=self.reis)  # Laura 3, Reis 2, Leo 1
        _match([(self.reis, 1), (self.ze, 2), (self.leo, 3)], minutes_ago=10)           # Reis 3, Zé 2, Leo 1
        # Totais: Zé 5, Laura 5, Reis 5, Leo 3. Mesmas vitórias (1) e partidas (2).
        data, names = self._rows()
        self.assertEqual(names, ['Laura', 'Reis', 'Zé', 'Leo'])
        rows = {r['name']: r for r in data['rows']}
        self.assertEqual(rows['Laura']['gender'], 'f')
        self.assertEqual(rows['Reis']['viado_count'], 1)
        self.assertIsNone(rows['Laura']['tie'])          # primeiro critério decidiu contra ninguém acima
        self.assertEqual(rows['Reis']['tie'], 'gender')   # perdeu pra Laura no sexo
        self.assertEqual(rows['Zé']['tie'], 'viado')      # perdeu pro Reis no viado
        self.assertIsNone(rows['Leo']['tie'])             # pontos já decidem
        self.assertEqual([c['key'] for c in data['criteria']], ['points', 'gender', 'viado', 'wins', 'matches', 'name'])

    def test_tiebreak_wins_mode_keeps_gender_second(self):
        from .models import AppSetting
        AppSetting.set('season', {'tiebreak': 'wins'})
        _match([(self.ze, 1), (self.laura, 2)], minutes_ago=30)   # Zé 2, Laura 1
        _match([(self.laura, 1), (self.ze, 2)], minutes_ago=20)   # Laura 2+1=3, Zé 2+1=3
        data, names = self._rows()
        self.assertEqual(names, ['Laura', 'Zé'])
        self.assertEqual(data['criteria'][0]['key'], 'wins')
        self.assertEqual(data['criteria'][1]['key'], 'gender')

    def test_form_kills_losses_prev_rank(self):
        for i in range(6):
            # Zé vence sempre e elimina o Reis; Reis 2º, Leo 3º
            _match([(self.ze, 1), (self.reis, 2), (self.leo, 3)], minutes_ago=60 - i * 5,
                   eliminated_by={self.reis: 'Zé', self.leo: 'Reis'})
        data, names = self._rows()
        rows = {r['name']: r for r in data['rows']}
        self.assertEqual(len(rows['Zé']['form']), 5)
        self.assertTrue(all(f['place'] == 1 and f['players'] == 3 for f in rows['Zé']['form']))
        self.assertEqual(rows['Zé']['kills'], 6)
        self.assertEqual(rows['Reis']['kills'], 6)
        self.assertEqual(rows['Leo']['kills'], 0)
        self.assertEqual(rows['Zé']['losses'], 0)
        self.assertEqual(rows['Reis']['losses'], 6)
        self.assertEqual(rows['Zé']['prev_rank'], 1)
        self.assertEqual(rows['Leo']['prev_rank'], 3)

    def test_self_elimination_not_counted_as_kill(self):
        _match([(self.ze, 1), (self.reis, 2)], eliminated_by={self.reis: 'Reis'})
        data, _ = self._rows()
        rows = {r['name']: r for r in data['rows']}
        self.assertEqual(rows['Reis']['kills'], 0)

    def test_viado_saved_from_app_payload_and_profile_stats(self):
        now = int(timezone.now().timestamp() * 1000)
        payload = {
            'client_id': 'm_' + str(uuid.uuid4()), 'started_at_ms': now - 1800000, 'ended_at_ms': now,
            'duration_ms': 1800000, 'mode': 'standard', 'manual': False, 'player_count': 3, 'starting_life': 40,
            'source': 'web', 'device': 't', 'events': [],
            'placements': [
                {'profile_id': self.ze.pk, 'name': 'Zé', 'place': 1, 'points': 3},
                {'profile_id': self.reis.pk, 'name': 'Reis', 'place': 2, 'points': 2, 'viado': True},
                {'profile_id': self.leo.pk, 'name': 'Leo', 'place': 3, 'points': 1},
            ],
        }
        r = self.c.post('/api/matches/', payload, format='json', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        pl = {p['name']: p for p in r.data['placements']}
        self.assertTrue(pl['Reis']['viado'])
        self.assertFalse(pl['Zé']['viado'])
        s = self.c.get(f'/api/profiles/{self.reis.pk}/stats/')
        self.assertEqual(s.data['viado_count'], 1)
        self.assertEqual(s.data['profile']['gender'], 'm')

    def test_profile_gender_patch(self):
        r = self.c.patch(f'/api/profiles/{self.leo.pk}/', {'gender': 'f'}, **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['gender'], 'f')
        r = self.c.patch(f'/api/profiles/{self.leo.pk}/', {'gender': 'x'}, **KEY)
        self.assertEqual(r.status_code, 400)
        r = self.c.patch(f'/api/profiles/{self.leo.pk}/', {'gender': ''}, **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['gender'], '')
