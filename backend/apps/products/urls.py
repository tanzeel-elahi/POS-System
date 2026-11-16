from django.urls import path
from .views import (
    ProductListCreateView, ProductDetailView, ProductLookupView,ProductGroupListCreateView,ProductGroupDetailView,
    CategoryListCreateView, CategoryDetailView,ProductGroupVariantsView
)

urlpatterns = [
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/lookup/', ProductLookupView.as_view(), name='product-lookup'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('product-groups/', ProductGroupListCreateView.as_view(), name='product-group-list-create'),
    path('product-groups/<int:pk>/', ProductGroupDetailView.as_view(), name='product-group-detail'),
    path('product-groups/<int:pk>/variants/', ProductGroupVariantsView.as_view(), name='product-group-variants'),
]