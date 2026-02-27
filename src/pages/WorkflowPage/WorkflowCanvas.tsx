/**
 * WorkflowCanvas - Full-screen ReactFlow canvas editor
 */
import { useCallback, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { InputNode } from './nodes/InputNode';
import { OutputNode } from './nodes/OutputNode';
import { AgentNode } from './nodes/AgentNode';
import { ConditionNode } from './nodes/ConditionNode';
import { MergeNode } from './nodes/MergeNode';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import type { WorkflowConfig, WorkflowNode, WorkflowEdge, WorkflowNodeData } from '@/types/workflow';

interface Props {
  workflow: WorkflowConfig;
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  onBack: () => void;
  onRun: () => void;
}

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  agent: AgentNode,
  condition: ConditionNode,
  merge: MergeNode,
};

function CanvasInner({ workflow, onSave, onBack, onRun }: Props) {
  const { t } = useTranslation('workflows');
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Convert workflow nodes/edges to ReactFlow format
  const initialNodes: RFNode[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
  }));
  const initialEdges: RFEdge[] = workflow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    label: e.label || undefined,
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: RFNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { label: type.charAt(0).toUpperCase() + type.slice(1) },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNode({
      id: node.id,
      type: node.type as WorkflowNode['type'],
      position: node.position,
      data: node.data as unknown as WorkflowNodeData,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, data: Partial<WorkflowNodeData>) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        const newData = { ...n.data, ...data };
        return { ...n, data: newData };
      }
      return n;
    }));
    setSelectedNode((prev) => prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }, [setNodes]);

  const handleSave = useCallback(() => {
    const wfNodes: WorkflowNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type as WorkflowNode['type'],
      position: n.position,
      data: n.data as unknown as WorkflowNodeData,
    }));
    const wfEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));
    onSave(wfNodes, wfEdges);
  }, [nodes, edges, onSave]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected));
    }
  }, [setNodes, setEdges]);

  return (
    <div className="flex flex-col h-full" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('edit', '返回')}
          </Button>
          <span className="font-semibold text-sm">{workflow.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRun}>
            <Play className="h-4 w-4 mr-1" />
            {t('execution.run')}
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            {t('editor.save')}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-background"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <NodeConfigPanel node={selectedNode} onUpdate={handleNodeUpdate} />
      </div>
    </div>
  );
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
