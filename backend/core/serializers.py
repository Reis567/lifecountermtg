from datetime import datetime, timedelta, timezone as dt_tz

from django.utils import timezone
from rest_framework import serializers

from .models import AppVersion, Deck, Match, MatchPlacement, Profile


class DeckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deck
        fields = ['id', 'profile', 'name', 'commander', 'colors', 'image_url', 'scryfall_id', 'active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProfileSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    sounds = serializers.SerializerMethodField()
    decks = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'name', 'slug', 'photo_url', 'color', 'aliases', 'is_preset', 'active', 'sounds', 'decks', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'is_preset', 'created_at', 'updated_at']

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url

    def get_sounds(self, obj):
        request = self.context.get('request')
        out = {}
        for s in obj.sounds.all():
            if s.file:
                out[s.kind] = request.build_absolute_uri(s.file.url) if request else s.file.url
        return out

    def get_decks(self, obj):
        return DeckSerializer([d for d in obj.decks.all() if d.active], many=True).data


class PlacementSerializer(serializers.ModelSerializer):
    profile_id = serializers.PrimaryKeyRelatedField(
        source='profile', queryset=Profile.objects.all(), allow_null=True, required=False
    )
    deck_id = serializers.PrimaryKeyRelatedField(
        source='deck', queryset=Deck.objects.all(), allow_null=True, required=False
    )
    photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MatchPlacement
        fields = ['profile_id', 'name', 'place', 'points', 'final_life', 'eliminated_by', 'commander_deaths', 'photo_url',
                  'deck_id', 'deck_name', 'deck_colors']

    def get_photo_url(self, obj):
        if not obj.profile or not obj.profile.photo:
            return None
        request = self.context.get('request')
        url = obj.profile.photo.url
        return request.build_absolute_uri(url) if request else url


class MatchSerializer(serializers.ModelSerializer):
    placements = PlacementSerializer(many=True)
    # O app manda timestamps em ms (Date.now()); aceitamos os dois formatos.
    started_at_ms = serializers.IntegerField(write_only=True, required=False)
    ended_at_ms = serializers.IntegerField(write_only=True, required=False)
    started_at = serializers.DateTimeField(required=False)
    ended_at = serializers.DateTimeField(required=False)

    class Meta:
        model = Match
        fields = [
            'id', 'client_id', 'started_at', 'ended_at', 'started_at_ms', 'ended_at_ms',
            'duration_ms', 'mode', 'manual', 'player_count', 'starting_life', 'source',
            'device', 'events', 'placements', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        started_ms = attrs.pop('started_at_ms', None)
        ended_ms = attrs.pop('ended_at_ms', None)
        if started_ms is not None and 'started_at' not in attrs:
            attrs['started_at'] = datetime.fromtimestamp(started_ms / 1000, tz=dt_tz.utc)
        if ended_ms is not None and 'ended_at' not in attrs:
            attrs['ended_at'] = datetime.fromtimestamp(ended_ms / 1000, tz=dt_tz.utc)
        if 'ended_at' not in attrs:
            attrs['ended_at'] = timezone.now()
        if 'started_at' not in attrs:
            attrs['started_at'] = attrs['ended_at']
        placements = attrs.get('placements') or []
        if not placements:
            raise serializers.ValidationError({'placements': 'A partida precisa de pelo menos um colocado.'})
        places = sorted(p['place'] for p in placements)
        if places != list(range(1, len(places) + 1)):
            raise serializers.ValidationError({'placements': 'As colocações precisam ser 1..N sem repetição.'})
        # Trava anti-lixo: só entra no ranking partida com PERFIL em todos os
        # jogadores (dados de antes da base única não têm) e recente.
        if any(p.get('profile') is None for p in placements):
            raise serializers.ValidationError({'placements': 'Todos os jogadores precisam ter perfil para a partida entrar no ranking.'})
        now = timezone.now()
        started, ended = attrs['started_at'], attrs['ended_at']
        if ended - started > timedelta(hours=12):
            raise serializers.ValidationError({'started_at': 'Partida com mais de 12 h de duração não entra no ranking (provavelmente ficou salva no aparelho).'})
        if now - ended > timedelta(days=7):
            raise serializers.ValidationError({'ended_at': 'Partida encerrada há mais de 7 dias não entra no ranking.'})
        if ended - now > timedelta(hours=1):
            raise serializers.ValidationError({'ended_at': 'Data de fim no futuro.'})
        if not attrs.get('player_count'):
            attrs['player_count'] = len(placements)
        events = attrs.get('events')
        if events is not None and not isinstance(events, list):
            raise serializers.ValidationError({'events': 'events precisa ser uma lista.'})
        return attrs

    def create(self, validated):
        placements = validated.pop('placements')
        match = Match.objects.create(**validated)
        for p in placements:
            deck = p.get('deck')
            if deck is not None:
                p.setdefault('deck_name', deck.name)
                p.setdefault('deck_colors', deck.colors)
                if not p.get('deck_name'):
                    p['deck_name'] = deck.name
                if not p.get('deck_colors'):
                    p['deck_colors'] = deck.colors
            MatchPlacement.objects.create(match=match, **p)
        return match


class AppVersionSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    class Meta:
        model = AppVersion
        fields = ['version_code', 'version_name', 'changelog', 'mandatory', 'download_url', 'file_size', 'created_at']

    def get_download_url(self, obj):
        if not obj.apk_file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.apk_file.url) if request else obj.apk_file.url

    def get_file_size(self, obj):
        try:
            return obj.apk_file.size if obj.apk_file else 0
        except Exception:
            return 0
