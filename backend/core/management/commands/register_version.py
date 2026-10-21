"""
Registra (ou atualiza) uma versão do APK pro auto-update do app.

    python manage.py register_version 9 2.0.0 apk/LifeCounter-v2.0.0.apk --changelog "Novidades..."
"""
from django.core.management.base import BaseCommand, CommandError

from core.models import AppVersion


class Command(BaseCommand):
    help = 'Registra uma versão do APK (version_code, version_name, caminho em media/).'

    def add_arguments(self, parser):
        parser.add_argument('version_code', type=int)
        parser.add_argument('version_name')
        parser.add_argument('apk_file', help='Caminho relativo a media/, ex.: apk/LifeCounter-v2.0.0.apk')
        parser.add_argument('--changelog', default='')
        parser.add_argument('--mandatory', action='store_true')

    def handle(self, *args, **opts):
        from django.conf import settings
        import os
        path = os.path.join(settings.MEDIA_ROOT, opts['apk_file'])
        if not os.path.exists(path):
            raise CommandError(f'APK não encontrado: {path}')
        v, created = AppVersion.objects.update_or_create(
            version_code=opts['version_code'],
            defaults={
                'version_name': opts['version_name'],
                'apk_file': opts['apk_file'],
                'changelog': opts['changelog'],
                'mandatory': opts['mandatory'],
            },
        )
        self.stdout.write(f'{"registrada" if created else "atualizada"}: {v} ({os.path.getsize(path) // 1024} KB)')
