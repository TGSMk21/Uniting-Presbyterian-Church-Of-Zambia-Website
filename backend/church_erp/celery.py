import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "church_erp.settings.local")

app = Celery("church_erp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
