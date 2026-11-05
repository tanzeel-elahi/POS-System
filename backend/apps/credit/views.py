
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError
from .serializers import RepaymentInputSerializer, CreditEntrySerializer,  StatementQuerySerializer, StatementSerializer
from apps.customers.services import CustomerService
from .services import CreditService


class CustomerCreditView(APIView):

    def get(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)

        if not customer:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        balance = CreditService.get_balance(customer)
        entries = CreditService.get_history(customer)

        return Response({
            'balance': str(balance),
            'entries': CreditEntrySerializer(entries, many=True).data,
        })


class CustomerRepaymentView(APIView):

    def post(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)

        if not customer:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = RepaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            entry = CreditService.record_repayment(
                customer=customer,
                amount=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note', '')
            )
        except ValidationError as e:
            return Response(
                {'detail': e.messages[0]},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                'balance': str(CreditService.get_balance(customer)),
                'entry': CreditEntrySerializer(entry).data,
            },
            status=status.HTTP_201_CREATED
        )


class CustomerStatementView(APIView):
    def get(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)

        if not customer:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        query = StatementQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)

        start_date = query.validated_data.get('start_date')
        end_date = query.validated_data.get('end_date')

        statement = CreditService.get_statement(
            customer,
            start_date=start_date,
            end_date=end_date,
        )

        serialized_statement = StatementSerializer(statement).data

        return Response({
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'phone': customer.phone,
            },
            'period': {
                'start_date': start_date,
                'end_date': end_date,
            },
            **serialized_statement,
        })
