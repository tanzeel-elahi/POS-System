from django.contrib import admin
from .models import Bill, BillItem


class BillItemInline(admin.TabularInline):
    model = BillItem
    extra = 0


class BillAdmin(admin.ModelAdmin):
    inlines = [BillItemInline]


admin.site.register(Bill, BillAdmin)