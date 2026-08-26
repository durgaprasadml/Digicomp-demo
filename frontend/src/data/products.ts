import { Product, ProductCategory } from '@/types/product';
import {
  get_all_products_sync,
  get_product_by_id_sync,
  search_products_sync,
  search_products_by_category_sync,
  search_products_by_price_sync,
  search_products_in_stock_sync,
  search_products_with_filters_sync,
} from '@/lib/client-products';

export const CATEGORIES: ProductCategory[] = [
  'Microcontrollers',
  'Sensors',
  'Motor Drivers',
  'Motors',
  'Robotics',
  'Automation',
  'Power',
  'Displays',
  'Accessories',
];

export function get_all_products(): Product[] {
  return get_all_products_sync();
}

export function get_product_by_id(id: number | string): Product | null {
  return get_product_by_id_sync(id);
}

export function search_products(query: string, limit: number = 20): Product[] {
  return search_products_sync(query, limit);
}

export function search_products_by_category(category: string): Product[] {
  return search_products_by_category_sync(category);
}

export function search_products_by_price(minPrice?: number, maxPrice?: number): Product[] {
  return search_products_by_price_sync(minPrice, maxPrice);
}

export function search_products_in_stock(): Product[] {
  return search_products_in_stock_sync();
}

export function search_products_with_filters(options: Record<string, unknown>): Product[] {
  return search_products_with_filters_sync(options);
}

// Backwards compatibility helpers
export function getAllProducts(): Product[] {
  return get_all_products();
}

export function getProductById(id: number | string): Product | undefined {
  const p = get_product_by_id(id);
  return p || undefined;
}

export function getProductsByCategory(category: string): Product[] {
  return search_products_by_category(category);
}

export const PRODUCTS: Product[] = get_all_products();
