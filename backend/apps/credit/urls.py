
from django.urls import path
from .views import CustomerCreditView

urlpatterns = [
    path('customers/<int:customer_id>/credit/',CustomerCreditView.as_view(),name='customer-credit'),
]
