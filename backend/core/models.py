from django.db import models
from django.utils.text import slugify


class Profile(models.Model):
    """Jogador da mesa. Os pré-setados (Zé, Reis, Laura, ...) vêm do seed."""

    name = models.CharField('Nome', max_length=40)
    slug = models.SlugField('Slug', max_length=50, unique=True)
    photo = models.ImageField('Foto', upload_to='profiles/', blank=True, null=True)
    color = models.CharField('Cor', max_length=7, blank=True, default='')
    # Apelidos reconhecidos pelo comando de voz ("Zezinho", "Cabralzinho").
    aliases = models.JSONField('Apelidos', default=list, blank=True)
    is_preset = models.BooleanField('Pré-setado', default=False)
    active = models.BooleanField('Ativo', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Perfil'
        verbose_name_plural = 'Perfis'
        ordering = ['-is_preset', 'name']

    def __str__(self):
        return self.name

    @staticmethod
    def unique_slug(name: str, exclude_pk=None) -> str:
        base = slugify(name) or 'jogador'
        slug = base
        i = 2
        qs = Profile.objects.all()
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        while qs.filter(slug=slug).exists():
            slug = f'{base}-{i}'
            i += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = Profile.unique_slug(self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)


class Match(models.Model):
    """Uma partida encerrada (com vencedor automático ou pódio manual)."""

    SOURCE_CHOICES = [('web', 'Site'), ('android', 'APK'), ('unknown', '?')]

    client_id = models.CharField('ID no cliente', max_length=80, unique=True)
    started_at = models.DateTimeField('Início')
    ended_at = models.DateTimeField('Fim', db_index=True)
    duration_ms = models.BigIntegerField('Duração (ms)', default=0)
    mode = models.CharField('Modo', max_length=30, default='standard')
    manual = models.BooleanField('Pódio manual', default=False)
    player_count = models.PositiveSmallIntegerField('Jogadores', default=0)
    starting_life = models.PositiveSmallIntegerField('Vida inicial', default=40)
    source = models.CharField('Origem', max_length=10, choices=SOURCE_CHOICES, default='unknown')
    device = models.CharField('Dispositivo', max_length=80, blank=True, default='')
    # Log completo de eventos da partida (vida, dano de comandante, mortes...),
    # do jeito que o app guarda em GameState.history.
    events = models.JSONField('Eventos', default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Partida'
        verbose_name_plural = 'Partidas'
        ordering = ['-ended_at']

    def __str__(self):
        return f'{self.ended_at:%d/%m/%Y %H:%M} ({self.player_count} jog.)'

    @property
    def winner(self):
        return self.placements.filter(place=1).first()


class MatchPlacement(models.Model):
    match = models.ForeignKey(Match, related_name='placements', on_delete=models.CASCADE)
    profile = models.ForeignKey(Profile, related_name='placements', null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField('Nome (na época)', max_length=40)
    place = models.PositiveSmallIntegerField('Colocação')
    points = models.PositiveSmallIntegerField('Pontos')
    # Detalhes opcionais do fim da partida pra esse jogador.
    final_life = models.IntegerField('Vida final', null=True, blank=True)
    eliminated_by = models.CharField('Eliminado por', max_length=40, blank=True, default='')
    commander_deaths = models.PositiveSmallIntegerField('Mortes do comandante', default=0)

    class Meta:
        ordering = ['place']
        unique_together = [('match', 'place')]

    def __str__(self):
        return f'{self.place}º {self.name}'


class AppSetting(models.Model):
    """Configuração global da mesa (temporada, desempate...). key -> JSON."""

    key = models.CharField(max_length=50, unique=True)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuração'
        verbose_name_plural = 'Configurações'

    def __str__(self):
        return self.key

    @classmethod
    def get(cls, key, default=None):
        row = cls.objects.filter(key=key).first()
        return row.value if row else default

    @classmethod
    def set(cls, key, value):
        row, _ = cls.objects.update_or_create(key=key, defaults={'value': value})
        return row


class Achievement(models.Model):
    """Conquista de um perfil, calculada no servidor a partir do log da partida."""

    profile = models.ForeignKey(Profile, related_name='achievements', on_delete=models.CASCADE)
    key = models.CharField('Chave', max_length=40)
    match = models.ForeignKey(Match, related_name='achievements', null=True, blank=True, on_delete=models.SET_NULL)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Conquista'
        verbose_name_plural = 'Conquistas'
        unique_together = [('profile', 'key')]
        ordering = ['-earned_at']

    def __str__(self):
        return f'{self.profile} · {self.key}'


class AppVersion(models.Model):
    """Versão do APK publicada; o app compara com o próprio versionCode."""

    version_code = models.IntegerField('Código da versão', unique=True)
    version_name = models.CharField('Nome da versão', max_length=50)
    apk_file = models.FileField('APK', upload_to='apk/')
    changelog = models.TextField('Novidades', blank=True)
    mandatory = models.BooleanField('Obrigatória', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Versão do App'
        verbose_name_plural = 'Versões do App'
        ordering = ['-version_code']

    def __str__(self):
        return f'v{self.version_name} ({self.version_code})'
