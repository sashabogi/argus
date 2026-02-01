import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphLink } from '../types';

interface DependencyGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (nodeId: string) => void;
  selectedNode?: string | null;
}

// Color palette for different groups
const GROUP_COLORS = [
  '#58a6ff', // blue
  '#3fb950', // green
  '#d29922', // yellow
  '#f85149', // red
  '#a371f7', // purple
  '#39d353', // lime
  '#db61a2', // pink
  '#768390', // gray
  '#f78166', // orange
  '#79c0ff', // light blue
];

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  lines?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

export function DependencyGraph({
  nodes,
  links,
  onNodeClick,
  selectedNode,
}: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 600,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (onNodeClick) {
        onNodeClick(nodeId);
      }
    },
    [onNodeClick]
  );

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const { width, height } = dimensions;

    // Clear previous content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create container group for zoom
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Convert nodes and links to simulation format
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      id: n.id,
      group: n.group,
      lines: n.lines,
    }));

    const simLinks: SimLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
    }));

    // Create simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Add arrow marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#30363d');

    // Add links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('class', 'link-line')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Add nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on('drag', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on('end', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          })
      );

    // Add circles to nodes
    node
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => Math.min(20, Math.max(8, Math.sqrt(d.lines || 50))))
      .attr('fill', (d) => GROUP_COLORS[d.group % GROUP_COLORS.length])
      .attr('stroke', (d) =>
        d.id === selectedNode ? '#fff' : '#30363d'
      )
      .attr('stroke-width', (d) => (d.id === selectedNode ? 3 : 1.5))
      .on('click', (_, d) => handleNodeClick(d.id));

    // Add labels to nodes
    node
      .append('text')
      .text((d) => {
        const parts = d.id.split('/');
        return parts[parts.length - 1];
      })
      .attr('x', 0)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c9d1d9')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none');

    // Add tooltips
    node.append('title').text((d) => `${d.id}\n${d.lines || 0} lines`);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x || 0)
        .attr('y1', (d) => (d.source as SimNode).y || 0)
        .attr('x2', (d) => (d.target as SimNode).x || 0)
        .attr('y2', (d) => (d.target as SimNode).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, dimensions, selectedNode, handleNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-argus-darker rounded-lg"
      />
    </div>
  );
}
