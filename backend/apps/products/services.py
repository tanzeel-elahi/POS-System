from django.core.exceptions import ValidationError
from .models import Category, Product, ProductGroup
from django.db import transaction
from collections import defaultdict


def normalize_qr_code(value):
    """Trim spaces. Empty means 'no code' and is stored as None."""
    value = (value or '').strip()
    return value or None


def clean_attribute_names(names):
    """Trim, reject empty or duplicate names (ignoring case), cap at 10."""
    cleaned, seen = [], set()
    for name in names or []:
        name = str(name).strip()
        if not name:
            raise ValidationError("Attribute names cannot be empty.")
        if name.lower() in seen:
            raise ValidationError(f"Duplicate attribute name '{name}'.")
        seen.add(name.lower())
        cleaned.append(name)
    if len(cleaned) > 10:
        raise ValidationError("A product can have at most 10 attributes.")
    return cleaned


def clean_attributes(attribute_names, attributes):
    """Return the values in the group's order. Every attribute needs a value."""
    attributes = attributes or {}
    given = {str(k).strip().lower(): v for k, v in attributes.items()}
    if len(given) != len(attributes):
        raise ValidationError("Duplicate attribute names in one variant.")
    cleaned = {}
    for name in attribute_names:
        value = str(given.pop(name.lower(), '')).strip()
        if not value:
            raise ValidationError(f"Attribute '{name}' needs a value.")
        cleaned[name] = value
    if given:
        raise ValidationError(f"Unknown attribute: {', '.join(given)}.")
    return cleaned


def _combo_key(attribute_names, attributes):
    return tuple(str(attributes.get(n, '')).lower() for n in attribute_names)


def check_combo_free(group, attributes, exclude_pk=None):
    key = _combo_key(group.attribute_names, attributes)
    others = group.variants.filter(is_active=True)
    if exclude_pk:
        others = others.exclude(pk=exclude_pk)
    for variant in others:
        if _combo_key(group.attribute_names, variant.attributes) == key:
            raise ValidationError(
                "A variant with these attributes already exists in this product.")


class ProductService:

    @staticmethod
    def get_by_code(code):
        code = (code or '').strip()
        if not code:
            return None
        active = Product.objects.filter(is_active=True).select_related('group')
        return active.filter(qr_code=code).first() or active.filter(sku=code).first()

    @staticmethod
    def create_product(*, name, sku, price, stock_quantity=0, **extra):
        if price <= 0:
            raise ValidationError("Price must be greater than zero.")
        if Product.objects.filter(sku=sku).exists():
            raise ValidationError(f"SKU '{sku}' already exists.")
        if 'qr_code' in extra:
            extra['qr_code'] = normalize_qr_code(extra['qr_code'])
            if extra['qr_code'] and Product.objects.filter(qr_code=extra['qr_code']).exists():
                raise ValidationError(f"QR code '{extra['qr_code']}' already exists.")
        if extra.get('attributes') and extra.get('group') is None:
            raise ValidationError("Only variants of a grouped product can have attributes.")
        return Product.objects.create(
            name=name, sku=sku, price=price,
            stock_quantity=stock_quantity, **extra,
        )

    @staticmethod
    def update_product(product, **fields):
        if 'price' in fields and fields['price'] <= 0:
            raise ValidationError("Price must be greater than zero.")
        if 'qr_code' in fields:
            fields['qr_code'] = normalize_qr_code(fields['qr_code'])

        group = product.group
        if group:
            if 'name' in fields and fields['name'] != group.name:
                raise ValidationError(
                    "Rename the whole product with PATCH /product-groups/<id>/.")
            if 'category' in fields and fields['category'] != group.category:
                raise ValidationError(
                    "Change the category of the whole product with PATCH /product-groups/<id>/.")

        if 'attributes' in fields:
            if group is None:
                if fields['attributes']:
                    raise ValidationError(
                        "Only variants of a grouped product can have attributes.")
            else:
                fields['attributes'] = clean_attributes(
                    group.attribute_names, fields['attributes'])
                check_combo_free(group, fields['attributes'], exclude_pk=product.pk)

        for key, value in fields.items():
            setattr(product, key, value)
        product.save()
        return product

    @staticmethod
    def deactivate_product(product):
        product.is_active = False
        product.save(update_fields=['is_active'])
        return product


MAX_CATEGORY_DEPTH = 5


class CategoryService:

    # ---- reading the tree (one query each, then work in memory) ----

    @staticmethod
    def _parent_map():
        """{category id: parent id}. A whole tree is small, so load it once."""
        return dict(Category.objects.values_list('id', 'parent_id'))

    @staticmethod
    def _children_map(parent_of):
        children = defaultdict(list)
        for child_id, parent_id in parent_of.items():
            children[parent_id].append(child_id)
        return children

    @staticmethod
    def _depth(category_id, parent_of):
        """Levels from the top down to this category (a top-level one is 1)."""
        depth, seen = 0, set()
        while category_id is not None and category_id not in seen:
            seen.add(category_id)
            depth += 1
            category_id = parent_of.get(category_id)
        return depth

    @staticmethod
    def _height(category_id, children):
        """Levels in the branch starting at this category, counting itself."""
        return 1 + max(
            (CategoryService._height(c, children) for c in children.get(category_id, [])),
            default=0,
        )

    @staticmethod
    def subtree_ids(category_id):
        """This category's id plus the ids of everything below it."""
        children = CategoryService._children_map(CategoryService._parent_map())
        ids, stack = [], [category_id]
        while stack:
            node = stack.pop()
            ids.append(node)
            stack.extend(children.get(node, []))
        return ids

    @staticmethod
    def build_paths():
        """{category id: ['Clothing', 'Men', 'Shirts']}"""
        rows = {i: (name, parent) for i, name, parent
                in Category.objects.values_list('id', 'name', 'parent_id')}
        paths = {}
        for category_id in rows:
            chain, seen, node = [], set(), category_id
            while node in rows and node not in seen:
                seen.add(node)
                name, parent = rows[node]
                chain.append(name)
                node = parent
            paths[category_id] = list(reversed(chain))
        return paths

    @staticmethod
    def get_tree():
        """Nested list: [{'id', 'name', 'parent', 'children': [...]}, ...]"""
        nodes = {
            c['id']: {'id': c['id'], 'name': c['name'],
                      'parent': c['parent_id'], 'children': []}
            for c in Category.objects.order_by('name').values('id', 'name', 'parent_id')
        }
        roots = []
        for node in nodes.values():
            parent = nodes.get(node['parent'])
            (parent['children'] if parent else roots).append(node)
        return roots

    # ---- writing ----

    @staticmethod
    def _check_name_free(name, parent_id, exclude_pk=None):
        siblings = Category.objects.filter(parent_id=parent_id, name__iexact=name)
        if exclude_pk:
            siblings = siblings.exclude(pk=exclude_pk)
        if siblings.exists():
            raise ValidationError(
                "A category with this name already exists in the same place.")

    @staticmethod
    def create_category(*, name, parent=None):
        name = name.strip()
        parent_id = parent.pk if parent else None
        CategoryService._check_name_free(name, parent_id)
        if parent_id is not None:
            parent_of = CategoryService._parent_map()
            if CategoryService._depth(parent_id, parent_of) + 1 > MAX_CATEGORY_DEPTH:
                raise ValidationError(
                    f"Categories can be at most {MAX_CATEGORY_DEPTH} levels deep.")
        return Category.objects.create(name=name, parent=parent)

    @staticmethod
    def update_category(category, **fields):
        if 'name' in fields:
            fields['name'] = fields['name'].strip()
        name = fields.get('name', category.name)

        if 'parent' in fields:
            parent_id = fields['parent'].pk if fields['parent'] else None
        else:
            parent_id = category.parent_id

        if parent_id != category.parent_id:          # the category is being moved
            parent_of = CategoryService._parent_map()
            node, seen = parent_id, set()
            while node is not None and node not in seen:
                if node == category.pk:
                    raise ValidationError(
                        "A category cannot be moved inside itself or its own subcategories.")
                seen.add(node)
                node = parent_of.get(node)
            children = CategoryService._children_map(parent_of)
            if (CategoryService._depth(parent_id, parent_of)
                    + CategoryService._height(category.pk, children)) > MAX_CATEGORY_DEPTH:
                raise ValidationError(
                    f"Categories can be at most {MAX_CATEGORY_DEPTH} levels deep.")

        if 'name' in fields or parent_id != category.parent_id:
            CategoryService._check_name_free(name, parent_id, exclude_pk=category.pk)

        for key, value in fields.items():
            setattr(category, key, value)
        category.save()
        return category

    @staticmethod
    def delete_category(category):
        if category.children.exists():
            raise ValidationError(
                "This category has subcategories. Move or delete them first.")
        category.delete()


class ProductGroupService:

    @staticmethod
    @transaction.atomic
    def create_group(*, name, variants, description='', category=None,
                     attribute_names=None):
        names = clean_attribute_names(attribute_names)
        group = ProductGroup.objects.create(
            name=name.strip(), description=description,
            category=category, attribute_names=names,
        )
        for data in variants:
            ProductGroupService._add_variant(group, **data)
        return group

    @staticmethod
    @transaction.atomic
    def add_variant(group, **data):
        return ProductGroupService._add_variant(group, **data)

    @staticmethod
    def _add_variant(group, *, sku, price, stock_quantity=0,
                     qr_code=None, attributes=None):
        attributes = clean_attributes(group.attribute_names, attributes)
        check_combo_free(group, attributes)
        return ProductService.create_product(
            name=group.name, sku=sku, price=price,
            stock_quantity=stock_quantity, qr_code=qr_code,
            category=group.category, group=group, attributes=attributes,
        )

    @staticmethod
    @transaction.atomic
    def update_group(group, **fields):
        for key, value in fields.items():
            setattr(group, key, value)
        group.name = group.name.strip()
        group.save()
        # Variants keep a copy of name and category. Keep them in sync.
        group.variants.update(name=group.name, category=group.category)
        return group

    @staticmethod
    @transaction.atomic
    def deactivate_group(group):
        group.is_active = False
        group.save(update_fields=['is_active'])
        group.variants.update(is_active=False)
        return group