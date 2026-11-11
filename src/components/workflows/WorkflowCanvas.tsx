/**
 * Workflow canvas: a React port of the V9 "canvas-first" studio.
 *
 * Pan by dragging the background, zoom with the wheel or the toolbar, click a
 * step to inspect it. While a simulation runs, the step being worked on is
 * highlighted and a data packet travels along each connection. In edit mode,
 * steps can be dragged; the new positions are reported through onMoveNode.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '@/workflows/workflowTypes';

export interface CanvasTransfer {
  from: string;
  to: string;
  kind: 'flow' | 'feedback';
  /** Changes for every transfer so the same edge can animate twice. */
  key: number;
}

export interface WorkflowCanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  centreOn: (nodeId: string) => void;
  /** Centres a step and zooms to a readable size (used to follow a simulation). */
  focusOn: (nodeId: string, scale?: number) => void;
}

interface WorkflowCanvasProps {
  definition: WorkflowDefinition;
  activeIds?: string[];
  waitingIds?: string[];
  completedIds?: string[];
  selectedId?: string | null;
  onSelect?: (nodeId: string) => void;
  transfer?: CanvasTransfer | null;
  onTransferDone?: () => void;
  editing?: boolean;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  className?: string;
}

const NODE_W = 260;
const NODE_H = 70;
const HALF_W = NODE_W / 2;
const HALF_H = NODE_H / 2;
const ICONS: Record<WorkflowNode['type'], string> = { input: '▣', auto: '↻', gate: '◇', end: '✓' };
const TYPE_LABEL: Record<WorkflowNode['type'], string> = { input: 'Input', auto: 'Automatic', gate: 'Decision', end: 'End' };
const kindOf = (edge: WorkflowEdge) => edge.kind || 'flow';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Connection path: upward flows run top-of-source to bottom-of-target, as in V9. */
function edgePath(a: WorkflowNode, b: WorkflowNode, kind: string): string {
  const ax = a.x ?? 0, ay = a.y ?? 0, bx = b.x ?? 0, by = b.y ?? 0;
  if (kind !== 'feedback' && by < ay - HALF_H) {
    const y1 = ay - HALF_H, y2 = by + HALF_H;
    const bend = Math.max(50, (y1 - y2) / 2);
    return `M ${ax} ${y1} C ${ax} ${y1 - bend}, ${bx} ${y2 + bend}, ${bx} ${y2}`;
  }
  if (kind !== 'feedback' && by > ay + HALF_H) {
    const y1 = ay + HALF_H, y2 = by - HALF_H;
    const bend = Math.max(50, (y2 - y1) / 2);
    return `M ${ax} ${y1} C ${ax} ${y1 + bend}, ${bx} ${y2 - bend}, ${bx} ${y2}`;
  }
  // Same row, or a loop back: leave and enter from the sides. Loops bow out to the left.
  if (kind === 'feedback') {
    const x1 = ax - HALF_W, x2 = bx - HALF_W;
    const bow = Math.min(x1, x2) - 90;
    return `M ${x1} ${ay} C ${bow} ${ay}, ${bow} ${by}, ${x2} ${by}`;
  }
  const leftward = bx < ax;
  const x1 = leftward ? ax - HALF_W : ax + HALF_W;
  const x2 = leftward ? bx + HALF_W : bx - HALF_W;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${x2} ${by}`;
}

const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(({
  definition,
  activeIds = [],
  waitingIds = [],
  completedIds = [],
  selectedId = null,
  onSelect,
  transfer = null,
  onTransferDone,
  editing = false,
  onMoveNode,
  className,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const travelPathRef = useRef<SVGPathElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [packet, setPacket] = useState<{ x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<
    | { kind: 'pan'; startX: number; startY: number; tx: number; ty: number }
    | { kind: 'node'; id: string; startX: number; startY: number; x: number; y: number; moved: boolean }
    | null
  >(null);
  const [dragOffset, setDragOffset] = useState<{ id: string; x: number; y: number } | null>(null);
  /** Once the viewer pans or zooms, resizing no longer refits the diagram. */
  const userMoved = useRef(false);

  const nodeById = useCallback((id: string) => definition.nodes.find(node => node.id === id), [definition]);
  const position = (node: WorkflowNode) =>
    dragOffset && dragOffset.id === node.id ? { x: dragOffset.x, y: dragOffset.y } : { x: node.x ?? 0, y: node.y ?? 0 };
  const placed = (node: WorkflowNode): WorkflowNode => ({ ...node, ...position(node) });

  const fit = useCallback(() => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || !definition.nodes.length) return;
    const xs = definition.nodes.map(node => node.x ?? 0);
    const ys = definition.nodes.map(node => node.y ?? 0);
    const minX = Math.min(...xs) - HALF_W - 40, maxX = Math.max(...xs) + HALF_W + 40;
    const minY = Math.min(...ys) - HALF_H - 40, maxY = Math.max(...ys) + HALF_H + 40;
    const scale = Math.min(1.2, Math.max(0.22, Math.min((box.width - 24) / (maxX - minX), (box.height - 24) / (maxY - minY))));
    userMoved.current = false;
    setView({ scale, tx: (box.width - (maxX + minX) * scale) / 2, ty: (box.height - (maxY + minY) * scale) / 2 });
  }, [definition.nodes]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    userMoved.current = true;
    const px = cx ?? box.width / 2, py = cy ?? box.height / 2;
    setView(previous => {
      const scale = Math.min(2.8, Math.max(0.22, previous.scale * factor));
      return { scale, tx: px - (px - previous.tx) * scale / previous.scale, ty: py - (py - previous.ty) * scale / previous.scale };
    });
  }, []);

  const centreOn = useCallback((nodeId: string) => {
    const node = nodeById(nodeId);
    const box = containerRef.current?.getBoundingClientRect();
    if (!node || !box) return;
    userMoved.current = true;
    setView(previous => ({ ...previous, tx: box.width / 2 - (node.x ?? 0) * previous.scale, ty: box.height / 2 - (node.y ?? 0) * previous.scale }));
  }, [nodeById]);

  const focusOn = useCallback((nodeId: string, scale = 0.85) => {
    const node = nodeById(nodeId);
    const box = containerRef.current?.getBoundingClientRect();
    if (!node || !box) return;
    userMoved.current = true;
    setView({ scale, tx: box.width / 2 - (node.x ?? 0) * scale, ty: box.height / 2 - (node.y ?? 0) * scale });
  }, [nodeById]);

  useImperativeHandle(ref, () => ({ fit, zoomBy: factor => zoomAt(factor), centreOn, focusOn }), [fit, zoomAt, centreOn, focusOn]);

  // Fit when a different workflow, or a redrafted one with other steps, is shown.
  useLayoutEffect(() => { fit(); }, [definition.id, definition.nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refit when the canvas changes size, until the viewer has panned or zoomed.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (!userMoved.current) fit(); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.12 : 0.89, event.clientX - box.left, event.clientY - box.top);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Packet animation along the transfer path.
  useEffect(() => {
    if (!transfer) return;
    const path = travelPathRef.current;
    if (!path || prefersReducedMotion()) {
      setPacket(null);
      const timer = setTimeout(() => onTransferDone?.(), prefersReducedMotion() ? 150 : 0);
      return () => clearTimeout(timer);
    }
    const length = path.getTotalLength();
    const duration = 900;
    let frame = 0;
    let start: number | null = null;
    const step = (time: number) => {
      if (start === null) start = time;
      const t = Math.min(1, (time - start) / duration);
      const eased = t * t * (3 - 2 * t);
      const point = path.getPointAtLength(eased * length);
      setPacket({ x: point.x, y: point.y });
      if (t < 1) frame = requestAnimationFrame(step);
      else { setPacket(null); onTransferDone?.(); }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [transfer?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest('[data-node-id]');
    const nodeId = target?.getAttribute('data-node-id');
    if (nodeId && editing) {
      const node = nodeById(nodeId);
      if (!node) return;
      drag.current = { kind: 'node', id: nodeId, startX: event.clientX, startY: event.clientY, x: node.x ?? 0, y: node.y ?? 0, moved: false };
    } else if (!nodeId) {
      userMoved.current = true;
      drag.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
    } else {
      return;
    }
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    if (current.kind === 'pan') {
      setView(previous => ({ ...previous, tx: current.tx + event.clientX - current.startX, ty: current.ty + event.clientY - current.startY }));
    } else {
      const scale = viewRef.current.scale;
      const x = Math.round(current.x + (event.clientX - current.startX) / scale);
      const y = Math.round(current.y + (event.clientY - current.startY) / scale);
      current.moved = current.moved || Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY) > 3;
      setDragOffset({ id: current.id, x, y });
    }
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind === 'node' && current.moved && dragOffset) {
      onMoveNode?.(current.id, dragOffset.x, dragOffset.y);
    }
    if (current?.kind === 'node' && !current.moved) onSelect?.(current.id);
    setDragOffset(null);
  };

  const completed = new Set(completedIds);
  const active = new Set(activeIds);
  const waiting = new Set(waitingIds);
  const travelEdge = transfer
    ? definition.edges.find(edge => edge.from === transfer.from && edge.to === transfer.to && kindOf(edge) !== 'reads')
    : undefined;
  const travelFrom = transfer ? nodeById(transfer.from) : undefined;
  const travelTo = transfer ? nodeById(transfer.to) : undefined;
  const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950 [--wf-dot:#d6d9de] dark:[--wf-dot:#2b3340]',
        className,
      )}
      style={{ backgroundImage: 'radial-gradient(var(--wf-dot) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full touch-none select-none cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={`${definition.title} workflow diagram`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <style>{`
            @keyframes wf-dash { to { stroke-dashoffset: -20; } }
            .wf-travel { animation: wf-dash .5s linear infinite; }
            @media (prefers-reduced-motion: reduce) { .wf-travel { animation: none; } }
          `}</style>
          <marker id="wf-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" className="fill-gray-400 dark:fill-gray-500" />
          </marker>
          <marker id="wf-arrow-done" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" className="fill-emerald-500" />
          </marker>
        </defs>

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {/* Connections */}
          {definition.edges.map((edge, index) => {
            const from = nodeById(edge.from), to = nodeById(edge.to);
            if (!from || !to) return null;
            const kind = kindOf(edge);
            const done = completed.has(edge.from) && completed.has(edge.to) && kind === 'flow';
            const travelling = travelEdge === edge;
            const d = edgePath(placed(from), placed(to), kind);
            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                <path
                  d={d}
                  ref={travelling ? travelPathRef : undefined}
                  fill="none"
                  markerEnd={done ? 'url(#wf-arrow-done)' : 'url(#wf-arrow)'}
                  strokeDasharray={travelling ? '11 9' : kind === 'feedback' ? '8 6' : kind === 'reads' ? '2 6' : undefined}
                  strokeWidth={travelling ? 4 : 2.5}
                  strokeLinecap="round"
                  className={cn(
                    travelling ? 'stroke-amber-500 wf-travel'
                      : done ? 'stroke-emerald-500'
                        : kind === 'reads' ? 'stroke-gray-300 dark:stroke-gray-600'
                          : 'stroke-gray-400 dark:stroke-gray-500',
                  )}
                />
                {edge.label && (() => {
                  const ax = position(from).x, ay = position(from).y, bx = position(to).x, by = position(to).y;
                  const lx = kind === 'feedback' ? Math.min(ax, bx) - HALF_W - 70 : (ax + bx) / 2 + (bx > ax ? 18 : bx < ax ? -18 : 14);
                  const ly = (ay + by) / 2;
                  return (
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={bx < ax || kind === 'feedback' ? 'end' : 'start'}
                      className="fill-gray-600 stroke-gray-50 text-[11px] font-semibold dark:fill-gray-300 dark:stroke-gray-950"
                      style={{ paintOrder: 'stroke', strokeWidth: 5, strokeLinejoin: 'round' }}
                    >
                      {edge.label}
                    </text>
                  );
                })()}
              </g>
            );
          })}

          {/* A transfer between steps with no drawn connection (rare) still shows a path. */}
          {transfer && !travelEdge && travelFrom && travelTo && (
            <path
              ref={travelPathRef}
              d={edgePath(placed(travelFrom), placed(travelTo), transfer.kind)}
              fill="none"
              strokeDasharray="7 6"
              strokeWidth={3}
              className="stroke-amber-500 wf-travel"
            />
          )}

          {/* Steps */}
          {definition.nodes.map(node => {
            const { x, y } = position(node);
            const isActive = active.has(node.id);
            const isWaiting = waiting.has(node.id);
            const isDone = completed.has(node.id) && !isActive;
            const isSelected = selectedId === node.id;
            const offTrack = (node.track || 'main') !== 'main';
            const flag = isActive ? '● ACTIVE' : isWaiting ? 'WAITING' : isDone ? '✓' : node.type === 'gate' && node.gate ? node.gate.mode.toUpperCase() : '';
            return (
              <g
                key={node.id}
                data-node-id={node.id}
                transform={`translate(${x} ${y})`}
                tabIndex={0}
                role="button"
                aria-label={`${node.label}. ${TYPE_LABEL[node.type]} step${isActive ? ', active' : isDone ? ', completed' : ''}.`}
                aria-pressed={isSelected}
                className={cn('outline-none', editing ? 'cursor-move' : 'cursor-pointer', 'group')}
                onClick={() => { if (!editing) onSelect?.(node.id); }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(node.id); } }}
              >
                <rect
                  x={-HALF_W}
                  y={-HALF_H}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  strokeWidth={isActive || isSelected ? 3 : 1.5}
                  strokeDasharray={offTrack || isWaiting ? '7 5' : undefined}
                  className={cn(
                    'transition-colors group-focus-visible:stroke-intranet-primary',
                    isActive ? 'fill-amber-50 stroke-amber-500 dark:fill-amber-950/60'
                      : isDone ? 'fill-emerald-50 stroke-emerald-500 dark:fill-emerald-950/50'
                        : 'fill-white stroke-gray-300 group-hover:stroke-intranet-primary/60 dark:fill-gray-900 dark:stroke-gray-600',
                    isSelected && !isActive && 'stroke-intranet-primary dark:stroke-rose-400',
                  )}
                  style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.45))' } : undefined}
                />
                {/* Type accent bar */}
                <rect x={-HALF_W} y={-HALF_H} width={6} height={NODE_H} rx={3} className={cn(
                  node.type === 'gate' ? 'fill-amber-500' : node.type === 'end' ? 'fill-emerald-600' : node.type === 'auto' ? 'fill-sky-600' : 'fill-intranet-primary',
                )} />
                <text x={-HALF_W + 22} y={7} className="fill-intranet-primary text-[20px] dark:fill-rose-300" aria-hidden="true">{ICONS[node.type]}</text>
                <text x={-HALF_W + 52} y={-5} className="fill-gray-900 text-[14px] font-bold dark:fill-gray-100">
                  <title>{node.label}</title>
                  {clip(node.label, 28)}
                </text>
                <text x={-HALF_W + 52} y={15} className="fill-gray-500 text-[11.5px] dark:fill-gray-400">
                  {clip(node.sub || TYPE_LABEL[node.type], 34)}
                </text>
                {flag && (
                  <text x={HALF_W - 12} y={-HALF_H + 15} textAnchor="end" className={cn(
                    'text-[10px] font-bold',
                    isActive ? 'fill-amber-600 dark:fill-amber-400' : isDone ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-gray-400',
                  )}>{flag}</text>
                )}
              </g>
            );
          })}

          {packet && (
            <circle cx={packet.x} cy={packet.y} r={10} className="fill-amber-300 stroke-amber-50" strokeWidth={3}
              style={{ filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))' }} />
          )}
        </g>
      </svg>
    </div>
  );
});

WorkflowCanvas.displayName = 'WorkflowCanvas';

export default WorkflowCanvas;
