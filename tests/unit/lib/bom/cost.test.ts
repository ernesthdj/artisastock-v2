import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateBomCost } from '@/lib/bom/cost';

// Mock Prisma
const mockPrisma = {
  bomSheet: {
    findUniqueOrThrow: vi.fn(),
  },
};

describe('calculateBomCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_return_zero_cost_when_no_lines', async () => {
    mockPrisma.bomSheet.findUniqueOrThrow.mockResolvedValue({
      id: 'sheet-1',
      name: 'Fiche vide',
      outputQty: '1.0000',
      outputUnit: 'KG',
      lines: [],
    });

    const result = await calculateBomCost('sheet-1', 1, mockPrisma as never);

    expect(result.totalCost).toBe(0);
    expect(result.unitCost).toBe(0);
    expect(result.lines).toHaveLength(0);
  });

  it('should_calculate_ingredient_cost_with_unit_conversion', async () => {
    mockPrisma.bomSheet.findUniqueOrThrow.mockResolvedValue({
      id: 'sheet-1',
      name: 'Génoise',
      outputQty: '1.0000',
      outputUnit: 'KG',
      lines: [
        {
          id: 'line-1',
          inputType: 'INGREDIENT',
          quantity: '500.0000',
          unit: 'G',
          ingredient: {
            id: 'ing-1',
            name: 'Farine',
            unit: 'KG',        // stock en KG
            priceUnit: '2.0000', // 2€/kg
          },
          subSheet: null,
        },
      ],
    });

    // 500g = 0.5 kg × 2€/kg = 1€
    const result = await calculateBomCost('sheet-1', 1, mockPrisma as never);

    expect(result.totalCost).toBeCloseTo(1.0);
    expect(result.unitCost).toBeCloseTo(1.0); // 1€ pour 1kg
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].label).toBe('Farine');
  });

  it('should_scale_cost_with_nBatches', async () => {
    mockPrisma.bomSheet.findUniqueOrThrow.mockResolvedValue({
      id: 'sheet-1',
      name: 'Fondant',
      outputQty: '1.0000',
      outputUnit: 'KG',
      lines: [
        {
          id: 'line-1',
          inputType: 'INGREDIENT',
          quantity: '1000.0000',
          unit: 'G',
          ingredient: { id: 'ing-1', name: 'Sucre', unit: 'G', priceUnit: '0.001' }, // 0.001€/g
          subSheet: null,
        },
      ],
    });

    // 1 lot : 1000g × 0.001€ = 1€
    // 3 lots : 3000g × 0.001€ = 3€
    const result = await calculateBomCost('sheet-1', 3, mockPrisma as never);

    expect(result.totalCost).toBeCloseTo(3.0);
    expect(result.nBatches).toBe(3);
    expect(result.outputQty).toBe(3); // 3 × 1kg
  });

  it('should_detect_cycle_and_throw', async () => {
    // La fiche s'inclut elle-même via visited
    const visited = new Set(['sheet-cycle']);

    await expect(
      calculateBomCost('sheet-cycle', 1, mockPrisma as never, visited)
    ).rejects.toThrow('Cycle BOM détecté');
  });

  it('should_calculate_recursive_subsheet_cost', async () => {
    // Sheet niveau 1 : inclut la sous-fiche de niveau 0
    mockPrisma.bomSheet.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: 'sheet-n1',
        name: 'Mousse Chocolat',
        outputQty: '1.0000',
        outputUnit: 'KG',
        lines: [
          {
            id: 'line-sub',
            inputType: 'SHEET',
            quantity: '500.0000',
            unit: 'G',
            ingredient: null,
            subSheet: {
              id: 'sheet-n0',
              name: 'Crème Chantilly',
              outputQty: '1000.0000',
              outputUnit: 'G',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        // Appel récursif sur la sous-fiche
        id: 'sheet-n0',
        name: 'Crème Chantilly',
        outputQty: '1000.0000',
        outputUnit: 'G',
        lines: [
          {
            id: 'line-cream',
            inputType: 'INGREDIENT',
            quantity: '1000.0000',
            unit: 'G',
            ingredient: { id: 'ing-cream', name: 'Crème liquide', unit: 'G', priceUnit: '0.003' },
            subSheet: null,
          },
        ],
      });

    // Sous-fiche : 1000g crème × 0.003 = 3€ pour 1000g
    // On a besoin de 500g → 0.5 lot de sous-fiche → 1.5€
    const result = await calculateBomCost('sheet-n1', 1, mockPrisma as never);

    expect(result.totalCost).toBeCloseTo(1.5);
    expect(result.lines[0].inputType).toBe('SHEET');
  });
});
