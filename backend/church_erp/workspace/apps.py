from django.apps import AppConfig


class WorkspaceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "church_erp.workspace"
    verbose_name = "Shared workspace"
