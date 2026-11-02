from django.db import models
from church_erp.core.models import Branch, Minister
from church_erp.accounts.models import User


class GivingRecord(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='giving_records')
    member_name = models.CharField(max_length=200, blank=True, help_text="Optional — anonymous giving allowed")
    member_phone = models.CharField(max_length=20, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='ZMW')
    giving_type = models.CharField(max_length=20, choices=[
        ('tithe', 'Tithe'), ('offering', 'Offering'), ('project', 'Project-specific')
    ])
    payment_method = models.CharField(max_length=20, choices=[
        ('momo', 'Mobile Money'), ('bank', 'Bank Transfer'), ('cash', 'Cash')
    ])
    reference_number = models.CharField(max_length=100, unique=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='recorded_givings')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='confirmed', choices=[
        ('confirmed', 'Confirmed'), ('void', 'Voided')
    ])

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.giving_type} — {self.amount} {self.currency} ({self.reference_number})"
