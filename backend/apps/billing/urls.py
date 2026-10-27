from django.urls import path
from .views import BillListCreateView, BillDetailView, CustomerBillHistoryView

urlpatterns = [
    path('bills/', BillListCreateView.as_view(), name='bill-list-create'),
    path('bills/<int:pk>/', BillDetailView.as_view(), name='bill-detail'),
    path('customers/<int:customer_id>/bills/', CustomerBillHistoryView.as_view(), name='customer-bill-history'),
]