from django.urls import path
from .views import (
    ProductListCreateView, ProductDetailView, ProductLookupView,
    CategoryListCreateView, CategoryDetailView,
)

urlpatterns = [
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/lookup/', ProductLookupView.as_view(), name='product-lookup'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
]