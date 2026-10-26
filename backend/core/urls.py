from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health),
    path('profiles/', views.profiles),
    path('profiles/<int:pk>/', views.profile_detail),
    path('profiles/<int:pk>/stats/', views.profile_stats),
    path('profiles/<int:pk>/decks/', views.profile_decks),
    path('profiles/<int:pk>/sounds/<str:kind>/', views.profile_sound),
    path('decks/<int:pk>/', views.deck_detail),
    path('matches/', views.matches),
    path('matches/<int:pk>/', views.match_detail),
    path('ranking/', views.ranking),
    path('elo/', views.elo),
    path('seasons/', views.seasons_list),
    path('seasons/summary/', views.season_summary),
    path('game/current/', views.current_game),
    path('achievements/', views.achievements_catalog),
    path('settings/season/', views.season_settings),
    path('notifications/', views.notifications),
    path('live/', views.live_create),
    path('live/<str:code>/', views.live_get),
    path('live/<str:code>/state/', views.live_push),
    path('live/<str:code>/actions/', views.live_action),
    path('update/check/', views.check_update),
    path('update/download/', views.download_apk),
]
