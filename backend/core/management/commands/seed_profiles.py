"""
Cria/atualiza os perfis pré-setados da mesa com as fotos de backend/seed/photos.

    python manage.py seed_profiles            # cria os que faltam, não mexe em foto existente
    python manage.py seed_profiles --photos   # também reaplica as fotos do seed
"""
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand

from core.models import Profile
from core.views import _process_photo

SEED_DIR = Path(settings.BASE_DIR) / 'seed' / 'photos'

# (nome, slug, arquivo da foto, cor)
PRESETS = [
    ('Zé', 'ze', 'ze.jpg', '#f59e0b'),
    ('Reis', 'reis', 'reis.jpg', '#6366f1'),
    ('Laura', 'laura', 'laura.jpg', '#ec4899'),
    ('Mendas', 'mendas', 'mendas.jpg', '#14b8a6'),
    ('Maria', 'maria', 'maria.jpg', '#8b5cf6'),
    ('Cabral', 'cabral', 'cabral.jpg', '#ef4444'),
    ('System', 'system', 'system.jpg', '#22c55e'),
]


class Command(BaseCommand):
    help = 'Cria os perfis pré-setados (Zé, Reis, Laura, Mendas, Maria, Cabral, System).'

    def add_arguments(self, parser):
        parser.add_argument('--photos', action='store_true', help='Reaplica as fotos do seed mesmo se já houver foto.')

    def handle(self, *args, **opts):
        for name, slug, photo_name, color in PRESETS:
            profile, created = Profile.objects.get_or_create(
                slug=slug, defaults={'name': name, 'color': color, 'is_preset': True},
            )
            if not profile.is_preset:
                profile.is_preset = True
            if not profile.active:
                profile.active = True
            photo_path = SEED_DIR / photo_name
            if photo_path.exists() and (opts['photos'] or not profile.photo):
                with photo_path.open('rb') as fh:
                    profile.photo.save(f'{slug}.jpg', _process_photo(File(fh)), save=False)
            elif not photo_path.exists():
                self.stdout.write(self.style.WARNING(f'  sem foto no seed para {name} ({photo_name})'))
            profile.save()
            self.stdout.write(f'{"criado " if created else "ok     "} {name}' + ('' if profile.photo else '  (sem foto)'))
