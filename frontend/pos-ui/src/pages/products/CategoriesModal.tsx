import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Empty, Flex, Form, Input, Modal, Space, Spin, Tooltip, Tree, Typography } from 'antd';
import type { TreeProps } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryService } from '@services/categoryService';
import { applyApiErrors } from '@/utils/formErrors';
import { getApiError } from '@/utils/apiError';
import type { CategoryNode } from '@/types';
import { useCategoryTree } from './useCategories';
import { MAX_DEPTH, buildIndex, depthOf, heightOf, isInside, toTreeData } from './categoryUtils';

type Editor = { mode: 'add'; parent: CategoryNode | null } | { mode: 'rename'; node: CategoryNode } | null;

/* ---------------- add / rename dialog ---------------- */

interface NameModalProps {
  editor: Editor;
  onClose: () => void;
  onDone: (expandId?: string) => void;
}

const NameModal = ({ editor, onClose, onDone }: NameModalProps) => {
  const [form] = Form.useForm<{ name: string }>();
  const { message } = App.useApp();

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      if (!editor) return;
      if (editor.mode === 'add') await CategoryService.createCategory(name, editor.parent?.id ?? null);
      else await CategoryService.updateCategory(editor.node.id, { name });
    },
    onSuccess: () => {
      message.success(editor?.mode === 'add' ? 'Category added' : 'Category renamed');
      onDone(editor?.mode === 'add' ? editor.parent?.id : undefined);
    },
    onError: (e) => applyApiErrors(form, e, message, (msg) => (/already exists/i.test(msg) ? 'name' : null)),
  });

  const title =
    editor?.mode === 'rename'
      ? `Rename "${editor.node.name}"`
      : editor?.parent
        ? `Add subcategory to "${editor.parent.name}"`
        : 'Add top-level category';

  return (
    <Modal
      title={title}
      open={!!editor}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editor?.mode === 'rename' ? 'Save' : 'Add'}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      width={420}
    >
      {editor && (
        <Form
          key={editor.mode === 'rename' ? editor.node.id : `add-${editor.parent?.id ?? 'root'}`}
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ name: editor.mode === 'rename' ? editor.node.name : '' }}
          onFinish={(v) => mutation.mutate(v.name)}
        >
          <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true, message: 'Please enter a name' }]}>
            <Input autoFocus maxLength={100} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

/* ---------------- tree manager ---------------- */

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CategoriesModal = ({ open, onClose }: Props) => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const treeQuery = useCategoryTree(open);

  const index = useMemo(() => buildIndex(treeQuery.data ?? []), [treeQuery.data]);
  const treeData = useMemo(() => toTreeData(treeQuery.data ?? []), [treeQuery.data]);

  const [editor, setEditor] = useState<Editor>(null);

  // Start fully expanded, then let the user collapse and keep their choice across refetches
  const [expanded, setExpanded] = useState<React.Key[]>([]);
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (treeQuery.data && !seeded.current) {
      setExpanded([...index.keys()]);
      seeded.current = true;
    }
  }, [open, treeQuery.data, index]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] }); // flat list + tree
    queryClient.invalidateQueries({ queryKey: ['products'] }); // product rows carry category_name
  };

  const moveMutation = useMutation({
    mutationFn: (v: { id: string; parent: string | null }) => CategoryService.updateCategory(v.id, { parent: v.parent }),
    onSuccess: (_d, v) => {
      message.success('Category moved');
      if (v.parent) setExpanded((prev) => (prev.includes(v.parent!) ? prev : [...prev, v.parent!]));
      refresh();
    },
    onError: (e) => message.error(getApiError(e, 'Failed to move category')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CategoryService.deleteCategory(id),
    onSuccess: () => {
      message.success('Category deleted');
      refresh();
    },
    onError: (e) => message.error(getApiError(e, 'Failed to delete category')),
  });

  const handleDelete = (node: CategoryNode) => {
    if (node.children.length > 0) {
      message.warning('This category has subcategories. Move or delete them first.');
      return;
    }
    modal.confirm({
      title: `Delete "${node.name}"?`,
      content: 'Products and product groups in this category will become uncategorized.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync(node.id).catch(() => undefined), // the mutation already shows the error
    });
  };

  const onDrop: TreeProps['onDrop'] = (info) => {
    const dragId = String(info.dragNode.key);
    const dropId = String(info.node.key);
    const dragNode = index.get(dragId);
    const dropNode = index.get(dropId);
    if (!dragNode || !dropNode) return;

    // Dropped ON a node = child of it. Dropped between nodes = sibling of it.
    const newParent: string | null = info.dropToGap ? dropNode.parent : dropId;

    if (newParent === dragNode.parent) {
      message.info('Siblings are sorted A–Z automatically. Drop it onto another category to move it.');
      return;
    }
    if (newParent && isInside(newParent, dragId, index)) {
      message.error('A category cannot be moved inside itself or its own subcategories.');
      return;
    }
    const newDepth = (newParent ? depthOf(newParent, index) : 0) + heightOf(dragNode);
    if (newDepth > MAX_DEPTH) {
      message.error(`Categories can be at most ${MAX_DEPTH} levels deep.`);
      return;
    }
    moveMutation.mutate({ id: dragId, parent: newParent });
  };

  return (
    <>
      <Modal title="Categories" open={open} onCancel={onClose} footer={null} destroyOnHidden width={560}>
        <Flex justify="space-between" align="center" gap={12} style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Drag a category onto another to move its whole branch. Up to {MAX_DEPTH} levels.
          </Typography.Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ mode: 'add', parent: null })}>
            Top-level category
          </Button>
        </Flex>

        <Spin spinning={treeQuery.isLoading || moveMutation.isPending}>
          {treeData.length === 0 && !treeQuery.isLoading ? (
            <Empty description="No categories yet" />
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <Tree
                blockNode
                draggable
                selectable={false}
                treeData={treeData}
                expandedKeys={expanded}
                onExpand={setExpanded}
                onDrop={onDrop}
                titleRender={(n) => {
                  const c = index.get(String(n.key));
                  if (!c) return null;
                  return (
                    <Flex justify="space-between" align="center" gap={8}>
                      <span>{c.name}</span>
                      <Space size={2} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title={depthOf(c.id, index) >= MAX_DEPTH ? `Maximum depth (${MAX_DEPTH}) reached` : 'Add subcategory'}>
                          <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined />}
                            disabled={depthOf(c.id, index) >= MAX_DEPTH}
                            onClick={() => setEditor({ mode: 'add', parent: c })}
                          />
                        </Tooltip>
                        <Tooltip title="Rename">
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditor({ mode: 'rename', node: c })} />
                        </Tooltip>
                        <Tooltip title="Delete">
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(c)} />
                        </Tooltip>
                      </Space>
                    </Flex>
                  );
                }}
              />
            </div>
          )}
        </Spin>
      </Modal>

      <NameModal
        editor={editor}
        onClose={() => setEditor(null)}
        onDone={(expandId) => {
          setEditor(null);
          if (expandId) setExpanded((prev) => (prev.includes(expandId) ? prev : [...prev, expandId]));
          refresh();
        }}
      />
    </>
  );
};