
from django.db import models
from django.db.models import Q
from apps.customers.models import Customer


class CreditEntry(models.Model):

    class EntryType(models.TextChoices):
        SALE = 'sale', 'Credit sale'
        REPAYMENT = 'repayment', 'Repayment'

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='credit_entries'
    )

    entry_type = models.CharField(
        max_length=10,
        choices=EntryType.choices
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    bill = models.ForeignKey(
        'billing.Bill',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='credit_entries'
    )

    note = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name='credit_amount_positive'
            )
        ]

    def __str__(self):
        return f"{self.customer} - {self.entry_type} - {self.amount}"
