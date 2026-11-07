from django.contrib.admin.apps import AdminConfig


# Separate from admin_site.py: Django loads this before models are ready.
class StaffAdminConfig(AdminConfig):
    default_site = "church_erp.core.admin_site.StaffAdminSite"
