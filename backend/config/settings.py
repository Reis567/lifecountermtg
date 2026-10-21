"""
LifeCounter backend — base única de perfis, partidas e ranking.

Mesmo desenho do backend da Lista de Compras (Django + DRF + SQLite + Gunicorn
atrás do Nginx). Roda em lifecounter.mreis.site, porta interna 8013.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# .env simples (sem python-dotenv), igual ao da Lista de Compras.
_env_file = BASE_DIR / '.env'
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            os.environ.setdefault(key.strip(), value.strip())

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-in-production')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'lifecounter.mreis.site',
    '134.209.45.112',
    '10.0.2.2',
]

# Chave compartilhada que o app manda em X-LC-Key nas escritas (POST/PATCH/DELETE).
# Não é segurança de verdade — é só pra ninguém de fora encher o ranking de lixo.
LC_API_KEY = os.environ.get('LC_API_KEY', 'lc-mesa-2026')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {'timeout': 20},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%S%z',
    'UNAUTHENTICATED_USER': None,
}

# O APK roda em file:// (Origin: null) e o site em lifecounter.mreis.site;
# a API é da mesa de amigos, então libera geral.
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type', 'origin',
    'user-agent', 'x-csrftoken', 'x-requested-with', 'x-lc-key', 'x-lc-device',
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Foto de perfil: tamanho máximo aceito no upload (MB).
MAX_PHOTO_SIZE_MB = 8
# Lado máximo (px) ao redimensionar a foto de perfil.
PROFILE_PHOTO_MAX_SIDE = 640

DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
