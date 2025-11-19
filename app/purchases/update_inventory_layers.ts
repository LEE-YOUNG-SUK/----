import { createServerClient } from '@/lib/supabase/server';

/**
 * 입고 관리 시 inventory_layers 테이블 업데이트
 */
export async function updateInventoryLayers(
  branchId: string,
  productId: string,
  quantity: number,
  unitCost: number
) {
  try {
    const supabase = createServerClient();

    const result = await supabase.rpc('update_inventory_layers', {
      branch_id: branchId,
      product_id: productId,
      quantity,
      unit_cost: unitCost,
    });

    if (result.error) {
      throw new Error(`Failed to update inventory layers: ${result.error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating inventory layers:', error);
    return { success: false, message: error.message };
  }
}