from django.db import models
from decimal import Decimal
from django.core.validators import MinValueValidator, RegexValidator


class Customer(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    alternate_phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    employer = models.CharField(max_length=200, blank=True)
    monthly_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
    )
    cnic = models.CharField(
    max_length=13,
    unique=True,
    null=True,
    blank=True,
    validators=[
        RegexValidator(
            r'^\d{13}$',
            'CNIC must be exactly 13 digits.'
        )
    ],
)
    credit_limit = models.DecimalField(
    max_digits=12,
    decimal_places=2,
    null=True,
    blank=True,
    validators=[MinValueValidator(Decimal('0'))],
)

    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='team_members',
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
