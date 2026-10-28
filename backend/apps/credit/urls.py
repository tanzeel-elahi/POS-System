
from django.urls import path
from .views import CustomerCreditView, CustomerRepaymentView

urlpatterns = [
    path('customers/<int:customer_id>/credit/',CustomerCreditView.as_view(),name='customer-credit'),
     path(
        'customers/<int:customer_id>/credit/payments/',CustomerRepaymentView.as_view(), name='customer-repayment'),
]
