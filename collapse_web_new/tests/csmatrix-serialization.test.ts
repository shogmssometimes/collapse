import { describe, it, expect } from 'vitest';
import CSGraph from '../docs/csmatrix/graph.js';

describe('CSGraph serialization', () => {
  it('round-trips nodes via toJSON/fromJSON', () => {
    // lightweight svg stub for node-less tests (avoid DOM dependency)
    const svg = {
      setAttribute: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ width: 1000, height: 1000, left: 0, top: 0 }),
    } as any;
    // instantiate graph and stub out render to avoid DOM operations during tests
    const g1 = new CSGraph(svg);
    g1.render = () => {};
    const n1 = g1.addNode({ name: 'A', gx: -1, gy: 2, color: '#123456' });
    const n2 = g1.addNode({ name: 'B', gx: 1, gy: -1, color: '#abcdef' });
    const json = g1.toJSON();
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.nodes.length).toBe(2);

    // create second graph and load (use stub to avoid DOM dependency)
    const svg2 = { setAttribute: () => {}, addEventListener: () => {}, removeEventListener: () => {}, getBoundingClientRect: () => ({ width: 1000, height: 1000, left: 0, top: 0 }) } as any;
    const g2 = new CSGraph(svg2);
    g2.render = () => {};
    g2.fromJSON(json);
    expect(g2.nodes.length).toBe(2);
    expect(g2.nodes[0].name).toBe('A');
    expect(g2.nodes[0].color).toBe('#123456');
  });
});
