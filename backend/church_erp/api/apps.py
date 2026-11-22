from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'church_erp.api'

    def ready(self):
        from corsheaders.signals import check_request_enabled

        from .cors import allow_app_origin

        check_request_enabled.connect(allow_app_origin, dispatch_uid="upcz-app-cors")
