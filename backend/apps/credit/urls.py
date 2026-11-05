
from django.urls import path
from .views import CustomerCreditView, CustomerRepaymentView, CustomerStatementView

urlpatterns = [
    path('customers/<int:customer_id>/credit/',CustomerCreditView.as_view(),name='customer-credit'),
     path('customers/<int:customer_id>/credit/payments/',CustomerRepaymentView.as_view(), name='customer-repayment'),
     path('customers/<int:customer_id>/credit/statement/',CustomerStatementView.as_view(), name='customer-statement'),
]
