from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from .models import Bill
from .serializers import BillCreateSerializer, BillSerializer
from .services import BillingService


class BillListCreateView(APIView):
    def get(self, request):
        bills = Bill.objects.all()
        serializer = BillSerializer(bills, many=True)
        return Response(serializer.data)

    def post(self, request):
        input_serializer = BillCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        try:
            bill = BillingService.create_bill(
                customer_phone=data.get('customer_phone'),
                customer_name=data.get('customer_name', ''),
                items=data['items'],
            )
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BillSerializer(bill).data, status=status.HTTP_201_CREATED)


class BillDetailView(APIView):
    def get(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)
        return Response(BillSerializer(bill).data)