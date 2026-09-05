"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path

from backend.oauth_gates import github_callback, github_login
from backend.views import health, whoami

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health, name='health'),
    path('api/whoami/', whoami, name='whoami'),
    path('api/', include('scenes.urls')),
    # Issue #420: registered ahead of `include("allauth.urls")` below so
    # these two paths resolve here first, gating GitHub closed (404) while
    # GITHUB_OAUTH_ENABLED is False. See backend.oauth_gates.
    path('accounts/github/login/', github_login, name='github_login'),
    path('accounts/github/login/callback/', github_callback, name='github_callback'),
    # Google sign-in (Task 12): exposes /accounts/login/, /accounts/logout/,
    # /accounts/google/login/, and /accounts/google/login/callback/ — the
    # only redirect URI that must be registered with Google (see
    # .env.example). No other accounts/* path is a valid OAuth target.
    path('accounts/', include('allauth.urls')),
]
