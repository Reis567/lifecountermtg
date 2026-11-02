"""
Lote 7 (v2.6.0): ranking por comandante + confronto deck contra deck, juntar
decks (merge) e dedupe no cadastro, vantagem de quem começa (perfil e
temporada), prêmio "maior virada" e log de eventos longo (sem corte em 500).
"""
import uuid
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Deck, Match, MatchPlacement, Profile

KEY = {'HTTP_X_LC_KEY': 'lc-mesa-2026'}


def _match(players, starter=None, minutes_ago=10, events=None, duration_ms=1800000):
    """players: lista de (profile, place, deck|None)."""
    ended = timezone.now() - timedelta(minutes=minutes_ago)
    m = Match.objects.create(
        started_at=ended - timedelta(milliseconds=duration_ms), ended_at=ended, duration_ms=duration_ms,
        mode='standard', player_count=len(players), starting_life=40, source='web', device='t',
        events=events or [], starter_profile=starter, client_id=str(uuid.uuid4()),
    )
    for prof, place, deck in players:
        MatchPlacement.objects.create(
            match=m, profile=prof, name=prof.name, place=place, points=len(players) - place + 1,
            deck=deck, deck_name=deck.name if deck else '', deck_colors=deck.colors if deck else '',
        )
    return m


class Lote7Tests(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze')
        self.reis = Profile.objects.create(name='Reis', slug='reis')
        self.laura = Profile.objects.create(name='Laura', slug='laura')
        self.atraxa = Deck.objects.create(profile=self.ze, name='Atraxa', commander='Atraxa', colors='WUBG', scryfall_id='a1')
        self.krenko = Deck.objects.create(profile=self.reis, name='Krenko', commander='Krenko', colors='R', scryfall_id='k1')
        self.atraxa2 = Deck.objects.create(profile=self.laura, name='Atraxa', commander='Atraxa', colors='WUBG', scryfall_id='a1')

    def test_commanders_ranking_and_vs(self):
        _match([(self.ze, 1, self.atraxa), (self.reis, 2, self.krenko), (self.laura, 3, None)], minutes_ago=30)
        _match([(self.reis, 1, self.krenko), (self.laura, 2, self.atraxa2), (self.ze, 3, None)], minutes_ago=20)
        _match([(self.laura, 1, self.atraxa2), (self.reis, 2, self.krenko), (self.ze, 3, None)], minutes_ago=10)
        r = self.c.get('/api/commanders/?period=all')
        self.assertEqual(r.status_code, 200)
        rows = {x['name'].lower(): x for x in r.data['rows']}
        # Atraxa agrupa os dois perfis: 3 partidas, 2 vitórias
        self.assertEqual(rows['atraxa']['matches'], 3)
        self.assertEqual(rows['atraxa']['wins'], 2)
        self.assertEqual(len(rows['atraxa']['pilots']), 2)
        self.assertEqual(rows['krenko']['wins'], 1)
        # confronto: Atraxa ficou na frente do Krenko 2 de 3 vezes
        vs = {v['name'].lower(): v for v in rows['atraxa']['vs']}
        self.assertEqual(vs['krenko']['matches'], 3)
        self.assertEqual(vs['krenko']['ahead'], 2)
        self.assertEqual(r.data['rows'][0]['name'].lower(), 'atraxa')  # mais vitórias primeiro

    def test_deck_create_dedupes(self):
        r = self.c.post(f'/api/profiles/{self.ze.id}/decks/', {'name': 'Atraxa', 'scryfall_id': 'a1'}, format='json', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['id'], self.atraxa.id)
        r = self.c.post(f'/api/profiles/{self.ze.id}/decks/', {'name': 'atraxa'}, format='json', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Deck.objects.filter(profile=self.ze, active=True).count(), 1)
        r = self.c.post(f'/api/profiles/{self.ze.id}/decks/', {'name': 'Edgar', 'scryfall_id': 'e1'}, format='json', **KEY)
        self.assertEqual(r.status_code, 201)

    def test_deck_merge_moves_placements(self):
        dup = Deck.objects.create(profile=self.ze, name='Atraxa (2)', colors='WUBG')
        _match([(self.ze, 1, dup), (self.reis, 2, self.krenko)], minutes_ago=30)
        _match([(self.ze, 2, self.atraxa), (self.reis, 1, self.krenko)], minutes_ago=20)
        r = self.c.post(f'/api/decks/{dup.id}/merge/', {'into': self.atraxa.id}, format='json', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['moved'], 1)
        dup.refresh_from_db()
        self.assertFalse(dup.active)
        self.assertEqual(MatchPlacement.objects.filter(deck=self.atraxa).count(), 2)
        self.assertEqual(MatchPlacement.objects.filter(deck=self.atraxa, deck_name='Atraxa').count(), 2)
        # perfil diferente: recusa
        r = self.c.post(f'/api/decks/{self.krenko.id}/merge/', {'into': self.atraxa.id}, format='json', **KEY)
        self.assertEqual(r.status_code, 400)
        # perfil: stats juntam
        s = self.c.get(f'/api/profiles/{self.ze.id}/stats/').data
        self.assertEqual(len(s['deck_stats']), 1)
        self.assertEqual(s['deck_stats'][0]['matches'], 2)

    def test_starter_advantage(self):
        _match([(self.ze, 1, None), (self.reis, 2, None), (self.laura, 3, None)], starter=self.ze, minutes_ago=40)
        _match([(self.ze, 2, None), (self.reis, 1, None), (self.laura, 3, None)], starter=self.ze, minutes_ago=30)
        _match([(self.ze, 1, None), (self.reis, 2, None), (self.laura, 3, None)], starter=self.reis, minutes_ago=20)
        _match([(self.ze, 1, None), (self.reis, 2, None), (self.laura, 3, None)], minutes_ago=10)  # sem starter
        s = self.c.get(f'/api/profiles/{self.ze.id}/stats/').data
        self.assertEqual(s['starts'], 2)
        self.assertEqual(s['starts_wins'], 1)
        self.assertEqual(s['starts_win_rate'], 50.0)
        self.assertEqual(s['non_start_win_rate'], 100.0)  # a 3ª (começou o Reis) ele venceu; a 4ª não conta
        o = self.c.get('/api/seasons/summary/').data
        self.assertEqual(o['starter']['matches'], 3)
        self.assertEqual(o['starter']['wins'], 1)
        self.assertAlmostEqual(o['starter']['expected_rate'], 33.3, places=1)

    def test_comeback_award(self):
        # Zé chega a 5 de vida enquanto o Reis tem 38, e vence: virada de 33.
        ev = [
            {'type': 'life_change', 'playerId': 'p1', 'playerName': 'Zé', 'details': {'amount': -35, 'newValue': 5}, 'turn': 4},
            {'type': 'life_change', 'playerId': 'p2', 'playerName': 'Reis', 'details': {'amount': -2, 'newValue': 38}, 'turn': 4},
            {'type': 'life_change', 'playerId': 'p2', 'playerName': 'Reis', 'details': {'amount': -38, 'newValue': 0}, 'turn': 9},
            {'type': 'player_eliminated', 'playerId': 'p2', 'playerName': 'Reis', 'details': {}, 'turn': 9},
        ]
        _match([(self.ze, 1, None), (self.reis, 2, None), (self.laura, 3, None)], events=ev, minutes_ago=10)
        o = self.c.get('/api/seasons/summary/').data
        cb = next((a for a in o['awards'] if a['key'] == 'comeback'), None)
        self.assertIsNotNone(cb)
        self.assertEqual(cb['value'], 33)
        self.assertEqual(cb['name'], 'Zé')

    def test_long_event_log_accepted(self):
        now = timezone.now()
        events = [{'type': 'life_change', 'playerId': 'p1', 'playerName': 'Zé', 'details': {'amount': -1, 'newValue': 40 - (i % 39)}, 'turn': 1 + i // 50} for i in range(1200)]
        body = {
            'client_id': 'long-1', 'started_at_ms': int((now - timedelta(hours=2)).timestamp() * 1000), 'ended_at_ms': int(now.timestamp() * 1000),
            'duration_ms': 7200000, 'mode': 'standard', 'manual': False, 'player_count': 2, 'starting_life': 40, 'source': 'web', 'device': 't',
            'events': events,
            'placements': [
                {'profile_id': self.ze.id, 'name': 'Zé', 'place': 1, 'points': 2},
                {'profile_id': self.reis.id, 'name': 'Reis', 'place': 2, 'points': 1},
            ],
        }
        r = self.c.post('/api/matches/', body, format='json', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(Match.objects.get(client_id='long-1').events), 1200)
