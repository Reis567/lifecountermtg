from django.contrib import admin

from .models import Achievement, AppSetting, AppVersion, Match, MatchPlacement, Profile


@admin.register(AppSetting)
class AppSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'updated_at')


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('profile', 'key', 'match', 'earned_at')
    list_filter = ('key',)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_preset', 'active', 'updated_at')
    list_filter = ('is_preset', 'active')
    search_fields = ('name', 'slug')


class PlacementInline(admin.TabularInline):
    model = MatchPlacement
    extra = 0


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('ended_at', 'player_count', 'mode', 'manual', 'source', 'client_id')
    list_filter = ('manual', 'source', 'mode')
    inlines = [PlacementInline]
    date_hierarchy = 'ended_at'


@admin.register(AppVersion)
class AppVersionAdmin(admin.ModelAdmin):
    list_display = ('version_name', 'version_code', 'mandatory', 'created_at')
