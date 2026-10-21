from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health),
    path('profiles/', views.profiles),
    path('profiles/<int:pk>/', views.profile_detail),
    path('profiles/<int:pk>/stats/', views.profile_stats),
    path('matches/', views.matches),
    path('matches/<int:pk>/', views.match_detail),
    path('ranking/', views.ranking),
    path('achievements/', views.achievements_catalog),
    path('settings/season/', views.season_settings),
    path('notifications/', views.notifications),
    path('update/check/', views.check_update),
    path('update/download/', views.download_apk),
]
