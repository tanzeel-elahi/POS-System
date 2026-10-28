
from django.contrib import admin
from .models import CreditEntry


@admin.register(CreditEntry)
class CreditEntryAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer',
        'entry_type',
        'amount',
        'bill',
        'created_at',
    )

    list_filter = ('entry_type', 'created_at')
    search_fields = ('customer__name', 'customer__phone')
    readonly_fields = ('created_at',)
