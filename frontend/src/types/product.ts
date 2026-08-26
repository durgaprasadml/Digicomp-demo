export type ProductCategory =
  | 'Microcontrollers'
  | 'Sensors'
  | 'Motor Drivers'
  | 'Motors'
  | 'Robotics'
  | 'Power'
  | 'Displays'
  | 'Accessories'
  | 'Automation';

export interface Product {
  id: number;
  sku: string;
  name: string;
  slug?: string;
  category: ProductCategory;
  subcategory?: string;
  description: string;
  price: number;
  stock: number;
  stock_quantity?: number;
  in_stock?: boolean;
  image: string;
  image_url: string;
  productUrl: string;
  product_url: string;
  specifications: Record<string, string>;
  tags: string[];
  keywords?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
