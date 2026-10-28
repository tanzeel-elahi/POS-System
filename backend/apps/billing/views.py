from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from apps.customers.services import CustomerService
from .models import Bill
from .serializers import BillCreateSerializer, BillSerializer, PaymentProofSerializer
from .services import BillingService


class BillListCreateView(APIView):
    def get(self, request):
        bills = Bill.objects.prefetch_related('items')
        serializer = BillSerializer(
            bills,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    def post(self, request):
        input_serializer = BillCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        try:
            bill = BillingService.create_bill(
                customer_phone=data.get('customer_phone'),
                customer_name=data.get('customer_name', ''),
                payment_mode=data.get('payment_mode', Bill.PaymentMode.CASH),
                items=data['items'],
            )
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BillSerializer(bill, context={'request': request}).data, status=status.HTTP_201_CREATED)


class BillDetailView(APIView):
    def get(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)
        return Response(BillSerializer(bill, context={'request': request}).data)


class CustomerBillHistoryView(APIView):
    def get(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)
        if not customer:
            return Response({'detail': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
        bills = BillingService.get_customer_bills(customer)
        return Response(BillSerializer(
            bills,
            many=True,
            context={'request': request},
        ).data)


class BillPaymentProofView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        bill = get_object_or_404(Bill, pk=pk)

        serializer = PaymentProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            bill = BillingService.attach_payment_proof(
                bill,
                serializer.validated_data['payment_proof'],
            )
        except ValidationError as e:
            return Response(
                {'detail': e.messages[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillSerializer(bill, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )
