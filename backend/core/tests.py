import io
import tempfile

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .models import AppVersion, Match, Profile

KEY = {'HTTP_X_LC_KEY': settings.LC_API_KEY}


def _png(size=(900, 300)):
    buf = io.BytesIO()
    Image.new('RGB', size, (200, 30, 30)).save(buf, format='PNG')
    return SimpleUploadedFile('foto.png', buf.getvalue(), content_type='image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix='lc-test-media-'))
class ApiTests(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.ze = Profile.objects.create(name='Zé', slug='ze', is_preset=True)
        self.reis = Profile.objects.create(name='Reis', slug='reis', is_preset=True)

    def _post_match(self, client_id='m_1', placements=None, **extra):
        placements = placements or [
            {'profile_id': self.ze.id, 'name': 'Zé', 'place': 1, 'points': 3},
            {'profile_id': self.reis.id, 'name': 'Reis', 'place': 2, 'points': 2},
            {'profile_id': None, 'name': 'Visitante', 'place': 3, 'points': 1},
        ]
        body = {
            'client_id': client_id, 'started_at_ms': 1760000000000, 'ended_at_ms': 1760003600000,
            'duration_ms': 3600000, 'mode': 'standard', 'manual': False, 'source': 'web',
            'events': [{'type': 'life_change', 'amount': -5}], 'placements': placements,
        }
        body.update(extra)
        return self.c.post('/api/matches/', body, format='json', **KEY)

    def test_health(self):
        r = self.c.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['ok'])

    def test_profiles_list_and_create(self):
        r = self.c.get('/api/profiles/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)

        # sem chave: proibido
        r = self.c.post('/api/profiles/', {'name': 'Novo'})
        self.assertEqual(r.status_code, 403)

        r = self.c.post('/api/profiles/', {'name': 'Novo Jogador', 'photo': _png()}, format='multipart', **KEY)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['photo_url'].endswith('.jpg'))
        p = Profile.objects.get(pk=r.data['id'])
        with Image.open(p.photo.path) as img:
            self.assertLessEqual(max(img.size), settings.PROFILE_PHOTO_MAX_SIDE)

        # slug único
        r2 = self.c.post('/api/profiles/', {'name': 'Novo Jogador'}, format='multipart', **KEY)
        self.assertEqual(r2.status_code, 201)
        self.assertNotEqual(r.data['slug'], r2.data['slug'])

    def test_profile_update_and_soft_delete(self):
        r = self.c.patch(f'/api/profiles/{self.ze.id}/', {'name': 'Zé Pequeno', 'color': '#123456'}, format='multipart', **KEY)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['name'], 'Zé Pequeno')
        r = self.c.delete(f'/api/profiles/{self.ze.id}/', **KEY)
        self.assertEqual(r.status_code, 204)
        self.assertEqual(len(self.c.get('/api/profiles/').data), 1)
        self.assertEqual(len(self.c.get('/api/profiles/?all=1').data), 2)

    def test_match_create_idempotent_and_list(self):
        r = self._post_match()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['player_count'], 3)
        self.assertEqual(r.data['placements'][0]['name'], 'Zé')

        # Reenvio da fila offline: mesmo client_id -> 200 e sem duplicar.
        r = self._post_match()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Match.objects.count(), 1)

        r = self.c.get('/api/matches/')
        self.assertEqual(r.data['count'], 1)
        self.assertNotIn('events', r.data['results'][0])
        r = self.c.get('/api/matches/?events=1')
        self.assertEqual(r.data['results'][0]['events'][0]['type'], 'life_change')

        r = self.c.get(f'/api/matches/?profile={self.reis.id}')
        self.assertEqual(r.data['count'], 1)

    def test_match_validation(self):
        r = self._post_match(placements=[{'name': 'A', 'place': 1, 'points': 2}, {'name': 'B', 'place': 1, 'points': 1}])
        self.assertEqual(r.status_code, 400)
        r = self.c.post('/api/matches/', {'client_id': 'x', 'placements': []}, format='json', **KEY)
        self.assertEqual(r.status_code, 400)
        r = self.c.post('/api/matches/', {'client_id': 'x', 'placements': [{'name': 'A', 'place': 1, 'points': 1}]}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_ranking(self):
        self._post_match('m_1')
        self._post_match('m_2', placements=[
            {'profile_id': self.reis.id, 'name': 'Reis', 'place': 1, 'points': 2},
            {'profile_id': self.ze.id, 'name': 'Zé', 'place': 2, 'points': 1},
        ])
        r = self.c.get('/api/ranking/?period=all')
        self.assertEqual(r.status_code, 200)
        rows = r.data['rows']
        # Zé e Reis empatam (4 pts, 1 vitória, 2 partidas) -> desempate por nome.
        self.assertEqual([x['name'] for x in rows[:2]], ['Reis', 'Zé'])
        self.assertEqual([x['points'] for x in rows[:2]], [4, 4])
        self.assertEqual([x['wins'] for x in rows[:2]], [1, 1])
        self.assertEqual(rows[0]['matches'], 2)
        # Visitante sem perfil entra pelo nome
        self.assertEqual(rows[2]['name'], 'Visitante')
        self.assertEqual(r.data['total_matches'], 2)

        # período "hoje" não inclui partida de 2025
        r = self.c.get('/api/ranking/?period=today')
        self.assertEqual(r.data['rows'], [])

    def test_match_delete(self):
        r = self._post_match()
        mid = r.data['id']
        self.assertEqual(self.c.delete(f'/api/matches/{mid}/').status_code, 403)
        self.assertEqual(self.c.delete(f'/api/matches/{mid}/', **KEY).status_code, 204)
        self.assertEqual(Match.objects.count(), 0)

    def test_profile_stats(self):
        self._post_match()
        r = self.c.get(f'/api/profiles/{self.reis.id}/stats/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['matches'], 1)
        self.assertEqual(r.data['nemesis'][0]['name'], 'Zé')

    def test_update_check(self):
        r = self.c.get('/api/update/check/?version_code=1')
        self.assertFalse(r.data['update_available'])
        AppVersion.objects.create(version_code=9, version_name='2.0.0', apk_file='apk/x.apk', changelog='sync')
        r = self.c.get('/api/update/check/?version_code=8')
        self.assertTrue(r.data['update_available'])
        self.assertEqual(r.data['version_name'], '2.0.0')
        self.assertIn('/media/apk/x.apk', r.data['download_url'])
        r = self.c.get('/api/update/check/?version_code=9')
        self.assertFalse(r.data['update_available'])
