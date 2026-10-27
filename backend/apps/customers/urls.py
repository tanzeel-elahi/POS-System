from django.urls import path
from .views import CustomerListCreateView, CustomerDetailView, CustomerLookupView 

urlpatterns = [
    path('customers/', CustomerListCreateView.as_view(), name='customer-list-create'),
    path('customers/lookup/', CustomerLookupView.as_view(), name='customer-lookup'),
    path('customers/<int:pk>/', CustomerDetailView.as_view(), name='customer-detail'),
]