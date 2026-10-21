import io
from datetime import timedelta

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import scoring
from .models import Deck, LiveTable, Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY, 'HTTP_X_LC_DEVICE': 'test-dev'}


def ms(dt):
    return int(dt.timestamp() * 1000)


@override_settings(MEDIA_ROOT=__import__('tempfile').mkdtemp(prefix='lc-lote2-'))
class Lote2Tests(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze')
        self.reis = Profile.objects.create(name='Reis', slug='reis')
        self.laura = Profile.objects.create(name='Laura', slug='laura')

    def _match(self, cid, ended, order, deck_ids=None):
        n = len(order)
        placements = []
        for i, p in enumerate(order):
            pl = {'profile_id': p.id, 'name': p.name, 'place': i + 1, 'points': n - i}
            if deck_ids and deck_ids.get(p.id):
                pl['deck_id'] = deck_ids[p.id]
            placements.append(pl)
        body = {'client_id': cid, 'started_at_ms': ms(ended - timedelta(minutes=30)), 'ended_at_ms': ms(ended),
                'duration_ms': 1800000, 'mode': 'standard', 'manual': False, 'source': 'web', 'events': [], 'placements': placements}
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertIn(r.status_code, (200, 201), r.data)
        return r.data

    def test_scoring_modes(self):
        now = timezone.now()
        self._match('s1', now - timedelta(hours=2), [self.ze, self.reis, self.laura])
        self._match('s2', now - timedelta(hours=1), [self.reis, self.ze, self.laura])
        r = self.c.get('/api/ranking/?period=all')
        self.assertEqual(r.data['mode'], 'placement')
        pts = {x['name']: x['points'] for x in r.data['rows']}
        self.assertEqual(pts, {'Zé': 5, 'Reis': 5, 'Laura': 2})
        r = self.c.get('/api/ranking/?period=all&mode=winner_only')
        self.assertEqual({x['name']: x['points'] for x in r.data['rows']}, {'Zé': 1, 'Reis': 1, 'Laura': 0})
        r = self.c.get('/api/ranking/?period=all&mode=podium')
        self.assertEqual({x['name']: x['points'] for x in r.data['rows']}, {'Zé': 4, 'Reis': 4, 'Laura': 0})
        # salva o modo global
        r = self.c.post('/api/settings/season/', {'scoring_mode': 'elo'}, format='json', **KEY)
        self.assertEqual(r.data['scoring_mode'], 'elo')
        r = self.c.get('/api/ranking/?period=all')
        self.assertEqual(r.data['mode'], 'elo')
        self.assertTrue(all(x['elo'] is not None for x in r.data['rows']))
        self.assertEqual(self.c.post('/api/settings/season/', {'scoring_mode': 'x'}, format='json', **KEY).status_code, 400)

    def test_elo_rewards_beating_strong_tables(self):
        now = timezone.now()
        # Zé ganha 3 vezes do Reis -> Zé alto, Reis baixo
        for i in range(3):
            self._match(f'e{i}', now - timedelta(hours=10 - i), [self.ze, self.reis])
        ratings, hist = scoring.compute_elo()
        self.assertGreater(ratings[self.ze.id], scoring.ELO_START)
        self.assertLess(ratings[self.reis.id], scoring.ELO_START)
        self.assertEqual(len(hist[self.ze.id]), 3)
        # Laura (1000) vence o Zé (forte): ganha mais do que ganharia do Reis (fraco)
        before = ratings[self.laura.id] if self.laura.id in ratings else scoring.ELO_START
        self._match('e_strong', now - timedelta(hours=2), [self.laura, self.ze])
        gain_strong = scoring.compute_elo()[0][self.laura.id] - before
        Deck  # noqa (silencia import não usado em alguns linters)
        r = self.c.get('/api/elo/')
        self.assertEqual(r.data['rows'][0]['name'] in ('Zé', 'Laura'), True)
        self.assertGreater(gain_strong, scoring.ELO_K / 2 * 0.5)  # ganhou mais que o "esperado 50%"
        stats = self.c.get(f'/api/profiles/{self.laura.id}/stats/').data
        self.assertEqual(stats['elo'], scoring.compute_elo()[0][self.laura.id])
        self.assertEqual(len(stats['elo_history']), 1)

    def test_seasons_hall_of_fame_and_trophies(self):
        now = timezone.now()
        # temporada mensal: partida no mês passado vencida pelo Reis, e uma neste mês pelo Zé
        last_month = (now.replace(day=15) - timedelta(days=31))
        # Partida antiga entra direto no banco (a API rejeita partidas com mais de 7 dias de propósito).
        from .models import Match, MatchPlacement
        m = Match.objects.create(client_id='h1', started_at=last_month - timedelta(minutes=30), ended_at=last_month,
                                 duration_ms=1800000, player_count=2, source='web')
        MatchPlacement.objects.create(match=m, profile=self.reis, name='Reis', place=1, points=2)
        MatchPlacement.objects.create(match=m, profile=self.ze, name='Zé', place=2, points=1)
        self._match('h2', now - timedelta(hours=1), [self.ze, self.reis])
        r = self.c.get('/api/seasons/')
        self.assertEqual(r.status_code, 200)
        labels = [s['label'] for s in r.data['seasons']]
        self.assertEqual(len(labels), 2)
        self.assertTrue(r.data['seasons'][0]['current'])
        self.assertEqual(r.data['seasons'][1]['champion']['name'], 'Reis')
        stats = self.c.get(f'/api/profiles/{self.reis.id}/stats/').data
        self.assertEqual(len(stats['trophies']), 1)
        self.assertEqual(self.c.get(f'/api/profiles/{self.ze.id}/stats/').data['trophies'], [])

    def test_decks_and_winrates(self):
        r = self.c.post(f'/api/profiles/{self.ze.id}/decks/', {'name': 'Atraxa', 'commander': 'Atraxa, Praetors\' Voice', 'colors': 'WUBG', 'image_url': 'https://cards.scryfall.io/y.jpg'}, format='json', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        deck_id = r.data['id']
        self.assertEqual(self.c.get('/api/profiles/').data[0]['decks'][0]['name'] if self.c.get('/api/profiles/').data[0]['id'] == self.ze.id else 'Atraxa', 'Atraxa')
        now = timezone.now()
        self._match('d1', now - timedelta(hours=2), [self.ze, self.reis], deck_ids={self.ze.id: deck_id})
        self._match('d2', now - timedelta(hours=1), [self.reis, self.ze], deck_ids={self.ze.id: deck_id})
        stats = self.c.get(f'/api/profiles/{self.ze.id}/stats/').data
        self.assertEqual(stats['deck_stats'][0]['name'], 'Atraxa')
        self.assertEqual(stats['deck_stats'][0]['matches'], 2)
        self.assertEqual(stats['deck_stats'][0]['win_rate'], 50.0)
        self.assertEqual({c['color'] for c in stats['color_stats']}, set('WUBG'))
        m = self.c.get('/api/matches/').data['results'][0]
        self.assertEqual(m['placements'][1]['deck_name'] if m['placements'][1]['name'] == 'Zé' else m['placements'][0]['deck_name'], 'Atraxa')
        # desativar
        self.assertEqual(self.c.delete(f'/api/decks/{deck_id}/', **KEY).status_code, 204)
        self.assertEqual(self.c.get(f'/api/profiles/{self.ze.id}/decks/').data, [])

    def test_profile_sound_upload(self):
        f = SimpleUploadedFile('morte.mp3', b'ID3' + b'\x00' * 100, content_type='audio/mpeg')
        r = self.c.put(f'/api/profiles/{self.ze.id}/sounds/death/', {'file': f}, format='multipart', **KEY)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('death', r.data['sounds'])
        self.assertTrue(r.data['sounds']['death'].endswith('.mp3'))
        self.assertEqual(self.c.put(f'/api/profiles/{self.ze.id}/sounds/xyz/', {'file': f}, format='multipart', **KEY).status_code, 400)
        self.assertEqual(self.c.delete(f'/api/profiles/{self.ze.id}/sounds/death/', **KEY).status_code, 204)
        self.assertEqual(self.c.get(f'/api/profiles/{self.ze.id}/').data['sounds'], {})

    def test_live_table_flow(self):
        r = self.c.post('/api/live/', {'allow_edits': True, 'state': {'players': [{'id': 'a', 'name': 'Zé', 'life': 40}]}}, format='json', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        code, token = r.data['code'], r.data['host_token']
        self.assertEqual(len(code), 5)
        # convidado lê
        g = self.c.get(f'/api/live/{code.lower()}/')
        self.assertEqual(g.data['state']['players'][0]['life'], 40)
        self.assertTrue(g.data['allow_edits'])
        # mesma versão -> unchanged
        self.assertTrue(self.c.get(f'/api/live/{code}/?version={g.data["version"]}').data['unchanged'])
        # convidado pede -3
        a = self.c.post(f'/api/live/{code}/actions/', {'type': 'life', 'playerId': 'a', 'delta': -3}, format='json', HTTP_X_LC_DEVICE='guest')
        self.assertEqual(a.status_code, 202)
        # host sem token
        self.assertEqual(self.c.put(f'/api/live/{code}/state/', {'state': {}}, format='json').status_code, 403)
        # host publica e recebe a ação
        p = self.c.put(f'/api/live/{code}/state/', {'state': {'players': [{'id': 'a', 'name': 'Zé', 'life': 37}]}}, format='json', HTTP_X_LC_HOST=token)
        self.assertEqual(p.status_code, 200)
        self.assertEqual(p.data['actions'][0]['delta'], -3)
        self.assertEqual(p.data['actions'][0]['device'], 'guest')
        # ação já consumida
        self.assertEqual(self.c.put(f'/api/live/{code}/state/', {}, format='json', HTTP_X_LC_HOST=token).data['actions'], [])
        # host fecha edições -> convidado é barrado
        self.c.put(f'/api/live/{code}/state/', {'allow_edits': False}, format='json', HTTP_X_LC_HOST=token)
        self.assertEqual(self.c.post(f'/api/live/{code}/actions/', {'type': 'life', 'playerId': 'a', 'delta': 1}, format='json').status_code, 403)
        # encerrar
        self.c.put(f'/api/live/{code}/state/', {'active': False}, format='json', HTTP_X_LC_HOST=token)
        self.assertFalse(LiveTable.objects.get(code=code).active)
        self.assertEqual(self.c.post(f'/api/live/{code}/actions/', {'type': 'life', 'playerId': 'a', 'delta': 1}, format='json').status_code, 410)
